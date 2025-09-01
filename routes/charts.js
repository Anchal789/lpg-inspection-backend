const express = require("express")
const Inspection = require("../models/Inspection")
const DeliveryMan = require("../models/DeliveryMan")
const { sendSuccess, sendError, asyncHandler } = require("../utils/errorHandler")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

// Apply authentication to all routes
router.use(authenticateToken)

// Get weekly inspection data for charts
router.get(
  "/weekly-inspections",
  asyncHandler(async (req, res) => {
    const { type, distributorId, deliveryManId } = req.user

    // Get last 7 days
    const days = []
    const today = new Date()

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      days.push({
        date: date.toISOString().split("T")[0],
        label: date.toLocaleDateString("en-US", { weekday: "short" }),
        fullDate: date,
      })
    }

    // Build query based on user type
    const query = {}
    if (type === "distributor_admin") {
      query.distributorId = distributorId
    } else if (type === "delivery_man") {
      query.deliveryManId = deliveryManId || req.user.id
    }
    // Super admin sees all data (no additional filter)

    const weeklyData = await Promise.all(
      days.map(async (day) => {
        const startDate = new Date(day.fullDate)
        startDate.setHours(0, 0, 0, 0)

        const endDate = new Date(day.fullDate)
        endDate.setHours(23, 59, 59, 999)

        const count = await Inspection.countDocuments({
          ...query,
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
        })

        return {
          day: day.label,
          count,
          date: day.date,
        }
      }),
    )

    return sendSuccess(res, { weeklyData }, "Weekly chart data fetched successfully")
  }),
)

// Get monthly inspection data for charts
router.get(
  "/monthly-inspections",
  asyncHandler(async (req, res) => {
    const { type, distributorId, deliveryManId } = req.user
    console.log("📊 Monthly chart data requested for:", type, distributorId)

    // Get last 6 months
    const months = []
    const currentDate = new Date()

    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      months.push({
        month: date.getMonth(),
        year: date.getFullYear(),
        label: date.toLocaleDateString("en-US", { month: "short" }),
        fullDate: date,
      })
    }

    // Build query based on user type
    const query = {}
    if (type === "distributor_admin") {
      query.distributorId = distributorId
    } else if (type === "delivery_man") {
      query.deliveryManId = deliveryManId || req.user.id
    }

    const monthlyData = await Promise.all(
      months.map(async (monthInfo) => {
        const startDate = new Date(monthInfo.year, monthInfo.month, 1)
        const endDate = new Date(monthInfo.year, monthInfo.month + 1, 0, 23, 59, 59, 999)

        const count = await Inspection.countDocuments({
          ...query,
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
        })

        return {
          month: monthInfo.label,
          count,
          year: monthInfo.year,
        }
      }),
    )

    console.log("✅ Monthly chart data fetched:", monthlyData)
    return sendSuccess(res, { monthlyData }, "Monthly chart data fetched successfully")
  }),
)

// Get sales data for charts
router.get(
  "/sales-data",
  asyncHandler(async (req, res) => {
    const { type, distributorId, deliveryManId } = req.user
    const { period = "weekly" } = req.query // weekly or monthly

    console.log("💰 Sales chart data requested for:", type, period)

    const query = {}
    if (type === "distributor_admin") {
      query.distributorId = distributorId
    } else if (type === "delivery_man") {
      query.deliveryManId = deliveryManId || req.user.id
    }

    let salesData = []

    if (period === "weekly") {
      // Get last 7 days sales
      const days = []
      const today = new Date()

      for (let i = 6; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        days.push({
          date: date.toISOString().split("T")[0],
          label: date.toLocaleDateString("en-US", { weekday: "short" }),
          fullDate: date,
        })
      }

      salesData = await Promise.all(
        days.map(async (day) => {
          const startDate = new Date(day.fullDate)
          startDate.setHours(0, 0, 0, 0)

          const endDate = new Date(day.fullDate)
          endDate.setHours(23, 59, 59, 999)

          const inspections = await Inspection.find({
            ...query,
            createdAt: {
              $gte: startDate,
              $lte: endDate,
            },
          })

          const totalSales = inspections.reduce((sum, inspection) => sum + (inspection.totalAmount || 0), 0)

          return {
            period: day.label,
            sales: totalSales,
            count: inspections.length,
          }
        }),
      )
    } else {
      // Get last 6 months sales
      const months = []
      const currentDate = new Date()

      for (let i = 5; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
        months.push({
          month: date.getMonth(),
          year: date.getFullYear(),
          label: date.toLocaleDateString("en-US", { month: "short" }),
          fullDate: date,
        })
      }

      salesData = await Promise.all(
        months.map(async (monthInfo) => {
          const startDate = new Date(monthInfo.year, monthInfo.month, 1)
          const endDate = new Date(monthInfo.year, monthInfo.month + 1, 0, 23, 59, 59, 999)

          const inspections = await Inspection.find({
            ...query,
            createdAt: {
              $gte: startDate,
              $lte: endDate,
            },
          })

          const totalSales = inspections.reduce((sum, inspection) => sum + (inspection.totalAmount || 0), 0)

          return {
            period: monthInfo.label,
            sales: totalSales,
            count: inspections.length,
          }
        }),
      )
    }

    console.log("✅ Sales chart data fetched:", salesData)
    return sendSuccess(res, { salesData, period }, "Sales chart data fetched successfully")
  }),
)

// Get delivery performance data
router.get(
  "/delivery-performance",
  asyncHandler(async (req, res) => {
    const { type, distributorId } = req.user

    if (type !== "distributor_admin" && type !== "super_admin") {
      return sendError(res, "Access denied", 403)
    }

    console.log("🚚 Delivery performance data requested for:", distributorId)

    const query = {}
    if (type === "distributor_admin") {
      query.distributorId = distributorId
    }

    // Get delivery men performance for last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const deliveryMen = await DeliveryMan.find(query).select("name _id")

    const performanceData = await Promise.all(
      deliveryMen.map(async (deliveryMan) => {
        const inspections = await Inspection.find({
          deliveryManId: deliveryMan._id,
          createdAt: { $gte: thirtyDaysAgo },
        })

        const totalSales = inspections.reduce((sum, inspection) => sum + (inspection.totalAmount || 0), 0)

        return {
          name: deliveryMan.name,
          inspections: inspections.length,
          sales: totalSales,
          id: deliveryMan._id,
        }
      }),
    )

    // Sort by inspections count
    performanceData.sort((a, b) => b.inspections - a.inspections)

    console.log("✅ Delivery performance data fetched:", performanceData)
    return sendSuccess(res, { performanceData }, "Delivery performance data fetched successfully")
  }),
)

module.exports = router
