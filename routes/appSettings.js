const express = require("express")
const Distributor = require("../models/Distributor")
const { sendSuccess, sendError, asyncHandler } = require("../utils/errorHandler")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

// Get app settings for a distributor
router.get(
  "/:distributorId",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { distributorId } = req.params
    const { user } = req

    // Check authorization - only super admin or the distributor admin can access
    if (user.type !== "super_admin" && user.distributorId !== distributorId) {
      return sendError(res, "Unauthorized access", 403)
    }

    const distributor = await Distributor.findById(distributorId).select("appSettings")
    
    if (!distributor) {
      return sendError(res, "Distributor not found", 404)
    }

    // If appSettings doesn't exist, return default values
    const defaultSettings = {
      hotplateName: "Hi-star Hotplate",
      hotplatePrice: 2500,
      portablePlatformName: "Portable Kitchen Platform",
      portablePlatformPrice: 1500,
      hotplateExchangeRate: 450,
    }

    const appSettings = distributor.appSettings || defaultSettings

    return sendSuccess(res, { appSettings }, "App settings retrieved successfully")
  })
)

// Update app settings for a distributor
router.put(
  "/:distributorId",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { distributorId } = req.params
    const { user } = req
    const { hotplateName, hotplatePrice, portablePlatformName, portablePlatformPrice, hotplateExchangeRate } = req.body

    // Check authorization - only super admin or the distributor admin can update
    if (user.type !== "super_admin" && user.distributorId !== distributorId) {
      return sendError(res, "Unauthorized access", 403)
    }

    // Validate input data
    const errors = []

    if (hotplateName && (hotplateName.length < 3 || hotplateName.length > 50)) {
      errors.push("Hotplate name must be between 3 and 50 characters")
    }

    if (portablePlatformName && (portablePlatformName.length < 3 || portablePlatformName.length > 50)) {
      errors.push("Portable platform name must be between 3 and 50 characters")
    }

    if (hotplatePrice !== undefined && (hotplatePrice < 0 || hotplatePrice > 100000)) {
      errors.push("Hotplate price must be between 0 and 100,000")
    }

    if (portablePlatformPrice !== undefined && (portablePlatformPrice < 0 || portablePlatformPrice > 100000)) {
      errors.push("Portable platform price must be between 0 and 100,000")
    }

    if (hotplateExchangeRate !== undefined && (hotplateExchangeRate < 0 || hotplateExchangeRate > 10000)) {
      errors.push("Hotplate exchange rate must be between 0 and 10,000")
    }

    if (errors.length > 0) {
      return sendError(res, errors.join(", "), 400)
    }

    const distributor = await Distributor.findById(distributorId)
    
    if (!distributor) {
      return sendError(res, "Distributor not found", 404)
    }

    // Update app settings
    const updatedSettings = {
      hotplateName: hotplateName || distributor.appSettings?.hotplateName || "Hi-star Hotplate",
      hotplatePrice: hotplatePrice !== undefined ? hotplatePrice : (distributor.appSettings?.hotplatePrice || 2500),
      portablePlatformName: portablePlatformName || distributor.appSettings?.portablePlatformName || "Portable Kitchen Platform",
      portablePlatformPrice: portablePlatformPrice !== undefined ? portablePlatformPrice : (distributor.appSettings?.portablePlatformPrice || 1500),
      hotplateExchangeRate: hotplateExchangeRate !== undefined ? hotplateExchangeRate : (distributor.appSettings?.hotplateExchangeRate || 450),
    }

    distributor.appSettings = updatedSettings
    await distributor.save()

    console.log("✅ App settings updated for distributor:", distributorId)
    return sendSuccess(res, { appSettings: updatedSettings }, "App settings updated successfully")
  })
)

// Reset app settings to default for a distributor
router.post(
  "/:distributorId/reset",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { distributorId } = req.params
    const { user } = req

    // Check authorization - only super admin or the distributor admin can reset
    if (user.type !== "super_admin" && user.distributorId !== distributorId) {
      return sendError(res, "Unauthorized access", 403)
    }

    const distributor = await Distributor.findById(distributorId)
    
    if (!distributor) {
      return sendError(res, "Distributor not found", 404)
    }

    // Reset to default settings
    const defaultSettings = {
      hotplateName: "Hi-star Hotplate",
      hotplatePrice: 2500,
      portablePlatformName: "Portable Kitchen Platform",
      portablePlatformPrice: 1500,
      hotplateExchangeRate: 450,
    }

    distributor.appSettings = defaultSettings
    await distributor.save()

    console.log("🔄 App settings reset to default for distributor:", distributorId)
    return sendSuccess(res, { appSettings: defaultSettings }, "App settings reset to default successfully")
  })
)

module.exports = router