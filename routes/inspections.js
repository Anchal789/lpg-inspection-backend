const express = require("express")
const mongoose = require("mongoose")
const Inspection = require("../models/Inspection")
const DeliveryMan = require("../models/DeliveryMan")
const Product = require("../models/Product")
const { sendSuccess, sendError, asyncHandler } = require("../utils/errorHandler")
const auth = require("../middleware/auth")

const router = express.Router()

// Create new inspection
router.post(
  "/",
  auth,
  asyncHandler(async (req, res) => {
    const {
      deliveryManId,
      distributorId,
      customerName,
      customerPhone,
      customerAddress,
      products,
      inspectionQuestions,
      totalAmount,
      notes,
      images,
    } = req.body

    // Validate required fields
    if (!deliveryManId || !distributorId || !customerName || !products || !products.length) {
      return sendError(res, "Missing required fields")
    }

    // Verify delivery man exists
    const deliveryMan = await DeliveryMan.findById(deliveryManId)
    if (!deliveryMan) {
      return sendError(res, "Delivery man not found", 404)
    }

    // Create inspection
    const inspection = new Inspection({
      deliveryManId,
      distributorId,
      customerName,
      customerPhone,
      customerAddress,
      products,
      inspectionQuestions: inspectionQuestions || {},
      totalAmount: totalAmount || 0,
      notes,
      images: images || [],
      inspectionDate: new Date(),
      status: "completed",
    })

    await inspection.save()

    // Populate the created inspection
    const populatedInspection = await Inspection.findById(inspection._id)
      .populate("deliveryManId", "name phone sapCode")
      .populate("products.productId", "name type serialNumber")

    return sendSuccess(
      res,
      {
        inspection: populatedInspection,
      },
      "Inspection created successfully",
    )
  }),
)

// Get inspections
router.get(
  "/",
  auth,
  asyncHandler(async (req, res) => {
    const { deliveryManId, distributorId, status, page = 1, limit = 20, startDate, endDate } = req.query

    // Build filter
    const filter = {}

    if (deliveryManId) filter.deliveryManId = deliveryManId
    if (distributorId) filter.distributorId = distributorId
    if (status) filter.status = status

    if (startDate || endDate) {
      filter.inspectionDate = {}
      if (startDate) filter.inspectionDate.$gte = new Date(startDate)
      if (endDate) filter.inspectionDate.$lte = new Date(endDate)
    }

    // Role-based filtering
    if (req.user.role === "delivery_man") {
      filter.deliveryManId = req.user.id
    } else if (req.user.role === "distributor_admin") {
      filter.distributorId = req.user.distributorId
    }

    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)

    const [inspections, total] = await Promise.all([
      Inspection.find(filter)
        .populate("deliveryManId", "name phone sapCode")
        .populate("products.productId", "name type serialNumber")
        .sort({ inspectionDate: -1 })
        .skip(skip)
        .limit(Number.parseInt(limit)),
      Inspection.countDocuments(filter),
    ])

    return sendSuccess(
      res,
      {
        inspections,
        pagination: {
          page: Number.parseInt(page),
          limit: Number.parseInt(limit),
          total,
          pages: Math.ceil(total / Number.parseInt(limit)),
        },
      },
      "Inspections fetched successfully",
    )
  }),
)

// Get inspection by ID
router.get(
  "/:id",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid inspection ID", 400)
    }

    const inspection = await Inspection.findById(id)
      .populate("deliveryManId", "name phone sapCode")
      .populate("products.productId", "name type serialNumber")

    if (!inspection) {
      return sendError(res, "Inspection not found", 404)
    }

    // Check permissions
    if (req.user.role === "delivery_man" && inspection.deliveryManId._id.toString() !== req.user.id) {
      return sendError(res, "Access denied", 403)
    }

    return sendSuccess(res, { inspection }, "Inspection fetched successfully")
  }),
)

// Search inspections
router.get(
  "/search/query",
  auth,
  asyncHandler(async (req, res) => {
    const { q, sapCode, customerName, customerPhone, startDate, endDate, page = 1, limit = 20 } = req.query

    const filter = {}

    // Role-based filtering
    if (req.user.role === "delivery_man") {
      filter.deliveryManId = req.user.id
    } else if (req.user.role === "distributor_admin") {
      filter.distributorId = req.user.distributorId
    }

    // Date range filter
    if (startDate || endDate) {
      filter.inspectionDate = {}
      if (startDate) filter.inspectionDate.$gte = new Date(startDate)
      if (endDate) filter.inspectionDate.$lte = new Date(endDate)
    }

    // Text search filters
    if (customerName) {
      filter.customerName = { $regex: customerName, $options: "i" }
    }

    if (customerPhone) {
      filter.customerPhone = { $regex: customerPhone, $options: "i" }
    }

    const inspections = []

    if (sapCode) {
      // Search by SAP code (delivery man)
      const deliveryMen = await DeliveryMan.find({
        sapCode: { $regex: sapCode, $options: "i" },
      }).select("_id")

      if (deliveryMen.length > 0) {
        filter.deliveryManId = { $in: deliveryMen.map((dm) => dm._id) }
      } else {
        // No delivery men found with this SAP code
        return sendSuccess(
          res,
          {
            inspections: [],
            pagination: { page: 1, limit: Number.parseInt(limit), total: 0, pages: 0 },
          },
          "No inspections found",
        )
      }
    }

    if (q) {
      // General text search
      filter.$or = [
        { customerName: { $regex: q, $options: "i" } },
        { customerPhone: { $regex: q, $options: "i" } },
        { notes: { $regex: q, $options: "i" } },
      ]
    }

    const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)

    const [searchResults, total] = await Promise.all([
      Inspection.find(filter)
        .populate("deliveryManId", "name phone sapCode")
        .populate("products.productId", "name type serialNumber")
        .sort({ inspectionDate: -1 })
        .skip(skip)
        .limit(Number.parseInt(limit)),
      Inspection.countDocuments(filter),
    ])

    return sendSuccess(
      res,
      {
        inspections: searchResults,
        pagination: {
          page: Number.parseInt(page),
          limit: Number.parseInt(limit),
          total,
          pages: Math.ceil(total / Number.parseInt(limit)),
        },
      },
      "Search completed successfully",
    )
  }),
)

// Update inspection
router.put(
  "/:id",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params
    const updates = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid inspection ID", 400)
    }

    const inspection = await Inspection.findById(id)
    if (!inspection) {
      return sendError(res, "Inspection not found", 404)
    }

    // Check permissions
    if (req.user.role === "delivery_man" && inspection.deliveryManId.toString() !== req.user.id) {
      return sendError(res, "Access denied", 403)
    }

    // Update inspection
    Object.assign(inspection, updates)
    inspection.updatedAt = new Date()
    await inspection.save()

    const updatedInspection = await Inspection.findById(id)
      .populate("deliveryManId", "name phone sapCode")
      .populate("products.productId", "name type serialNumber")

    return sendSuccess(
      res,
      {
        inspection: updatedInspection,
      },
      "Inspection updated successfully",
    )
  }),
)

// Delete inspection
router.delete(
  "/:id",
  auth,
  asyncHandler(async (req, res) => {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid inspection ID", 400)
    }

    const inspection = await Inspection.findById(id)
    if (!inspection) {
      return sendError(res, "Inspection not found", 404)
    }

    // Only super admin or the delivery man who created it can delete
    if (
      req.user.role !== "super_admin" &&
      (req.user.role !== "delivery_man" || inspection.deliveryManId.toString() !== req.user.id)
    ) {
      return sendError(res, "Access denied", 403)
    }

    await Inspection.findByIdAndDelete(id)

    return sendSuccess(
      res,
      {
        message: "Inspection deleted successfully",
      },
      "Inspection deleted",
    )
  }),
)

module.exports = router
