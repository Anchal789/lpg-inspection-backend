const express = require("express");
const Distributor = require("../models/Distributor");
const DeliveryMan = require("../models/DeliveryMan");
const Inspection = require("../models/Inspection");
const Product = require("../models/Product");
const {
	sendSuccess,
	sendError,
	asyncHandler,
} = require("../utils/errorHandler");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get dashboard statistics
router.get(
	"/stats",
	asyncHandler(async (req, res) => {
		const { type, distributorId } = req.user;
		let stats = {};

		if (type === "super_admin") {
			// Super admin sees all statistics
			const [
				totalDistributors,
				totalDeliveryMen,
				totalInspections,
				totalProducts,
				recentInspections,
			] = await Promise.all([
				Distributor.countDocuments(),
				DeliveryMan.countDocuments(),
				Inspection.countDocuments(),
				Product.countDocuments(),
				Inspection.find()
					.populate("distributorId", "agencyName")
					.populate("deliveryManId", "name")
					.populate("products.productId", "name")
					.sort({ createdAt: -1 })
					.limit(10),
			]);

			stats = {
				totalDistributors,
				totalDeliveryMen,
				totalInspections,
				totalProducts,
				recentInspections,
			};
		} else if (type === "distributor_admin") {
			// Distributor admin sees their distributor's statistics
			const [
				totalDeliveryMen,
				totalInspections,
				totalProducts,
				recentInspections,
			] = await Promise.all([
				DeliveryMan.countDocuments({ distributorId }),
				Inspection.countDocuments({ distributorId }),
				Product.countDocuments({ distributorId }),
				Inspection.find({ distributorId })
					.populate("deliveryManId", "name")
					.populate("products.productId", "name")
					.sort({ createdAt: -1 })
					.limit(10),
			]);

			console.log("DeliveryMan", DeliveryMan)

			stats = {
				totalDeliveryMen,
				totalInspections,
				totalProducts,
				recentInspections,
			};
		} else if (type === "delivery_man") {
			// Delivery man sees their own statistics
			const deliveryManId = req.user.deliveryManId || req.user.id;

			const deliveryMan = await DeliveryMan.findById(deliveryManId).populate(
				"assignedProducts",
				"name"
			);

			if (!deliveryMan) {
				return sendError(res, "Delivery man not found", 404);
			}

			const [totalInspections, recentInspections, deliveryMen] =
				await Promise.all([
					Inspection.countDocuments({ deliveryManId }),
					Inspection.find({ deliveryManId })
						.populate("products.productId", "name")
						.sort({ createdAt: -1 })
						.limit(10),
					DeliveryMan.countDocuments(),
				]);

			stats = {
				totalInspections,
				recentInspections,
				assignedProducts: deliveryMan.assignedProducts,
			};
		}

		return sendSuccess(res, stats, "Dashboard statistics fetched successfully");
	})
);

// Get recent activity
router.get(
	"/recent-activity",
	asyncHandler(async (req, res) => {
		const { type, distributorId } = req.user;
		console.log("📋 Recent activity requested for:", type, distributorId);

		const query = {};
		if (type === "distributor_admin") {
			query.distributorId = distributorId;
		} else if (type === "delivery_man") {
			query.deliveryManId = req.user.deliveryManId || req.user.id;
		}

		const recentInspections = await Inspection.find(query)
			.populate("distributorId", "agencyName")
			.populate("deliveryManId", "name")
			.populate("products.productId", "name type")
			.sort({ createdAt: -1 })
			.limit(20);

		console.log(`✅ Found ${recentInspections.length} recent inspections`);
		return sendSuccess(
			res,
			{ recentInspections },
			"Recent activity fetched successfully"
		);
	})
);

// Get monthly statistics
router.get(
	"/monthly-stats",
	asyncHandler(async (req, res) => {
		const { type, distributorId } = req.user;
		console.log("📊 Monthly stats requested for:", type, distributorId);

		const currentDate = new Date();
		const currentMonth = currentDate.getMonth();
		const currentYear = currentDate.getFullYear();

		// Get last 6 months
		const months = [];
		for (let i = 5; i >= 0; i--) {
			const date = new Date(currentYear, currentMonth - i, 1);
			months.push({
				month: date.getMonth(),
				year: date.getFullYear(),
				name: date.toLocaleString("default", {
					month: "short",
					year: "numeric",
				}),
			});
		}

		const query = {};
		if (type === "distributor_admin") {
			query.distributorId = distributorId;
		} else if (type === "delivery_man") {
			query.deliveryManId = req.user.deliveryManId || req.user.id;
		}

		const monthlyStats = await Promise.all(
			months.map(async (monthInfo) => {
				const startDate = new Date(monthInfo.year, monthInfo.month, 1);
				const endDate = new Date(monthInfo.year, monthInfo.month + 1, 0);

				const count = await Inspection.countDocuments({
					...query,
					createdAt: {
						$gte: startDate,
						$lte: endDate,
					},
				});

				return {
					month: monthInfo.name,
					count,
				};
			})
		);

		console.log("✅ Monthly stats fetched:", monthlyStats);
		return sendSuccess(
			res,
			{ monthlyStats },
			"Monthly statistics fetched successfully"
		);
	})
);

module.exports = router;
