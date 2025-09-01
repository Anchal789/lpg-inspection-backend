const express = require("express");
const { sendSuccess } = require("../utils/errorHandler");

const router = express.Router();

// Import all route modules
const authRoutes = require("./auth");
const inspectionRoutes = require("./inspections");
const productRoutes = require("./products");
const deliveryManRoutes = require("./deliveryMen");
const dashboardRoutes = require("./dashboard");
const superAdminRoutes = require("./superAdmin");
const uploadRoutes = require("./upload");
const chartsRoutes = require("./charts");
const appSettings = require("./appSettings");

// Mount routes
router.use("/auth", authRoutes);
router.use("/inspections", inspectionRoutes);
router.use("/products", productRoutes);
router.use("/delivery-men", deliveryManRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/super-admin", superAdminRoutes);
router.use("/upload", uploadRoutes);
router.use("/charts", chartsRoutes);
router.use("/app-settings", appSettings);

// API root endpoint
router.get("/", (req, res) => {
	return sendSuccess(
		res,
		{
			message: "LPG Inspection API",
			version: "1.0.0",
			endpoints: {
				auth: "/api/auth",
				superAdmin: "/api/super-admin",
				dashboard: "/api/dashboard",
				inspections: "/api/inspections",
				products: "/api/products",
				deliveryMen: "/api/delivery-men",
				upload: "/api/upload",
				charts: "/api/charts",
				appSettings: "/api/app-settings",
			},
		},
		"API is running successfully"
	);
});

// Health check endpoint
router.get("/health", (req, res) => {
	res.json({
		success: true,
		message: "LPG Inspection API is healthy",
		timestamp: new Date().toISOString(),
		version: "1.0.0",
		environment: process.env.NODE_ENV || "production",
	});
});

module.exports = router;