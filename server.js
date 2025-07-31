// const express = require("express");
// const mongoose = require("mongoose");
// const cors = require("cors");
// const multer = require("multer");
// const AWS = require("aws-sdk");
// const jwt = require("jsonwebtoken");
// const bcrypt = require("bcryptjs");
// const path = require("path");
// require("dotenv").config();

// const app = express();
// const PORT = process.env.PORT || 3000;

// // Middleware
// app.use(cors());
// app.use(express.json({ limit: "50mb" }));
// app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// // AWS S3 Configuration
// const s3 = new AWS.S3({
// 	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
// 	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
// 	region: process.env.AWS_REGION,
// });

// // MongoDB Connection
// mongoose
// 	.connect(process.env.MONGODB_CONNECTION_STRING, {
// 		useNewUrlParser: true,
// 		useUnifiedTopology: true,
// 	})
// 	.then(() => console.log("✅ Connected to MongoDB Atlas"))
// 	.catch((error) => {
// 		console.error("❌ MongoDB connection error:", error);
// 		process.exit(1);
// 	});

// // Import Models
// const Distributor = require("./models/Distributor");
// const DeliveryMan = require("./models/DeliveryMan");
// const Product = require("./models/Product");
// const Inspection = require("./models/Inspection");
// const DistributorRequest = require("./models/DistributorRequest");

// // Import Routes
// const authRoutes = require("./routes/auth");
// const inspectionRoutes = require("./routes/inspections");
// const productRoutes = require("./routes/products");
// const deliveryManRoutes = require("./routes/deliveryMen");
// const dashboardRoutes = require("./routes/dashboard");
// const superAdminRoutes = require("./routes/superAdmin");
// const uploadRoutes = require("./routes/upload");

// // Import the centralized error handler
// const globalErrorHandler = require("./utils/errorHandler");

// // Routes
// app.use("/api/auth", authRoutes);
// app.use("/api/inspections", inspectionRoutes);
// app.use("/api/products", productRoutes);
// app.use("/api/delivery-men", deliveryManRoutes);
// app.use("/api/dashboard", dashboardRoutes);
// app.use("/api/super-admin", superAdminRoutes);
// app.use("/api/upload", uploadRoutes);

// // Health check endpoint
// app.get("/api/health", (req, res) => {
// 	res.json({
// 		success: true,
// 		message: "LPG Inspection API is running",
// 		timestamp: new Date().toISOString(),
// 		version: "1.0.0",
// 		environment: process.env.NODE_ENV || "development",
// 	});
// });

// // 404 handler
// app.use("*", (req, res) => {
// 	res.status(404).json({
// 		success: false,
// 		error: "Endpoint not found",
// 		availableEndpoints: [
// 			"/api/health",
// 			"/api/auth/*",
// 			"/api/inspections/*",
// 			"/api/products/*",
// 			"/api/delivery-men/*",
// 			"/api/dashboard/*",
// 			"/api/super-admin/*",
// 			"/api/upload/*",
// 		],
// 		contactInfo: {
// 			developer: "Anchal Deshmukh",
// 			email: "anchaldesh7@gmail.com",
// 			phone: "+91 7747865603",
// 		},
// 	});
// });

// // Global error handling middleware (must be last)
// app.use(globalErrorHandler);

// // Start server
// app.listen(PORT, "0.0.0.0", () => {
// 	console.log(`🚀 Server running on port ${PORT}`);
// 	console.log(
// 		`📱 API Base URL: https://lpg-inspection-backend-production.up.railway.app/api`
// 	);
// 	console.log(
// 		`🏥 Health Check: https://lpg-inspection-backend-production.up.railway.app/api/health`
// 	);
// });

// module.exports = app;
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

// PRODUCTION CORS Configuration - Allows all origins for mobile apps
const corsOptions = {
 origin: [
    'http://localhost:19006',  // Expo web dev server
    'http://localhost:3000',   // Common dev server
    'https://your-production-domain.com'  // Your production domain
  ],
  credentials: true,
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

// Additional CORS headers for mobile apps
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization")
  if (req.method === "OPTIONS") {
    res.sendStatus(200)
  } else {
    next()
  }
})

// AWS S3 Configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
})

// MongoDB Connection
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

// Import the centralized error handler
const globalErrorHandler = require("./utils/errorHandler")

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/inspections", inspectionRoutes)
app.use("/api/products", productRoutes)
app.use("/api/delivery-men", deliveryManRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/super-admin", superAdminRoutes)
app.use("/api/upload", uploadRoutes)

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "LPG Inspection API is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "production",
    mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
  })
})

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "LPG Inspection API - Production Ready",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth/*",
      inspections: "/api/inspections/*",
      products: "/api/products/*",
      deliveryMen: "/api/delivery-men/*",
      dashboard: "/api/dashboard/*",
      superAdmin: "/api/super-admin/*",
      upload: "/api/upload/*",
    },
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
    ],
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
})

module.exports = app
