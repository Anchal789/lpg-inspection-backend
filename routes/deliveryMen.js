const express = require("express")
const bcrypt = require("bcryptjs")
const mongoose = require("mongoose")
const DeliveryMan = require("../models/DeliveryMan")
const Distributor = require("../models/Distributor")
const Product = require("../models/Product")
const Inspection = require("../models/Inspection")
const { sendSuccess, sendError, asyncHandler } = require("../utils/errorHandler")
const { authenticateToken, requireAdmin } = require("../middleware/auth")
const { validatePhone, validatePassword, validateName } = require("../utils/validators")

const router = express.Router()

// Apply authentication to all routes
router.use(authenticateToken)

// Get delivery men
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { type, distributorId } = req.user
    const { page = 1, limit = 10, search } = req.query
    const query = {}

    // Filter based on user type
    if (type === "distributor_admin") {
      query.distributorId = distributorId
    }

    // Add search filter
    if (search) {
      query.$or = [{ name: { $regex: search, $options: "i" } }, { phone: { $regex: search, $options: "i" } }]
    }

    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)

    const [deliveryMen, total] = await Promise.all([
      DeliveryMan.find(query)
        .populate("distributorId", "agencyName sapCode")
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number.parseInt(limit)),
      DeliveryMan.countDocuments(query),
    ])

    const totalPages = Math.ceil(total / Number.parseInt(limit))

    console.log(`✅ Found ${deliveryMen.length} delivery men (${total} total)`)
    return sendSuccess(
      res,
      {
        deliveryMen,
        pagination: {
          currentPage: Number.parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: Number.parseInt(limit),
        },
      },
      "Delivery men fetched successfully",
    )
  }),
)

// Assign product to delivery man
router.post(
  "/:id/assign-product",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params
    const { productId, quantity, price, minPrice } = req.body

    console.log(`📦 Assigning product ${productId} to delivery man ${id}`)

    // Validate fields
    if (!productId || !quantity || !price || !minPrice) {
      return sendError(res, "Product ID, quantity, price, and minPrice are required", 400)
    }

    // Find delivery man
    const deliveryMan = await DeliveryMan.findById(id)
    if (!deliveryMan) {
      return sendError(res, "Delivery man not found", 404)
    }

    // Find product
    const product = await Product.findById(productId)
    if (!product) {
      return sendError(res, "Product not found", 404)
    }

    // Check stock
    if (quantity > product.quantity) {
      return sendError(res, `Only ${product.quantity} units available in stock`, 400)
    }

    // Deduct stock
    product.quantity -= quantity
    await product.save()

    // Assign product to delivery man
    deliveryMan.assignedProducts = deliveryMan.assignedProducts || []
    deliveryMan.assignedProducts.push({
      productId,
      quantity,
      price,
      minPrice,
    })

    await deliveryMan.save()

    console.log(`✅ Product assigned to delivery man ${deliveryMan._id}`)
    return sendSuccess(res, { deliveryMan }, "Product assigned successfully")
  }),
)


// Get delivery man details
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params
    const { type, distributorId } = req.user

    console.log("🔍 Fetching delivery man:", id)

    const query = { _id: id }

    // Filter based on user type
    if (type === "distributor_admin") {
      query.distributorId = distributorId
    }

    const deliveryMan = await DeliveryMan.findOne(query)
      .populate("distributorId", "agencyName sapCode")
      .select("-password")

    if (!deliveryMan) {
      return sendError(res, "Delivery man not found", 404)
    }

    // Get additional statistics
    const inspectionCount = await Inspection.countDocuments({ deliveryManId: id })
    const recentInspections = await Inspection.find({ deliveryManId: id })
      .populate("productId", "name type")
      .sort({ createdAt: -1 })
      .limit(10)

    const todayInspections = await Inspection.countDocuments({
      deliveryManId: id,
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lt: new Date(new Date().setHours(23, 59, 59, 999)),
      },
    })

    const deliveryManDetails = {
      ...deliveryMan.toObject(),
      inspectionCount,
      todayInspections,
      recentInspections,
    }

    console.log("✅ Delivery man fetched:", deliveryMan._id)
    return sendSuccess(res, { deliveryMan: deliveryManDetails }, "Delivery man fetched successfully")
  }),
)

// Create delivery man
router.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { type, distributorId } = req.user
    console.log("📝 Creating new delivery man for:", type, distributorId)

    const { name, phone, password } = req.body

    // Validate required fields
    if (!name || !phone || !password) {
      return sendError(res, "Name, phone, and password are required", 400)
    }

    // Validate name
    if (!validateName(name)) {
      return sendError(res, "Invalid name format", 400)
    }

    // Validate phone number
    if (!validatePhone(phone)) {
      return sendError(res, "Invalid phone number format", 400)
    }

    // Validate password
    if (!validatePassword(password)) {
      return sendError(res, "Password must be at least 4 characters", 400)
    }

    // For non-super admin users, use their distributorId
    let deliveryManDistributorId = distributorId
    if (type === "super_admin" && req.body.distributorId) {
      deliveryManDistributorId = req.body.distributorId
    }

    if (!deliveryManDistributorId) {
      return sendError(res, "Distributor ID is required", 400)
    }

    // Verify distributor exists
    const distributor = await Distributor.findById(deliveryManDistributorId)
    if (!distributor) {
      return sendError(res, "Distributor not found", 404)
    }

    // Check if phone already exists for this distributor
    const existingDeliveryMan = await DeliveryMan.findOne({
      distributorId: deliveryManDistributorId,
      phone: phone,
    })

    if (existingDeliveryMan) {
      return sendError(res, "Phone number already registered for this distributor", 400)
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create delivery man
    const deliveryMan = new DeliveryMan({
      distributorId: deliveryManDistributorId,
      name: name.trim(),
      phone: phone,
      password: hashedPassword,
    })

    await deliveryMan.save()

    // Populate the created delivery man
    await deliveryMan.populate("distributorId", "agencyName sapCode")

    // Remove password from response
    const deliveryManResponse = deliveryMan.toObject()
    delete deliveryManResponse.password

    console.log("✅ Delivery man created:", deliveryMan._id)
    return sendSuccess(res, { deliveryMan: deliveryManResponse }, "Delivery man created successfully", 201)
  }),
)

// Update delivery man
router.put(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params
    const { type, distributorId } = req.user

    console.log("📝 Updating delivery man:", id)

    const query = { _id: id }

    // Filter based on user type
    if (type === "distributor_admin") {
      query.distributorId = distributorId
    }

    // Don't allow changing distributorId unless super admin
    if (type !== "super_admin") {
      delete req.body.distributorId
    }

    // Hash password if provided
    if (req.body.password) {
      if (!validatePassword(req.body.password)) {
        return sendError(res, "Password must be at least 4 characters", 400)
      }
      req.body.password = await bcrypt.hash(req.body.password, 10)
    }

    // Validate name if provided
    if (req.body.name && !validateName(req.body.name)) {
      return sendError(res, "Invalid name format", 400)
    }

    // Validate phone if provided
    if (req.body.phone && !validatePhone(req.body.phone)) {
      return sendError(res, "Invalid phone number format", 400)
    }

    const deliveryMan = await DeliveryMan.findOneAndUpdate(query, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("distributorId", "agencyName sapCode")
      .select("-password")

    if (!deliveryMan) {
      return sendError(res, "Delivery man not found or access denied", 404)
    }

    console.log("✅ Delivery man updated:", deliveryMan._id)
    return sendSuccess(res, { deliveryMan }, "Delivery man updated successfully")
  }),
)

// Delete delivery man
router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params
    const { type, distributorId } = req.user

    console.log("🗑️ Deleting delivery man:", id)

    const query = { _id: id }

    // Filter based on user type
    if (type === "distributor_admin") {
      query.distributorId = distributorId
    }

    const deliveryMan = await DeliveryMan.findOneAndDelete(query)

    if (!deliveryMan) {
      return sendError(res, "Delivery man not found or access denied", 404)
    }

    console.log("✅ Delivery man deleted:", id)
    return sendSuccess(res, null, "Delivery man deleted successfully")
  }),
)

// Change delivery man password (self or admin)
router.put(
  "/:id/change-password",
  asyncHandler(async (req, res) => {
    const { id } = req.params
    const { type, distributorId } = req.user
    const { currentPassword, newPassword } = req.body

    console.log("🔐 Changing password for delivery man:", id)

    // Validate required fields
    if (!currentPassword || !newPassword) {
      return sendError(res, "Current password and new password are required", 400)
    }

    // Validate new password
    if (!validatePassword(newPassword)) {
      return sendError(res, "New password must be at least 4 characters", 400)
    }

    const query = { _id: id }

    // Filter based on user type
    if (type === "delivery_man") {
      // Delivery man can only change their own password
      query._id = req.user.deliveryManId || req.user.id
    } else if (type === "distributor_admin") {
      query.distributorId = distributorId
    }

    const deliveryMan = await DeliveryMan.findOne(query)

    if (!deliveryMan) {
      return sendError(res, "Delivery man not found or access denied", 404)
    }

    // Verify current password (except for admin users)
    if (type === "delivery_man") {
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, deliveryMan.password)
      if (!isCurrentPasswordValid) {
        return sendError(res, "Current password is incorrect", 400)
      }
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    deliveryMan.password = hashedNewPassword
    await deliveryMan.save()

    console.log("✅ Password changed for delivery man:", id)
    return sendSuccess(res, null, "Password changed successfully")
  }),
)

router.put(
  "/:id/toggle-status",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params
    const { type, distributorId } = req.user

    const query = { _id: id }

    // Filter based on user type
    if (type === "distributor_admin") {
      query.distributorId = distributorId
    }

    // Find the delivery man first
    const deliveryMan = await DeliveryMan.findOne(query)

    if (!deliveryMan) {
      return sendError(res, "Delivery man not found or access denied", 404)
    }

    // Toggle the isActive status
    const newStatus = !deliveryMan.isActive
    
    const updatedDeliveryMan = await DeliveryMan.findOneAndUpdate(
      query, 
      { isActive: newStatus }, 
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("distributorId", "agencyName sapCode")
      .select("-password")

    const statusText = newStatus ? "activated" : "deactivated"
    console.log(`✅ Delivery man ${statusText}:`, updatedDeliveryMan._id)
    
    return sendSuccess(
      res, 
      { 
        deliveryMan: updatedDeliveryMan,
        previousStatus: !newStatus,
        currentStatus: newStatus
      }, 
      `Delivery man ${statusText} successfully`
    )
  }),
)

module.exports = router
