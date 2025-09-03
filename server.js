const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const path = require("path")
require("dotenv").config()

const app = express()
const PORT = process.env.PORT || 3000

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

// Import Routes
const authRoutes = require("./routes/auth")
const inspectionRoutes = require("./routes/inspections")
const productRoutes = require("./routes/products")
const deliveryManRoutes = require("./routes/deliveryMen")
const dashboardRoutes = require("./routes/dashboard")
const superAdminRoutes = require("./routes/superAdmin")
const uploadRoutes = require("./routes/upload")
const appSettings = require("./routes/appSettings")
const charts = require("./routes/charts")
const exportRouter = require('./routes/export');

// Mount Routes
app.use("/api/auth", authRoutes)
app.use("/api/inspections", inspectionRoutes)
app.use("/api/products", productRoutes)
app.use("/api/delivery-men", deliveryManRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/super-admin", superAdminRoutes)
app.use("/api/upload", uploadRoutes)
app.use("/api/app-settings", appSettings)
app.use("/api/charts", charts)
app.use('/api/export', exportRouter);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "LPG Inspection API is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "production",
    mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    port: PORT,
    endpoints: {
      auth: "/api/auth/*",
      inspections: "/api/inspections/*",
      products: "/api/products/*",
      deliveryMen: "/api/delivery-men/*",
      dashboard: "/api/dashboard/*",
      superAdmin: "/api/super-admin/*",
      upload: "/api/upload/*",
      appSettings: "/api/app-settings/*",
      charts: "/api/charts/*",
      export: "/api/export/*",
    },
  })
})

// Root endpoint
app.get("/", (req, res) => {
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
      appSettings: "/api/app-settings/*",
      charts: "/api/charts/*",
      export: "/api/export/*",
    },
  })
})

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error("❌ Global error:", error)
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: error.message,
    timestamp: new Date().toISOString(),
  })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    requestedUrl: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      "/api/health",
      "/api/auth/*",
      "/api/inspections/*",
      "/api/products/*",
      "/api/delivery-men/*",
      "/api/dashboard/*",
      "/api/super-admin/*",
      "/api/upload/*",
      "/api/app-settings/*",
      "/api/charts/*",
      "/api/export/*",
    ],
  })
})

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📱 API Base URL: http://localhost:${PORT}/api`)
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`)
  console.log(`🌍 Server is ready to accept connections`)
  console.log(`📋 Available endpoints:`)
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
  console.log(`   - GET  /api/app-settings`)
  console.log(`   - GET  /api/charts`)
  console.log(`   - GET  /api/export`)
})

module.exports = app