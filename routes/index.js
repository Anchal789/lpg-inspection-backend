const express = require("express");
const { sendSuccess } = require("../utils/errorHandler");
const chartsRoutes = require("./charts");

const router = express.Router();
const app = require("../server");

app.use("/api/charts", chartsRoutes)

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
			},
		},
		"API is running successfully"
	);
});

module.exports = router;
