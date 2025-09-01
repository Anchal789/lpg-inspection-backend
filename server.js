const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const multer = require("multer")
const AWS = require("aws-sdk")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const path = require("path")
require("dotenv").config()

const app = express()
const PORT = process.env.PORT || 3000

console.log("🚀 Starting LPG Inspection Backend Server...")
console.log("📍 Port:", PORT)
console.log("🌍 Environment:", process.env.NODE_ENV || "production")

// CORS Configuration - Production ready
const corsOptions = {
  origin: "*", // Allow all origins for mobile apps
  credentials: false,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  exposedHeaders: ["Authorization"],
}

// Middleware
app.use(cors(corsOptions))
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

// Handle preflight requests for all routes
app.options("*", cors(corsOptions))

// AWS S3 Configuration (if needed)
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
})

// MongoDB Connection
console.log("🔗 Connecting to MongoDB...")
mongoose
  .connect(process.env.MONGODB_CONNECTION_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((error) => {
    console.error("❌ MongoDB connection error:", error)
    process.exit(1)
  })

// Import Models
const Distributor = require("./models/Distributor")
const DeliveryMan = require("./models/DeliveryMan")
const Product = require("./models/Product")
const Inspection = require("./models/Inspection")
const DistributorRequest = require("./models/DistributorRequest")

// Import Routes
const authRoutes = require("./routes/auth")
const inspectionRoutes = require("./routes/inspections")
const productRoutes = require("./routes/products")
const deliveryManRoutes = require("./routes/deliveryMen")
const dashboardRoutes = require("./routes/dashboard")
const superAdminRoutes = require("./routes/superAdmin")
const uploadRoutes = require("./routes/upload")

// Import new routes (with error handling)
let chartsRoutes, appSettingsRoutes;
try {
  chartsRoutes = require("./routes/charts")
  console.log("✅ Charts routes loaded")
} catch (error) {
  console.log("⚠️  Charts routes not found, skipping...")
  chartsRoutes = null
}

try {
  appSettingsRoutes = require("./routes/appSettings")
  console.log("✅ App settings routes loaded")
} catch (error) {
  console.log("⚠️  App settings routes not found, skipping...")
  appSettingsRoutes = null
}

// Import the centralized error handler
let globalErrorHandler;
try {
  globalErrorHandler = require("./utils/errorHandler")
  console.log("✅ Global error handler loaded")
} catch (error) {
  console.log("⚠️  Global error handler not found, using default...")
  globalErrorHandler = (error, req, res, next) => {
    console.error("❌ Global error:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
      timestamp: new Date().toISOString(),
    })
  }
}

// Mount Routes
app.use("/api/auth", authRoutes)
app.use("/api/inspections", inspectionRoutes)
app.use("/api/products", productRoutes)
app.use("/api/delivery-men", deliveryManRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/super-admin", superAdminRoutes)
app.use("/api/upload", uploadRoutes)

// Mount new routes if they exist
if (chartsRoutes) {
  app.use("/api/charts", chartsRoutes)
  console.log("✅ Charts routes mounted")
}

if (appSettingsRoutes) {
  app.use("/api/app-settings", appSettingsRoutes)
  console.log("✅ App settings routes mounted")
}

// Health check endpoint
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
app.use(globalErrorHandler)

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