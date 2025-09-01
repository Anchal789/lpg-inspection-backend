const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const path = require("path")
require("dotenv").config()

const app = express()
const PORT = process.env.PORT || 3000

console.log("🚀 Starting LPG Inspection Backend Server...")
console.log("📍 Port:", PORT)
console.log("🌍 Environment:", process.env.NODE_ENV || "production")

// PRODUCTION CORS Configuration - Allows all origins for mobile apps
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
    credentials: false,
  }),
)

app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

// Handle preflight requests
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin")
  res.sendStatus(200)
})

// MongoDB Connection
console.log("🔗 Connecting to MongoDB...")

const connectWithRetry = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    console.log("✅ Connected to MongoDB Atlas")
  } catch (error) {
    console.error("❌ MongoDB connection error (will retry):", error.message)
    // Wait 5s and retry without exiting; healthcheck will still return 200 with mongodb: "Disconnected"
    setTimeout(connectWithRetry, 5000)
  }
}

connectWithRetry()

// Import Routes with error handling
const authRoutes = require("./routes/auth")
const inspectionRoutes = require("./routes/inspections")
const productRoutes = require("./routes/products")
const deliveryManRoutes = require("./routes/deliveryMen")
const dashboardRoutes = require("./routes/dashboard")
const superAdminRoutes = require("./routes/superAdmin")
const uploadRoutes = require("./routes/upload")

// Import new routes with error handling
let chartsRoutes = null
let appSettingsRoutes = null

try {
  chartsRoutes = require("./routes/charts")
  console.log("✅ Charts routes loaded")
} catch (error) {
  console.log("⚠️  Charts routes not found:", error.message)
}

try {
  appSettingsRoutes = require("./routes/appSettings")
  console.log("✅ App settings routes loaded")
} catch (error) {
  console.log("⚠️  App settings routes not found:", error.message)
}

// Health check endpoint - FIXED duplicate keys
app.get("/api/health", (req, res) => {
  console.log("🏥 Health check requested")
  res.json({
    success: true,
    message: "LPG Inspection API is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "production",
    mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    port: PORT,
    loadedRoutes: {
      auth: true,
      inspections: true,
      products: true,
      deliveryMen: true,
      dashboard: true,
      superAdmin: true,
      upload: true,
      charts: !!chartsRoutes,
      appSettings: !!appSettingsRoutes,
    },
    endpoints: {
      auth: "/api/auth/*",
      inspections: "/api/inspections/*",
      products: "/api/products/*",
      deliveryMen: "/api/delivery-men/*",
      dashboard: "/api/dashboard/*",
      superAdmin: "/api/super-admin/*",
      upload: "/api/upload/*",
      ...(chartsRoutes && { charts: "/api/charts/*" }),
      ...(appSettingsRoutes && { appSettings: "/api/app-settings/*" }),
    },
  })
})

// Root endpoint
app.get("/", (req, res) => {
  console.log("🏠 Root endpoint requested")
  res.json({
    success: true,
    message: "LPG Inspection API - Production Ready",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    status: "Server is running successfully",
    mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth/*",
      inspections: "/api/inspections/*",
      products: "/api/products/*",
      deliveryMen: "/api/delivery-men/*",
      dashboard: "/api/dashboard/*",
      superAdmin: "/api/super-admin/*",
      upload: "/api/upload/*",
      ...(chartsRoutes && { charts: "/api/charts/*" }),
      ...(appSettingsRoutes && { appSettings: "/api/app-settings/*" }),
    },
  })
})

// 404 handler
app.use("*", (req, res) => {
  console.log("❌ 404 - Endpoint not found:", req.originalUrl)
  const availableEndpoints = [
    "/api/health",
    "/api/auth/*",
    "/api/inspections/*",
    "/api/products/*",
    "/api/delivery-men/*",
    "/api/dashboard/*",
    "/api/super-admin/*",
    "/api/upload/*",
  ]

  if (chartsRoutes) availableEndpoints.push("/api/charts/*")
  if (appSettingsRoutes) availableEndpoints.push("/api/app-settings/*")

  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    requestedUrl: req.originalUrl,
    method: req.method,
    availableEndpoints,
  })
})

// Global error handling middleware (must be last)
app.use((error, req, res, next) => {
  console.error("❌ Global error:", error)
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: error.message,
    timestamp: new Date().toISOString(),
  })
})

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📱 API Base URL: http://localhost:${PORT}/api`)
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`)
  console.log(`🌍 Production ready - accessible from anywhere`)
  console.log(`📋 Available endpoints:`)
  console.log(`   - GET  /api/health`)
  console.log(`   - POST /api/auth/validate-sap`)
  console.log(`   - POST /api/auth/login`)
  console.log(`   - POST /api/auth/register-distributor`)
  console.log(`   - POST /api/auth/register`)
  console.log(`   - GET  /api/super-admin/dashboard-stats`)
  console.log(`   - GET  /api/super-admin/distributor-requests`)
  console.log(`   - POST /api/super-admin/approve-distributor/:id`)
  console.log(`   - POST /api/super-admin/reject-distributor/:id`)
  console.log(`   - GET  /api/inspections`)
  console.log(`   - POST /api/inspections`)
  console.log(`   - GET  /api/products`)
  console.log(`   - POST /api/products`)
  console.log(`   - GET  /api/delivery-men`)
  console.log(`   - POST /api/delivery-men`)
  console.log(`   - GET  /api/dashboard/stats`)
  if (chartsRoutes) console.log(`   - GET  /api/charts/*`)
  if (appSettingsRoutes) console.log(`   - GET  /api/app-settings/*`)
})

module.exports = app
