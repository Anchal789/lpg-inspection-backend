const express = require("express");
const Inspection = require("../models/Inspection");
const DeliveryMan = require("../models/DeliveryMan");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Create new inspection
router.post("/", authenticateToken, async (req, res, next) => {
	try {
		const {
			distributorId,
			deliveryManId,
			consumer,
			safetyQuestions,
			surakshaHoseDueDate,
			images,
			products,
			hotplateExchange,
			otherDiscount,
			location,
			totalAmount,
			inspectionDate,
		} = req.body;

		// Validate required fields
		if (!consumer || !safetyQuestions || !totalAmount || !inspectionDate) {
			return res.status(400).json({
				success: false,
				error: "Missing required fields",
			});
		}

		// Calculate totals
		const subtotalAmount = products.reduce(
			(sum, product) => sum + product.price * product.quantity,
			0
		);
		const totalDiscount = (hotplateExchange ? 450 : 0) + (otherDiscount || 0);
		const passedQuestions = safetyQuestions.filter(
			(q) => q.answer === "yes"
		).length;
		const failedQuestions = safetyQuestions.length - passedQuestions;

		// Create inspection
		const inspection = new Inspection({
			distributorId: distributorId || req.user.distributorId,
			deliveryManId,
			consumer,
			safetyQuestions,
			surakshaHoseDueDate,
			images: images || [],
			products,
			hotplateExchange: hotplateExchange || false,
			otherDiscount: otherDiscount || 0,
			subtotalAmount,
			totalDiscount,
			location,
			totalAmount,
			passedQuestions,
			failedQuestions,
			inspectionDate: new Date(inspectionDate),
			status: failedQuestions > 0 ? "issues_found" : "completed",
		});

		await inspection.save();

		// Update delivery man stats
		await DeliveryMan.findByIdAndUpdate(deliveryManId, {
			$inc: {
				totalInspections: 1,
				totalSales: totalAmount,
			},
		});

		res.status(201).json({
			success: true,
			data: inspection,
			message: "Inspection created successfully",
		});
	} catch (error) {
		next(error);
	}
});

// Get inspections by delivery man
router.get(
	"/delivery-man/:deliveryManId",
	authenticateToken,
	async (req, res, next) => {
		try {
			const { deliveryManId } = req.params;
			const page = Number.parseInt(req.query.page) || 1;
			const limit = Number.parseInt(req.query.limit) || 20;
			const skip = (page - 1) * limit;

			const inspections = await Inspection.find({ deliveryManId })
				.populate("deliveryManId", "name")
				.sort({ inspectionDate: -1 })
				.skip(skip)
				.limit(limit);

			const total = await Inspection.countDocuments({ deliveryManId });

			res.json({
				success: true,
				data: inspections,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			});
		} catch (error) {
			next(error);
		}
	}
);

// Search inspections
router.get("/search", authenticateToken, async (req, res, next) => {
	try {
		const {
			deliveryManId,
			consumerName,
			consumerNumber,
			dateFrom,
			dateTo,
			distributorId,
		} = req.query;

		const query = {};

		// Add distributor filter for admin users
		if (req.user.role === "admin") {
			query.distributorId = req.user.id;
		} else if (distributorId) {
			query.distributorId = distributorId;
		}

		if (deliveryManId) {
			query.deliveryManId = deliveryManId;
		}

		if (consumerName) {
			query["consumer.name"] = { $regex: consumerName, $options: "i" };
		}

		if (consumerNumber) {
			query["consumer.consumerNumber"] = {
				$regex: consumerNumber,
				$options: "i",
			};
		}

		if (dateFrom && dateTo) {
			query.inspectionDate = {
				$gte: new Date(dateFrom),
				$lte: new Date(dateTo),
			};
		}

		const inspections = await Inspection.find(query)
			.populate("deliveryManId", "name")
			.sort({ inspectionDate: -1 })
			.limit(100);

		res.json({
			success: true,
			data: inspections,
			count: inspections.length,
		});
	} catch (error) {
		next(error);
	}
});

// Get inspection by ID
router.get("/:inspectionId", authenticateToken, async (req, res, next) => {
	try {
		const { inspectionId } = req.params;

		const inspection = await Inspection.findById(inspectionId)
			.populate("deliveryManId", "name phone")
			.populate("distributorId", "agencyName");

		if (!inspection) {
			return res.status(404).json({
				success: false,
				error: "Inspection not found",
			});
		}

		res.json({
			success: true,
			data: inspection,
		});
	} catch (error) {
		next(error);
	}
});

// Get all inspections (admin/super admin only)
router.get("/", authenticateToken, async (req, res, next) => {
	try {
		const page = Number.parseInt(req.query.page) || 1;
		const limit = Number.parseInt(req.query.limit) || 20;
		const skip = (page - 1) * limit;

		const query = {};

		// Filter by distributor for admin users
		if (req.user.role === "admin") {
			query.distributorId = req.user.id;
		}

		const inspections = await Inspection.find(query)
			.populate("deliveryManId", "name phone")
			.populate("distributorId", "agencyName")
			.sort({ inspectionDate: -1 })
			.skip(skip)
			.limit(limit);

		const total = await Inspection.countDocuments(query);

		res.json({
			success: true,
			data: inspections,
			pagination: {
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			},
		});
	} catch (error) {
		next(error);
	}
});

module.exports = router;
