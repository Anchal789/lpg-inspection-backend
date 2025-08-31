const express = require("express")
const Product = require("../models/Product")
const Distributor = require("../models/Distributor")
const { sendSuccess, sendError, asyncHandler } = require("../utils/errorHandler")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

// Apply authentication to all routes
router.use(authenticateToken)

// Get products
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { type, distributorId } = req.user
    const { page = 1, limit = 10, search, productType } = req.query

    console.log("📋 Fetching products for:", type, distributorId)

    const query = {}

    // Filter based on user type - super admin sees all, others see only their distributor's products
    if (type !== "super_admin" && distributorId) {
      query.distributorId = distributorId
    }

    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { serialNumber: { $regex: search, $options: "i" } },
        { model: { $regex: search, $options: "i" } },
      ]
    }

    // Add product type filter
    if (productType) {
      query.type = productType
    }

    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate("distributorId", "agencyName sapCode")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number.parseInt(limit)),
      Product.countDocuments(query),
    ])

    const totalPages = Math.ceil(total / Number.parseInt(limit))

    console.log(`✅ Found ${products.length} products (${total} total)`)
    return sendSuccess(
      res,
      {
        products,
        pagination: {
          currentPage: Number.parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: Number.parseInt(limit),
        },
      },
      "Products fetched successfully",
    )
  }),
)

// Get single product
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params
    const { type, distributorId } = req.user

    console.log("🔍 Fetching product:", id)

    const query = { _id: id }

    // Filter based on user type
    if (type !== "super_admin" && distributorId) {
      query.distributorId = distributorId
    }

    const product = await Product.findOne(query).populate("distributorId", "agencyName sapCode")

    if (!product) {
      return sendError(res, "Product not found", 404)
    }

    return sendSuccess(res, { product }, "Product fetched successfully")
  }),
)

// Create product
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { type, distributorId } = req.user

    console.log("📦 Creating product with payload:", req.body)

    // Handle both frontend formats - the AddProduct component sends different field names
    const {
      name,
      type: productType,
      model,
      serialNumber,
      manufacturingDate,
      capacity,
      specifications,
      // Frontend payload fields
      price,
      minPrice,
      quantity
    } = req.body

    // Validate required fields - handle both formats
    if (!name) {
      return sendError(res, "Product name is required", 400)
    }

    // For non-super admin users, use their distributorId
    let productDistributorId = distributorId
    if (type === "super_admin" && req.body.distributorId) {
      productDistributorId = req.body.distributorId
    }

    if (!productDistributorId) {
      return sendError(res, "Distributor ID is required", 400)
    }

    // Check if product with the same name already exists for this distributor
    const existingProductByName = await Product.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }, // Case insensitive exact match
      distributorId: productDistributorId,
    })

    if (existingProductByName) {
      return sendError(res, "Product with this name already exists", 400)
    }

    // Check if serial number already exists for this distributor (if provided)
    if (serialNumber) {
      const existingProductBySerial = await Product.findOne({
        serialNumber,
        distributorId: productDistributorId,
      })

      if (existingProductBySerial) {
        return sendError(res, "Product with this serial number already exists", 400)
      }
    }

    // Create product with both possible field mappings
    const productData = {
      distributorId: productDistributorId,
      name: name.trim(),
      type: productType || "other", // Default type if not provided
      model,
      serialNumber,
      manufacturingDate,
      capacity,
      specifications,
      status: "active",
    }

    // Add frontend-specific fields if they exist
    if (price !== undefined) {
      productData.price = parseFloat(price)
    }
    if (minPrice !== undefined) {
      productData.minPrice = parseFloat(minPrice)
    }
    if (quantity !== undefined) {
      productData.quantity = parseInt(quantity)
      productData.stock = parseInt(quantity) // Also set stock field
    }

    const product = new Product(productData)

    await product.save()

    // Populate the created product
    await product.populate("distributorId", "agencyName sapCode")

    console.log("✅ Product created:", product._id)
    return sendSuccess(res, { product }, "Product created successfully", 201)
  }),
)

// Update product
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params
    const { type, distributorId } = req.user

    console.log("📝 Updating product:", id)

    const query = { _id: id }

    // Filter based on user type
    if (type !== "super_admin" && distributorId) {
      query.distributorId = distributorId
    }

    // Check if updating name and if it would create a duplicate
    if (req.body.name) {
      const existingProduct = await Product.findOne({
        name: { $regex: new RegExp(`^${req.body.name.trim()}$`, 'i') },
        distributorId: type !== "super_admin" ? distributorId : (req.body.distributorId || distributorId),
        _id: { $ne: id } // Exclude current product from check
      })

      if (existingProduct) {
        return sendError(res, "Product with this name already exists", 400)
      }
    }

    // Check if updating serial number and if it would create a duplicate
    if (req.body.serialNumber) {
      const existingProduct = await Product.findOne({
        serialNumber: req.body.serialNumber,
        distributorId: type !== "super_admin" ? distributorId : (req.body.distributorId || distributorId),
        _id: { $ne: id } // Exclude current product from check
      })

      if (existingProduct) {
        return sendError(res, "Product with this serial number already exists", 400)
      }
    }

    // Don't allow changing distributorId unless super admin
    if (type !== "super_admin") {
      delete req.body.distributorId
    }

    // Handle frontend field mappings
    const updateData = { ...req.body }
    if (req.body.price !== undefined) {
      updateData.price = parseFloat(req.body.price)
    }
    if (req.body.minPrice !== undefined) {
      updateData.minPrice = parseFloat(req.body.minPrice)
    }
    if (req.body.quantity !== undefined) {
      updateData.quantity = parseInt(req.body.quantity)
      updateData.stock = parseInt(req.body.quantity)
    }

    const product = await Product.findOneAndUpdate(query, updateData, {
      new: true,
      runValidators: true,
    }).populate("distributorId", "agencyName sapCode")

    if (!product) {
      return sendError(res, "Product not found or access denied", 404)
    }

    console.log("✅ Product updated:", product._id)
    return sendSuccess(res, { product }, "Product updated successfully")
  }),
)

// Delete product
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params
    const { type, distributorId } = req.user

    console.log("🗑️ Deleting product:", id)

    const query = { _id: id }

    // Filter based on user type
    if (type !== "super_admin" && distributorId) {
      query.distributorId = distributorId
    }

    const product = await Product.findOneAndDelete(query)

    if (!product) {
      return sendError(res, "Product not found or access denied", 404)
    }

    console.log("✅ Product deleted:", id)
    return sendSuccess(res, null, "Product deleted successfully")
  }),
)

// Get product types
router.get(
  "/types/list",
  asyncHandler(async (req, res) => {
    console.log("📋 Fetching product types")

    const productTypes = [
      { value: "cylinder", label: "LPG Cylinder" },
      { value: "regulator", label: "Regulator" },
      { value: "hose", label: "Gas Hose" },
      { value: "stove", label: "Gas Stove" },
      { value: "heater", label: "Gas Heater" },
      { value: "other", label: "Other" },
    ]

    return sendSuccess(res, { productTypes }, "Product types fetched successfully")
  }),
)

// Check if product name exists (utility endpoint)
router.post(
  "/check-duplicate",
  asyncHandler(async (req, res) => {
    const { type, distributorId } = req.user
    const { name, serialNumber, excludeId } = req.body

    const query = {}
    
    // Filter based on user type
    if (type !== "super_admin" && distributorId) {
      query.distributorId = distributorId
    }

    // Exclude current product if updating
    if (excludeId) {
      query._id = { $ne: excludeId }
    }

    let isDuplicate = false
    let message = ""

    // Check name duplicate
    if (name) {
      const existingByName = await Product.findOne({
        ...query,
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
      })
      
      if (existingByName) {
        isDuplicate = true
        message = "Product with this name already exists"
      }
    }

    // Check serial number duplicate
    if (!isDuplicate && serialNumber) {
      const existingBySerial = await Product.findOne({
        ...query,
        serialNumber
      })
      
      if (existingBySerial) {
        isDuplicate = true
        message = "Product with this serial number already exists"
      }
    }

    return sendSuccess(res, { isDuplicate, message }, "Duplicate check completed")
  }),
)

module.exports = router