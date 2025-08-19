const express = require("express")
const router = express.Router()
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const { sendSuccess, sendError, asyncHandler, authenticateToken } = require("../utils/errorHandler")
const Distributor = require("../models/Distributor")
const DistributorRequest = require("../models/DistributorRequest")
const Inspection = require("../models/Inspection")

// Super Admin authentication middleware
const authenticateSuperAdmin = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return sendError(res, "Access token required", 401)
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return sendError(res, "Invalid or expired token", 403)
    }

    if (user.role !== "super_admin") {
      return sendError(res, "Super admin access required", 403)
    }

    req.user = user
    next()
  })
}

// Get dashboard statistics for super admin
router.get(
  "/dashboard-stats",
  authenticateSuperAdmin,
  asyncHandler(async (req, res) => {
    try {
      // Get total distributors
      const totalDistributors = await Distributor.countDocuments({ status: "approved" })

      // Get pending requests
      const pendingRequests = await DistributorRequest.countDocuments({ status: "pending" })

      // Get total inspections across all distributors
      const totalInspections = await Inspection.countDocuments()

      // Get monthly statistics
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const monthlyInspections = await Inspection.countDocuments({
        createdAt: { $gte: startOfMonth },
      })

      const monthlyDistributors = await Distributor.countDocuments({
        createdAt: { $gte: startOfMonth },
        status: "approved",
      })

      // Get recent activity
      const recentRequests = await DistributorRequest.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("companyName contactPerson phone email status createdAt")

      const stats = {
        totalDistributors,
        pendingRequests,
        totalInspections,
        monthlyInspections,
        monthlyDistributors,
        recentRequests,
      }

      sendSuccess(res, stats, "Super admin dashboard statistics retrieved successfully")
    } catch (error) {
      console.error("Super admin dashboard error:", error)
      sendError(res, "Failed to retrieve dashboard statistics", 500, error.message)
    }
  }),
)

// Get all distributor requests
router.get(
  "/distributor-requests",
  authenticateSuperAdmin,
  asyncHandler(async (req, res) => {
    try {
      const { status = "pending", page = 1, limit = 10 } = req.query

      const requests = await DistributorRequest.find({ status })
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)

      const total = await DistributorRequest.countDocuments({ status })

      sendSuccess(
        res,
        {
          requests,
          pagination: {
            current: Number.parseInt(page),
            total: Math.ceil(total / limit),
            count: requests.length,
            totalRecords: total,
          },
        },
        "Distributor requests retrieved successfully",
      )
    } catch (error) {
      console.error("Get distributor requests error:", error)
      sendError(res, "Failed to retrieve distributor requests", 500, error.message)
    }
  }),
)

// Approve distributor request
router.post(
  "/approve-distributor/:requestId",
  authenticateSuperAdmin,
  asyncHandler(async (req, res) => {
    try {
      const { requestId } = req.params

      // Find the request
      const request = await DistributorRequest.findById(requestId)
      if (!request) {
        return sendError(res, "Distributor request not found", 404)
      }

      if (request.status !== "pending") {
        return sendError(res, "Request has already been processed", 400)
      }

      // Generate SAP code (6-digit unique number)
      let sapCode
      let isUnique = false
      while (!isUnique) {
        sapCode = Math.floor(100000 + Math.random() * 900000).toString()
        const existingDistributor = await Distributor.findOne({ sapCode })
        if (!existingDistributor) {
          isUnique = true
        }
      }

      // Create distributor account
      const hashedPassword = await bcrypt.hash(request.password, 10)

      const distributor = new Distributor({
        sapCode,
        companyName: request.companyName,
        contactPerson: request.contactPerson,
        phone: request.phone,
        email: request.email,
        address: request.address,
        password: hashedPassword,
        status: "approved",
        approvedBy: req.user.id,
        approvedAt: new Date(),
      })

      await distributor.save()

      // Update request status
      request.status = "approved"
      request.sapCode = sapCode
      request.processedBy = req.user.id
      request.processedAt = new Date()
      await request.save()

      sendSuccess(
        res,
        {
          distributor: {
            id: distributor._id,
            sapCode: distributor.sapCode,
            companyName: distributor.companyName,
            contactPerson: distributor.contactPerson,
            phone: distributor.phone,
            email: distributor.email,
          },
        },
        "Distributor approved successfully",
      )
    } catch (error) {
      console.error("Approve distributor error:", error)
      sendError(res, "Failed to approve distributor", 500, error.message)
    }
  }),
)

// Reject distributor request
router.post(
  "/reject-distributor/:requestId",
  authenticateSuperAdmin,
  asyncHandler(async (req, res) => {
    try {
      const { requestId } = req.params
      const { reason } = req.body

      if (!reason) {
        return sendError(res, "Rejection reason is required", 400)
      }

      // Find the request
      const request = await DistributorRequest.findById(requestId)
      if (!request) {
        return sendError(res, "Distributor request not found", 404)
      }

      if (request.status !== "pending") {
        return sendError(res, "Request has already been processed", 400)
      }

      // Update request status
      request.status = "rejected"
      request.rejectionReason = reason
      request.processedBy = req.user.id
      request.processedAt = new Date()
      await request.save()

      sendSuccess(res, { requestId }, "Distributor request rejected successfully")
    } catch (error) {
      console.error("Reject distributor error:", error)
      sendError(res, "Failed to reject distributor request", 500, error.message)
    }
  }),
)

// Get all approved distributors
router.get(
  "/distributors",
  authenticateSuperAdmin,
  asyncHandler(async (req, res) => {
    try {
      const { page = 1, limit = 10, search = "" } = req.query

      const query = { status: "approved" }
      if (search) {
        query.$or = [
          { companyName: { $regex: search, $options: "i" } },
          { contactPerson: { $regex: search, $options: "i" } },
          { sapCode: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ]
      }

      const distributors = await Distributor.find(query)
        .select("-password")
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)

      const total = await Distributor.countDocuments(query)

      sendSuccess(
        res,
        {
          distributors,
          pagination: {
            current: Number.parseInt(page),
            total: Math.ceil(total / limit),
            count: distributors.length,
            totalRecords: total,
          },
        },
        "Distributors retrieved successfully",
      )
    } catch (error) {
      console.error("Get distributors error:", error)
      sendError(res, "Failed to retrieve distributors", 500, error.message)
    }
  }),
)

module.exports = router
