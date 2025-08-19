const express = require("express")
const mongoose = require("mongoose")
const Product = require("../models/Product")
const { sendSuccess, sendError, asyncHandler } = require("../utils/errorHandler")
const auth = require("../middleware/auth")

const router = express.Router()

// Create new product
router.post(
  "/",
  auth,
  asyncHandler(async (req, res) => {
    const {
      name,
      type,
      serialNumber,
      distributorId,
      capacity,
      weight,
      manufacturingDate,
      expiryDate,
      price,
      description,
      stock,
    } = req.body

    // Validate required fields
    if (!name || !type || !serialNumber || !distributorId) {
      return sendError(res, "Missing required fields: name, type, serialNumber, distributorId")
    }

    // Check if serial number already exists
    const existingProduct = await Product.findOne({ serialNumber })
    if (existingProduct) {
      return sendError(res, "Product with this serial number already exists", 409)
    }

    // Create product
    const product = new Product({
      name,
      type,
      serialNumber,
      distributorId,
      capacity,
      weight,
      manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : undefined,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      price: price || 0,
      description,
      stock: stock || 0,
      isActive: true,
    })

    await product.save()

    return sendSuccess(
      res,
      {
        product,
      },
      "Product created successfully",
    )
  }),
)

// Get products
router.get(
  "/",
  auth,
  asyncHandler(async (req, res) => {
    const { distributorId, type, isActive = true, page = 1, limit = 20, search } = req.query

    // Build filter
    const filter = {}

    if (distributorId) filter.distributorId = distributorId
    if (type) filter.type = type
    if (isActive !== undefined) filter.isActive = isActive === "true"

    // Role-based filtering
    if (req.user.role === "distributor_admin") {
      filter.distributorId = req.user.distributorId
    }

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { serialNumber: { $regex: search, $options: "i" } },
        { type: { $regex: search, $options: "i" } },
      ]
    }

    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("distributorId", "companyName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number.parseInt(limit)),
      Product.countDocuments(filter),
    ])

    return sendSuccess(
      res,
      {
        products,
        pagination: {
          page: Number.parseInt(page),
          limit: Number.parseInt(limit),
          total,
          pages: Math.ceil(total / Number.parseInt(limit)),
        },
      },
      "Products fetched successfully",
    )
  }),
)

// Get product by ID
router.get(
  "/:id",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid product ID", 400)
    }

    const product = await Product.findById(id).populate("distributorId", "companyName ownerName")

    if (!product) {
      return sendError(res, "Product not found", 404)
    }

    return sendSuccess(res, { product }, "Product fetched successfully")
  }),
)

// Update product
router.put(
  "/:id",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params
    const updates = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid product ID", 400)
    }

    const product = await Product.findById(id)
    if (!product) {
      return sendError(res, "Product not found", 404)
    }

    // Check permissions
    if (req.user.role === "distributor_admin" && product.distributorId.toString() !== req.user.distributorId) {
      return sendError(res, "Access denied", 403)
    }

    // Update product
    Object.assign(product, updates)
    product.updatedAt = new Date()
    await product.save()

    const updatedProduct = await Product.findById(id).populate("distributorId", "companyName ownerName")

    return sendSuccess(
      res,
      {
        product: updatedProduct,
      },
      "Product updated successfully",
    )
  }),
)

// Update product stock
router.patch(
  "/:id/stock",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params
    const { stock, operation = "set" } = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid product ID", 400)
    }

    if (stock === undefined || stock < 0) {
      return sendError(res, "Valid stock quantity is required")
    }

    const product = await Product.findById(id)
    if (!product) {
      return sendError(res, "Product not found", 404)
    }

    // Check permissions
    if (req.user.role === "distributor_admin" && product.distributorId.toString() !== req.user.distributorId) {
      return sendError(res, "Access denied", 403)
    }

    // Update stock based on operation
    switch (operation) {
      case "add":
        product.stock += Number.parseInt(stock)
        break
      case "subtract":
        product.stock = Math.max(0, product.stock - Number.parseInt(stock))
        break
      case "set":
      default:
        product.stock = Number.parseInt(stock)
        break
    }

    product.updatedAt = new Date()
    await product.save()

    return sendSuccess(
      res,
      {
        product: {
          id: product._id,
          name: product.name,
          serialNumber: product.serialNumber,
          stock: product.stock,
        },
      },
      "Product stock updated successfully",
    )
  }),
)

// Delete product
router.delete(
  "/:id",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid product ID", 400)
    }

    const product = await Product.findById(id)
    if (!product) {
      return sendError(res, "Product not found", 404)
    }

    // Check permissions
    if (
      req.user.role !== "super_admin" &&
      (req.user.role !== "distributor_admin" || product.distributorId.toString() !== req.user.distributorId)
    ) {
      return sendError(res, "Access denied", 403)
    }

    // Soft delete - mark as inactive
    product.isActive = false
    product.updatedAt = new Date()
    await product.save()

    return sendSuccess(
      res,
      {
        message: "Product deleted successfully",
      },
      "Product deleted",
    )
  }),
)

// Get product types
router.get(
  "/meta/types",
  auth,
  asyncHandler(async (req, res) => {
    const types = await Product.distinct("type", { isActive: true })

    return sendSuccess(
      res,
      {
        types: types.filter((type) => type), // Remove null/undefined values
      },
      "Product types fetched successfully",
    )
  }),
)

module.exports = router
