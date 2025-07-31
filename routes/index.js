// Main routes index file
const express = require("express")
const router = express.Router()

// Import all route modules
const authRoutes = require("./auth")
const inspectionRoutes = require("./inspections")
const productRoutes = require("./products")
const deliveryManRoutes = require("./deliveryMen")
const dashboardRoutes = require("./dashboard")
const superAdminRoutes = require("./superAdmin")
const uploadRoutes = require("./upload")

// Mount routes
router.use("/auth", authRoutes)
router.use("/inspections", inspectionRoutes)
router.use("/products", productRoutes)
router.use("/delivery-men", deliveryManRoutes)
router.use("/dashboard", dashboardRoutes)
router.use("/super-admin", superAdminRoutes)
router.use("/upload", uploadRoutes)

// Health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "LPG Inspection API is healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  })
})

module.exports = router
