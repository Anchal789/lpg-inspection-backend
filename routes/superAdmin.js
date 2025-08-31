const express = require("express");
const Distributor = require("../models/Distributor");
const DistributorRequest = require("../models/DistributorRequest");
const DeliveryMan = require("../models/DeliveryMan");
const Inspection = require("../models/Inspection");
const Product = require("../models/Product");
const {
	sendSuccess,
	sendError,
	asyncHandler,
} = require("../utils/errorHandler");
const { authenticateToken, requireSuperAdmin } = require("../middleware/auth");

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireSuperAdmin);

// Get dashboard statistics
router.get(
	"/dashboard-stats",
	asyncHandler(async (req, res) => {
		const [
			totalDistributors,
			pendingRequests,
			totalDeliveryMen,
			totalInspections,
			totalProducts,
			recentInspections,
		] = await Promise.all([
			Distributor.countDocuments(),
			DistributorRequest.countDocuments({ status: "pending" }),
			DeliveryMan.countDocuments(),
			Inspection.countDocuments(),
			Product.countDocuments(),
			Inspection.find()
				.populate("distributorId", "agencyName")
				.populate("deliveryManId", "name")
				.populate("productId", "name")
				.sort({ createdAt: -1 })
				.limit(10),
		]);

		const stats = {
			totalDistributors,
			pendingRequests,
			totalDeliveryMen,
			totalInspections,
			totalProducts,
			recentInspections,
		};

		return sendSuccess(res, stats, "Dashboard statistics fetched successfully");
	})
);

// Get all distributor requests
router.get(
	"/distributor-requests",
	asyncHandler(async (req, res) => {
		console.log("📋 Fetching distributor requests");

		const requests = await DistributorRequest.find().sort({ createdAt: -1 });

		console.log(`✅ Found ${requests.length} distributor requests`);
		return sendSuccess(
			res,
			{ requests },
			"Distributor requests fetched successfully"
		);
	})
);

// Approve distributor request
router.post(
	"/approve-distributor/:id",
	asyncHandler(async (req, res) => {
		const { id } = req.params;

		const request = await DistributorRequest.findById(id);
		if (!request) {
			return sendError(res, "Distributor request not found", 404);
		}

		if (request.status !== "pending") {
			return sendError(res, "Request has already been processed", 400);
		}

		// Create distributor
		const distributor = new Distributor({
			sapCode: request.sapCode,
			agencyName: request.agencyName,
			adminName: request.adminName,
			adminPhone: request.adminPhone,
			adminPassword: request.adminPassword,
			phone: request.adminPhone, // Use admin phone as main phone
			password: request.adminPassword, // Use admin password as main password
			deliveryMen: request.deliveryMen,
		});

		await distributor.save();

		// Create delivery men if provided
		if (request.deliveryMen && request.deliveryMen.length > 0) {
			const deliveryMenData = request.deliveryMen.map((dm) => ({
				name: dm.name,
				phone: dm.phone,
				password: dm.password,
				distributorId: distributor._id,
			}));

			await DeliveryMan.insertMany(deliveryMenData);

			console.log("Inserted delivery men:", deliveryMenData);
		}

		// Update request status
		request.status = "approved";
		request.approvedAt = new Date();
		await request.save();

		return sendSuccess(
			res,
			{
				distributorId: distributor._id,
				sapCode: distributor.sapCode,
				agencyName: distributor.agencyName,
				deliveryMen: distributor.deliveryMen,
			},
			"Distributor request approved successfully"
		);
	})
);

// Reject distributor request
router.post(
	"/reject-distributor/:id",
	asyncHandler(async (req, res) => {
		const { id } = req.params;
		const { reason } = req.body;
		console.log(" Rejecting distributor request:", id, "Reason:", reason);

		const request = await DistributorRequest.findById(id);
		if (!request) {
			return sendError(res, "Distributor request not found", 404);
		}

		if (request.status !== "pending") {
			return sendError(res, "Request has already been processed", 400);
		}

		// Update request status
		request.status = "rejected";
		request.rejectedAt = new Date();
		request.rejectionReason = reason || "No reason provided";
		await request.save();

		// Delete distributor's data
		await Distributor.deleteOne({ _id: request.distributorId });

		console.log(" Distributor request rejected and data deleted");
		return sendSuccess(res, null, "Distributor request rejected successfully");
	})
);

// Get all distributors
router.get(
	"/distributors",
	asyncHandler(async (req, res) => {
		const distributors = await Distributor.find()
			.select("-adminPassword -password")
			.sort({ createdAt: -1 });
		return sendSuccess(
			res,
			{ distributors },
			"Distributors fetched successfully"
		);
	})
);

// Get all delivery men
router.get(
	"/delivery-men",
	asyncHandler(async (req, res) => {
		const deliveryMen = await DeliveryMan.find()
			.populate("distributorId", "agencyName sapCode")
			.select("-password")
			.sort({ createdAt: -1 });

		return sendSuccess(
			res,
			{ deliveryMen },
			"Delivery men fetched successfully"
		);
	})
);

// Get all inspections
router.get(
	"/inspections",
	asyncHandler(async (req, res) => {
		const inspections = await Inspection.find()
			.populate("distributorId", "agencyName sapCode")
			.populate("deliveryManId", "name phone")
			.populate("productId", "name type")
			.sort({ createdAt: -1 });

		return sendSuccess(
			res,
			{ inspections },
			"Inspections fetched successfully"
		);
	})
);

// Delete distributor
router.delete(
	"/distributors/:id",
	asyncHandler(async (req, res) => {
		const { id } = req.params;
		console.log("🗑️ Deleting distributor:", id);

		const distributor = await Distributor.findById(id);
		if (!distributor) {
			return sendError(res, "Distributor not found", 404);
		}

		// Delete associated delivery men
		await DeliveryMan.deleteMany({ distributorId: id });

		// Delete associated inspections
		await Inspection.deleteMany({ distributorId: id });

		// Delete associated products
		await Product.deleteMany({ distributorId: id });

		// Delete distributor
		await Distributor.findByIdAndDelete(id);

		console.log("✅ Distributor and associated data deleted");
		return sendSuccess(res, null, "Distributor deleted successfully");
	})
);

module.exports = router;
