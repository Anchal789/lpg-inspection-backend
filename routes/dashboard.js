const express = require("express")
const router = express.Router()
const { sendSuccess, sendError, asyncHandler, authenticateToken } = require("../utils/errorHandler")
const Inspection = require("../models/Inspection")
const Product = require("../models/Product")
const DeliveryMan = require("../models/DeliveryMan")

// Get dashboard statistics
router.get(
  "/stats",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { distributorId } = req.query

    if (!distributorId) {
      return sendError(res, "Distributor ID is required", 400)
    }

    try {
      // Get total inspections
      const totalInspections = await Inspection.countDocuments({ distributorId })

      // Get inspections this month
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const monthlyInspections = await Inspection.countDocuments({
        distributorId,
        createdAt: { $gte: startOfMonth },
      })

      // Get total products
      const totalProducts = await Product.countDocuments({ distributorId })

      // Get total delivery men
      const totalDeliveryMen = await DeliveryMan.countDocuments({ distributorId })

      // Get recent inspections
      const recentInspections = await Inspection.find({ distributorId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("deliveryManId", "name phone")
        .populate("productId", "name type")

      // Get inspection status breakdown
      const statusBreakdown = await Inspection.aggregate([
        { $match: { distributorId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])

      const stats = {
        totalInspections,
        monthlyInspections,
        totalProducts,
        totalDeliveryMen,
        recentInspections,
        statusBreakdown,
      }

      sendSuccess(res, stats, "Dashboard statistics retrieved successfully")
    } catch (error) {
      console.error("Dashboard stats error:", error)
      sendError(res, "Failed to retrieve dashboard statistics", 500, error.message)
    }
  }),
)

// Get weekly report
router.get(
  "/weekly-report",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { distributorId, week } = req.query

    if (!distributorId) {
      return sendError(res, "Distributor ID is required", 400)
    }

    try {
      // Calculate week start and end dates
      const weekNumber = Number.parseInt(week) || 0
      const startOfWeek = new Date()
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() - weekNumber * 7)
      startOfWeek.setHours(0, 0, 0, 0)

      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(endOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59, 999)

      // Get inspections for the week
      const weeklyInspections = await Inspection.find({
        distributorId,
        createdAt: { $gte: startOfWeek, $lte: endOfWeek },
      })
        .populate("deliveryManId", "name phone")
        .populate("productId", "name type")
        .sort({ createdAt: -1 })

      // Group by day
      const dailyBreakdown = {}
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

      days.forEach((day, index) => {
        dailyBreakdown[day] = weeklyInspections.filter((inspection) => {
          return new Date(inspection.createdAt).getDay() === index
        })
      })

      const report = {
        weekStart: startOfWeek,
        weekEnd: endOfWeek,
        totalInspections: weeklyInspections.length,
        dailyBreakdown,
        inspections: weeklyInspections,
      }

      sendSuccess(res, report, "Weekly report retrieved successfully")
    } catch (error) {
      console.error("Weekly report error:", error)
      sendError(res, "Failed to retrieve weekly report", 500, error.message)
    }
  }),
)

module.exports = router
