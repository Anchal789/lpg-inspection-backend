const express = require("express")
const bcrypt = require("bcryptjs")
const mongoose = require("mongoose")
const DeliveryMan = require("../models/DeliveryMan")
const Product = require("../models/Product")
const Inspection = require("../models/Inspection")
const { validateDeliveryManData, validateObjectId } = require("../utils/validators")
const { sendSuccess, sendError, asyncHandler } = require("../utils/errorHandler")
const auth = require("../middleware/auth")

const router = express.Router()

// Get delivery men for a distributor
router.get(
  "/",
  auth,
  asyncHandler(async (req, res) => {
    const { distributorId } = req.query

    if (!distributorId) {
      return sendError(res, "Distributor ID is required", 400)
    }

    const deliveryMen = await DeliveryMan.find({
      distributorId,
      isActive: true,
    })
      .select("-password")
      .sort({ createdAt: -1 })

    return sendSuccess(res, deliveryMen, "Delivery men fetched successfully")
  }),
)

// Get all delivery men (with pagination and filters)
router.get(
  "/all",
  auth,
  asyncHandler(async (req, res) => {
    try {
      const { page = 1, limit = 10, status, distributorId } = req.query

      const query = {}

      // Filter by status
      if (status) {
        query.status = status
      }

      // Filter by distributor
      if (distributorId && validateObjectId(distributorId)) {
        query.distributorId = distributorId
      }

      const deliveryMen = await DeliveryMan.find(query)
        .populate("distributorId", "name email phone")
        .select("-password")
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)

      const total = await DeliveryMan.countDocuments(query)

      res.json({
        success: true,
        deliveryMen,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
        },
      })
    } catch (error) {
      console.error("Get delivery men error:", error)
      sendError(res, error, "Failed to get delivery men")
    }
  }),
)

// Get delivery man by ID
router.get(
  "/:id",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid delivery man ID", 400)
    }

    const deliveryMan = await DeliveryMan.findById(id)
      .populate("distributorId", "companyName ownerName phone email")
      .select("-password")

    if (!deliveryMan) {
      return sendError(res, "Delivery man not found", 404)
    }

    // Get additional stats
    const [inspectionCount, recentInspections] = await Promise.all([
      Inspection.countDocuments({ deliveryManId: id }),
      Inspection.find({ deliveryManId: id })
        .populate("products.productId", "name type serialNumber")
        .sort({ inspectionDate: -1 })
        .limit(5),
    ])

    return sendSuccess(
      res,
      {
        deliveryMan: {
          ...deliveryMan.toObject(),
          inspectionCount,
          recentInspections,
        },
      },
      "Delivery man fetched successfully",
    )
  }),
)

// Create new delivery man
router.post(
  "/",
  auth,
  asyncHandler(async (req, res) => {
    console.log("👤 Creating new delivery man:", { ...req.body, password: "***" })

    const { name, phone, password, sapCode, distributorId } = req.body

    // Validate required fields
    if (!name || !phone || !password || !sapCode || !distributorId) {
      return sendError(res, "All fields are required")
    }

    // Check permissions
    if (req.user.role === "distributor_admin" && req.user.distributorId !== distributorId) {
      return sendError(res, "Access denied", 403)
    }

    // Check if SAP code already exists
    const existingSapCode = await DeliveryMan.findOne({ sapCode })
    if (existingSapCode) {
      return sendError(res, "SAP code already exists", 409)
    }

    // Check if phone already exists
    const existingPhone = await DeliveryMan.findOne({ phone })
    if (existingPhone) {
      return sendError(res, "Phone number already registered", 409)
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create delivery man
    const deliveryMan = new DeliveryMan({
      name,
      phone,
      password: hashedPassword,
      sapCode,
      distributorId,
      isActive: true,
    })

    await deliveryMan.save()

    // Return without password
    const deliveryManResponse = await DeliveryMan.findById(deliveryMan._id)
      .populate("distributorId", "companyName")
      .select("-password")

    return sendSuccess(
      res,
      {
        deliveryMan: deliveryManResponse,
      },
      "Delivery man created successfully",
    )
  }),
)

// Assign product to delivery man
router.post(
  "/:id/assign-product",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params
    const { productId, quantity = 1 } = req.body

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(productId)) {
      return sendError(res, "Invalid ID provided", 400)
    }

    const [deliveryMan, product] = await Promise.all([DeliveryMan.findById(id), Product.findById(productId)])

    if (!deliveryMan) {
      return sendError(res, "Delivery man not found", 404)
    }

    if (!product) {
      return sendError(res, "Product not found", 404)
    }

    // Check permissions
    if (req.user.role === "distributor_admin" && deliveryMan.distributorId.toString() !== req.user.distributorId) {
      return sendError(res, "Access denied", 403)
    }

    // Check if product belongs to the same distributor
    if (product.distributorId.toString() !== deliveryMan.distributorId.toString()) {
      return sendError(res, "Product does not belong to the same distributor", 400)
    }

    // Check stock availability
    if (product.stock < quantity) {
      return sendError(res, "Insufficient stock available", 400)
    }

    // Update product stock
    product.stock -= quantity
    await product.save()

    // Add to delivery man's assigned products
    if (!deliveryMan.assignedProducts) {
      deliveryMan.assignedProducts = []
    }

    const existingAssignment = deliveryMan.assignedProducts.find((ap) => ap.productId.toString() === productId)

    if (existingAssignment) {
      existingAssignment.quantity += quantity
      existingAssignment.assignedAt = new Date()
    } else {
      deliveryMan.assignedProducts.push({
        productId,
        quantity,
        assignedAt: new Date(),
      })
    }

    await deliveryMan.save()

    const updatedDeliveryMan = await DeliveryMan.findById(id)
      .populate("assignedProducts.productId", "name type serialNumber")
      .select("-password")

    return sendSuccess(
      res,
      {
        deliveryMan: updatedDeliveryMan,
        message: `${quantity} unit(s) of ${product.name} assigned successfully`,
      },
      "Product assigned successfully",
    )
  }),
)

// Update delivery man
router.put(
  "/:id",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params
    const updates = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid delivery man ID", 400)
    }

    const deliveryMan = await DeliveryMan.findById(id)
    if (!deliveryMan) {
      return sendError(res, "Delivery man not found", 404)
    }

    // Check permissions
    if (req.user.role === "distributor_admin" && deliveryMan.distributorId.toString() !== req.user.distributorId) {
      return sendError(res, "Access denied", 403)
    }

    // Handle password update
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10)
    }

    // Update delivery man
    Object.assign(deliveryMan, updates)
    deliveryMan.updatedAt = new Date()
    await deliveryMan.save()

    const updatedDeliveryMan = await DeliveryMan.findById(id)
      .populate("distributorId", "companyName")
      .select("-password")

    return sendSuccess(
      res,
      {
        deliveryMan: updatedDeliveryMan,
      },
      "Delivery man updated successfully",
    )
  }),
)

// Delete delivery man
router.delete(
  "/:id",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid delivery man ID", 400)
    }

    const deliveryMan = await DeliveryMan.findById(id)
    if (!deliveryMan) {
      return sendError(res, "Delivery man not found", 404)
    }

    // Check permissions
    if (req.user.role === "distributor_admin" && deliveryMan.distributorId.toString() !== req.user.distributorId) {
      return sendError(res, "Access denied", 403)
    }

    await DeliveryMan.findByIdAndDelete(id)

    return sendSuccess(
      res,
      {
        message: "Delivery man deleted successfully",
      },
      "Delivery man deleted",
    )
  }),
)

// Approve/Reject delivery man
router.patch(
  "/:id/status",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params
    const { status } = req.body

    if (!["approved", "rejected", "pending"].includes(status)) {
      return sendError(res, "Invalid status. Must be 'approved', 'rejected', or 'pending'", 400)
    }

    const deliveryMan = await DeliveryMan.findById(id)
    if (!deliveryMan) {
      return sendError(res, "Delivery man not found", 404)
    }

    deliveryMan.status = status
    deliveryMan.updatedAt = new Date()
    await deliveryMan.save()

    await deliveryMan.populate("distributorId", "name email phone")

    // Remove password from response
    const deliveryManResponse = deliveryMan.toObject()
    delete deliveryManResponse.password

    res.json({
      success: true,
      message: `Delivery man ${status} successfully`,
      deliveryMan: deliveryManResponse,
    })
  }),
)

// Get delivery men by distributor
router.get(
  "/distributor/:distributorId",
  auth,
  asyncHandler(async (req, res) => {
    const { distributorId } = req.params
    const { page = 1, limit = 10, status } = req.query

    if (!validateObjectId(distributorId)) {
      return sendError(res, "Invalid distributor ID", 400)
    }

    const query = { distributorId }
    if (status) {
      query.status = status
    }

    const deliveryMen = await DeliveryMan.find(query)
      .populate("distributorId", "name email phone")
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await DeliveryMan.countDocuments(query)

    res.json({
      success: true,
      deliveryMen,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    })
  }),
)

// Get assigned products for delivery man
router.get(
  "/:id/assigned-products",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid delivery man ID", 400)
    }

    const deliveryMan = await DeliveryMan.findById(id)
      .populate("assignedProducts.productId", "name type serialNumber price")
      .select("assignedProducts")

    if (!deliveryMan) {
      return sendError(res, "Delivery man not found", 404)
    }

    // Check permissions
    if (req.user.role === "delivery_man" && req.user.id !== id) {
      return sendError(res, "Access denied", 403)
    }

    return sendSuccess(
      res,
      {
        assignedProducts: deliveryMan.assignedProducts || [],
      },
      "Assigned products fetched successfully",
    )
  }),
)

// Deactivate delivery man
router.post(
  "/:id/deactivate",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid delivery man ID", 400)
    }

    const deliveryMan = await DeliveryMan.findById(id)
    if (!deliveryMan) {
      return sendError(res, "Delivery man not found", 404)
    }

    // Check permissions
    if (req.user.role === "distributor_admin" && deliveryMan.distributorId.toString() !== req.user.distributorId) {
      return sendError(res, "Access denied", 403)
    }

    deliveryMan.isActive = false
    deliveryMan.updatedAt = new Date()
    await deliveryMan.save()

    return sendSuccess(
      res,
      {
        message: "Delivery man deactivated successfully",
      },
      "Delivery man deactivated",
    )
  }),
)

module.exports = router
