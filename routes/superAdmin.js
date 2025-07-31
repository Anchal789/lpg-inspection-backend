const express = require("express")
const bcrypt = require("bcryptjs")
const Distributor = require("../models/Distributor")
const DeliveryMan = require("../models/DeliveryMan")
const DistributorRequest = require("../models/DistributorRequest")
const Inspection = require("../models/Inspection")
const { authenticateToken, requireSuperAdmin } = require("../middleware/auth")

const router = express.Router()

// Get all pending distributor requests
router.get("/distributor-requests", authenticateToken, requireSuperAdmin, async (req, res, next) => {
  try {
    const requests = await DistributorRequest.find({ status: "pending" }).sort({ requestedAt: -1 })

    res.json({
      success: true,
      data: requests,
    })
  } catch (error) {
    next(error)
  }
})

// Approve distributor request
router.post("/approve-distributor/:requestId", authenticateToken, requireSuperAdmin, async (req, res, next) => {
  try {
    const { requestId } = req.params

    const request = await DistributorRequest.findById(requestId)
    if (!request) {
      return res.status(404).json({
        success: false,
        error: "Request not found",
      })
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: "Request already processed",
      })
    }

    // Create distributor
    const distributor = new Distributor({
      sapCode: request.sapCode,
      agencyName: request.agencyName,
      adminName: request.adminName,
      password: request.password,
    })

    await distributor.save()

    // Create delivery men
    if (request.deliveryMen && request.deliveryMen.length > 0) {
      const deliveryMenData = request.deliveryMen.map((dm) => ({
        distributorId: distributor._id,
        name: dm.name,
        phone: dm.phone,
        password: dm.password,
      }))

      await DeliveryMan.insertMany(deliveryMenData)
    }

    // Update request status
    request.status = "approved"
    request.reviewedAt = new Date()
    request.reviewedBy = req.user.id
    await request.save()

    res.json({
      success: true,
      message: "Distributor approved successfully",
      data: {
        distributorId: distributor._id,
        sapCode: distributor.sapCode,
      },
    })
  } catch (error) {
    next(error)
  }
})

// Reject distributor request
router.post("/reject-distributor/:requestId", authenticateToken, requireSuperAdmin, async (req, res, next) => {
  try {
    const { requestId } = req.params
    const { reason } = req.body

    const request = await DistributorRequest.findById(requestId)
    if (!request) {
      return res.status(404).json({
        success: false,
        error: "Request not found",
      })
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: "Request already processed",
      })
    }

    // Update request status
    request.status = "rejected"
    request.reviewedAt = new Date()
    request.reviewedBy = req.user.id
    request.rejectionReason = reason || "No reason provided"
    await request.save()

    res.json({
      success: true,
      message: "Distributor request rejected",
      data: {
        requestId: request._id,
        reason: request.rejectionReason,
      },
    })
  } catch (error) {
    next(error)
  }
})

// Get super admin dashboard stats
router.get("/dashboard-stats", authenticateToken, requireSuperAdmin, async (req, res, next) => {
  try {
    const [totalDistributors, totalDeliveryMen, totalInspections, pendingRequests, todayInspections] =
      await Promise.all([
        Distributor.countDocuments({ isActive: true }),
        DeliveryMan.countDocuments({ isActive: true }),
        Inspection.countDocuments(),
        DistributorRequest.countDocuments({ status: "pending" }),
        Inspection.countDocuments({
          inspectionDate: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            $lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        }),
      ])

    // Get total sales
    const salesResult = await Inspection.aggregate([{ $group: { _id: null, totalSales: { $sum: "$totalAmount" } } }])
    const totalSales = salesResult.length > 0 ? salesResult[0].totalSales : 0

    res.json({
      success: true,
      data: {
        totalDistributors,
        totalDeliveryMen,
        totalInspections,
        pendingRequests,
        todayInspections,
        totalSales,
      },
    })
  } catch (error) {
    next(error)
  }
})

// Get all distributors
router.get("/distributors", authenticateToken, requireSuperAdmin, async (req, res, next) => {
  try {
    const distributors = await Distributor.find({ isActive: true }).select("-password").sort({ createdAt: -1 })

    res.json({
      success: true,
      data: distributors,
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
