const express = require("express");
const mongoose = require("mongoose");
const Inspection = require("../models/Inspection");
const DeliveryMan = require("../models/DeliveryMan");
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

// Create new inspection with S3 image URLs
router.post(
	"/",
	asyncHandler(async (req, res) => {
		const { type, distributorId } = req.user;
		console.log("req.body", req.body);

		const {
			id,
			consumerName,
			consumerNumber,
			mobileNumber,
			address,
			deliveryManId,
			deliveryManName,
			date,
			answers,
			images, // These will now be S3 URLs
			products,
			totalAmount,
			location,
			hotplateExchange,
			otherDiscount,
			surakshaHoseDueDate,
			hotplateQuantity,
		} = req.body;

		// Validate required fields
		if (!consumerName || !mobileNumber || !address || !totalAmount) {
			return sendError(res, "Missing required fields", 400);
		}

		// Verify delivery man exists
		let validDeliveryManId = req.user.deliveryManId || req.user.id;
		if (deliveryManId) {
			const deliveryMan = await DeliveryMan.findById(deliveryManId);
			if (deliveryMan) {
				validDeliveryManId = deliveryManId;
			}
		}

		// Validate products if provided
		if (products && products.length > 0) {
			const productIds = products
				.map((product) => product._id || product.id)
				.filter(
					(id) =>
						id &&
						!id.toString().startsWith("hotplate_") &&
						!id.toString().startsWith("platform_") &&
						id !== "dummy_product_id"
				);

			if (productIds.length > 0) {
				const foundProducts = await Product.find({ _id: { $in: productIds } });
				console.log(
					`Found ${foundProducts.length} products out of ${productIds.length} requested`
				);

				if (foundProducts.length !== productIds.length) {
					const foundIds = foundProducts.map((p) => p._id.toString());
					const missingIds = productIds.filter(
						(id) => !foundIds.includes(id.toString())
					);
					console.log("Missing product IDs:", missingIds);
				}
			}
		}

		// Transform answers to safetyQuestions format
		const safetyQuestions = answers
			? Object.keys(answers).map((key) => ({
					questionId: parseInt(key),
					question: `Question ${parseInt(key) + 1}`,
					answer: answers[key],
			  }))
			: [];

		// Transform S3 images to proper format
		const formattedImages = images
			? images.map((image, index) => {
					// Handle both string URLs and object formats
					if (typeof image === 'string') {
						return {
							imageId: `img_${Date.now()}_${index}`,
							imageUrl: image, // S3 URL
							uploadedAt: new Date(),
							fileSize: 0,
						};
					} else {
						return {
							imageId: image.imageId || `img_${Date.now()}_${index}`,
							imageUrl: image.url || image.imageUrl, // S3 URL
							uploadedAt: new Date(image.uploadedAt) || new Date(),
							fileSize: image.size || 0,
							s3Key: image.key, // Store S3 key for deletion if needed
						};
					}
			  })
			: [];

		// Transform products to match schema
		const formattedProducts = products
			? products.map((product) => {
					const productId = product._id || product.id;
					const isValidObjectId =
						mongoose.Types.ObjectId.isValid(productId) &&
						productId.toString().length === 24;

					return {
						productId: isValidObjectId ? productId : null,
						name: product.name,
						price: product.price,
						quantity: product.quantity || 1,
						subtotal: (product.price || 0) * (product.quantity || 1),
					};
			  })
			: [];

		// Calculate passed/failed questions
		const passedQuestions = Object.values(answers || {}).filter(
			(answer) => answer === "yes"
		).length;
		const failedQuestions = Object.values(answers || {}).filter(
			(answer) => answer === "no"
		).length;

		// Generate inspection ID if not provided
		const inspectionId = id || `INS-${Date.now()}`;

		// Create inspection with S3 URLs
		const inspection = new Inspection({
			inspectionId: inspectionId,
			distributorId: distributorId,
			deliveryManId: validDeliveryManId,
			consumer: {
				name: consumerName,
				consumerNumber: consumerNumber,
				mobileNumber: mobileNumber,
				address: address,
			},
			safetyQuestions: safetyQuestions,
			images: formattedImages, // Now contains S3 URLs
			products: formattedProducts,
			totalAmount: totalAmount,
			location: {
				latitude: location?.latitude || 0,
				longitude: location?.longitude || 0,
				address: address,
				accuracy: location?.accuracy || 0,
			},
			status: "completed",
			passedQuestions: passedQuestions,
			failedQuestions: failedQuestions,
			inspectionDate: date ? new Date(date) : new Date(),
			hotplateExchange: hotplateExchange,
			otherDiscount: otherDiscount,
			surakshaHoseDueDate: surakshaHoseDueDate,
			hotplateQuantity: hotplateQuantity,
		});

		await inspection.save();

		// Populate the created inspection
		await inspection.populate([
			{ path: "distributorId", select: "agencyName sapCode" },
			{ path: "deliveryManId", select: "name phone" },
			{ path: "products.productId", select: "name type serialNumber" },
		]);

		console.log("✅ Inspection created with S3 images:", inspection._id);
		return sendSuccess(
			res,
			{ inspection },
			"Inspection created successfully with S3 images",
			201
		);
	})
);

// Get inspections - Updated to work with S3 URLs
router.get(
	"/",
	asyncHandler(async (req, res) => {
		const { type, distributorId } = req.user;
		const { page = 1, limit = 10, status, search } = req.query;

		console.log("📋 Fetching inspections for:", type, distributorId);

		const query = {};

		// Filter based on user type
		if (type === "distributor_admin") {
			query.distributorId = distributorId;
		} else if (type === "delivery_man") {
			query.deliveryManId = req.user.deliveryManId || req.user.id;
		}

		// Add status filter
		if (status) {
			query.status = status;
		}

		// Add search filter
		if (search) {
			query.$or = [
				{ "consumer.name": { $regex: search, $options: "i" } },
				{ "consumer.mobileNumber": { $regex: search, $options: "i" } },
				{ "consumer.address": { $regex: search, $options: "i" } },
				{ inspectionId: { $regex: search, $options: "i" } },
			];
		}

		const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit);

		const [inspections, total] = await Promise.all([
			Inspection.find(query)
				.populate("distributorId", "agencyName sapCode")
				.populate("deliveryManId", "name phone")
				.populate("products.productId", "name type serialNumber")
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(Number.parseInt(limit)),
			Inspection.countDocuments(query),
		]);

		const totalPages = Math.ceil(total / Number.parseInt(limit));

		console.log(`✅ Found ${inspections.length} inspections with S3 images (${total} total)`);
		return sendSuccess(
			res,
			{
				inspections,
				pagination: {
					currentPage: Number.parseInt(page),
					totalPages,
					totalItems: total,
					itemsPerPage: Number.parseInt(limit),
				},
			},
			"Inspections fetched successfully"
		);
	})
);

// Get inspection by ID
router.get(
	"/:id",
	asyncHandler(async (req, res) => {
		const { id } = req.params;
		const { type, distributorId } = req.user;

		console.log("🔍 Fetching inspection:", id);

		const query = { _id: id };

		// Filter based on user type
		if (type === "distributor_admin") {
			query.distributorId = distributorId;
		} else if (type === "delivery_man") {
			query.deliveryManId = req.user.deliveryManId || req.user.id;
		}

		const inspection = await Inspection.findOne(query)
			.populate("distributorId", "agencyName sapCode")
			.populate("deliveryManId", "name phone")
			.populate("products.productId", "name type serialNumber");

		if (!inspection) {
			return sendError(res, "Inspection not found or access denied", 404);
		}

		console.log("✅ Inspection fetched with S3 images:", inspection._id);
		return sendSuccess(res, { inspection }, "Inspection fetched successfully");
	})
);

// Update inspection
router.put(
	"/:id",
	asyncHandler(async (req, res) => {
		const { id } = req.params;
		const { type, distributorId } = req.user;

		console.log("📝 Updating inspection:", id);

		const query = { _id: id };

		// Filter based on user type
		if (type === "distributor_admin") {
			query.distributorId = distributorId;
		} else if (type === "delivery_man") {
			query.deliveryManId = req.user.deliveryManId || req.user.id;
		}

		const inspection = await Inspection.findOneAndUpdate(query, req.body, {
			new: true,
			runValidators: true,
		})
			.populate("distributorId", "agencyName sapCode")
			.populate("deliveryManId", "name phone")
			.populate("products.productId", "name type serialNumber");

		if (!inspection) {
			return sendError(res, "Inspection not found or access denied", 404);
		}

		console.log("✅ Inspection updated:", inspection._id);
		return sendSuccess(res, { inspection }, "Inspection updated successfully");
	})
);

// Delete inspection
router.delete(
	"/:id",
	asyncHandler(async (req, res) => {
		const { id } = req.params;
		const { type, distributorId } = req.user;

		console.log("🗑️ Deleting inspection:", id);

		const query = { _id: id };

		// Only super admin and distributor admin can delete
		if (type === "delivery_man") {
			return sendError(
				res,
				"Insufficient permissions to delete inspections",
				403
			);
		}

		if (type === "distributor_admin") {
			query.distributorId = distributorId;
		}

		const inspection = await Inspection.findOneAndDelete(query);

		if (!inspection) {
			return sendError(res, "Inspection not found or access denied", 404);
		}

		console.log("✅ Inspection deleted:", id);
		return sendSuccess(res, null, "Inspection deleted successfully");
	})
);

module.exports = router;