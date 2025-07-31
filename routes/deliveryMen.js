const express = require("express");
const bcrypt = require("bcryptjs");
const DeliveryMan = require("../models/DeliveryMan");
const Product = require("../models/Product");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Get delivery men by distributor
router.get("/:distributorId", authenticateToken, async (req, res, next) => {
	try {
		const { distributorId } = req.params;

		// Check access permissions
		if (req.user.role === "admin" && req.user.id !== distributorId) {
			return res.status(403).json({
				success: false,
				error: "Access denied",
			});
		}

		const deliveryMen = await DeliveryMan.find({
			distributorId,
			isActive: true,
		})
			.select("-password")
			.sort({ name: 1 });

		res.json({
			success: true,
			data: deliveryMen,
		});
	} catch (error) {
		next(error);
	}
});

// Create new delivery man
router.post("/", authenticateToken, requireAdmin, async (req, res, next) => {
	try {
		const { name, phone, password } = req.body;

		if (!name || !phone || !password) {
			return res.status(400).json({
				success: false,
				error: "Name, phone, and password are required",
			});
		}

		// Check if phone number already exists
		const existingDeliveryMan = await DeliveryMan.findOne({ phone });
		if (existingDeliveryMan) {
			return res.status(409).json({
				success: false,
				error: "Phone number already registered",
			});
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(password, 10);

		const deliveryMan = new DeliveryMan({
			distributorId: req.user.id,
			name,
			phone,
			password: hashedPassword,
		});

		await deliveryMan.save();

		// Remove password from response
		const deliveryManResponse = deliveryMan.toObject();
		delete deliveryManResponse.password;

		res.status(201).json({
			success: true,
			data: deliveryManResponse,
			message: "Delivery man created successfully",
		});
	} catch (error) {
		next(error);
	}
});

// Assign product to delivery man
router.post(
	"/:deliveryManId/assign-product",
	authenticateToken,
	requireAdmin,
	async (req, res, next) => {
		try {
			const { deliveryManId } = req.params;
			const { productId, quantity, price, minPrice } = req.body;

			if (!productId || !quantity || !price || minPrice === undefined) {
				return res.status(400).json({
					success: false,
					error: "Product ID, quantity, price, and minimum price are required",
				});
			}

			// Verify delivery man belongs to this distributor
			const deliveryMan = await DeliveryMan.findOne({
				_id: deliveryManId,
				distributorId: req.user.id,
			});

			if (!deliveryMan) {
				return res.status(404).json({
					success: false,
					error: "Delivery man not found",
				});
			}

			// Verify product exists and belongs to this distributor
			const product = await Product.findOne({
				_id: productId,
				distributorId: req.user.id,
				isActive: true,
			});

			if (!product) {
				return res.status(404).json({
					success: false,
					error: "Product not found",
				});
			}

			// Check if enough quantity available
			if (product.quantity < quantity) {
				return res.status(400).json({
					success: false,
					error: "Insufficient product quantity",
				});
			}

			// Validate price constraints
			if (price < minPrice) {
				return res.status(400).json({
					success: false,
					error: "Price cannot be below minimum price",
				});
			}

			// Add product to delivery man's assigned products
			deliveryMan.assignedProducts.push({
				productId,
				quantity,
				price,
				minPrice,
			});

			await deliveryMan.save();

			// Update product quantity
			product.quantity -= quantity;
			await product.save();

			res.json({
				success: true,
				message: "Product assigned successfully",
				data: {
					deliveryManId: deliveryMan._id,
					productName: product.name,
					assignedQuantity: quantity,
					assignedPrice: price,
				},
			});
		} catch (error) {
			next(error);
		}
	}
);

// Get delivery man details
router.get(
	"/single/:deliveryManId",
	authenticateToken,
	async (req, res, next) => {
		try {
			const { deliveryManId } = req.params;

			const deliveryMan = await DeliveryMan.findById(deliveryManId)
				.select("-password")
				.populate("assignedProducts.productId", "name category");

			if (!deliveryMan) {
				return res.status(404).json({
					success: false,
					error: "Delivery man not found",
				});
			}

			// Check access permissions
			if (
				req.user.role === "admin" &&
				req.user.id !== deliveryMan.distributorId.toString()
			) {
				return res.status(403).json({
					success: false,
					error: "Access denied",
				});
			}

			res.json({
				success: true,
				data: deliveryMan,
			});
		} catch (error) {
			next(error);
		}
	}
);

// Update delivery man
router.put(
	"/:deliveryManId",
	authenticateToken,
	requireAdmin,
	async (req, res, next) => {
		try {
			const { deliveryManId } = req.params;
			const { name, phone, password } = req.body;

			const deliveryMan = await DeliveryMan.findOne({
				_id: deliveryManId,
				distributorId: req.user.id,
			});

			if (!deliveryMan) {
				return res.status(404).json({
					success: false,
					error: "Delivery man not found",
				});
			}

			// Update fields
			if (name) deliveryMan.name = name;
			if (phone) {
				// Check if new phone number is already taken
				const existingDeliveryMan = await DeliveryMan.findOne({
					phone,
					_id: { $ne: deliveryManId },
				});
				if (existingDeliveryMan) {
					return res.status(409).json({
						success: false,
						error: "Phone number already registered",
					});
				}
				deliveryMan.phone = phone;
			}
			if (password) {
				deliveryMan.password = await bcrypt.hash(password, 10);
			}

			await deliveryMan.save();

			// Remove password from response
			const deliveryManResponse = deliveryMan.toObject();
			delete deliveryManResponse.password;

			res.json({
				success: true,
				data: deliveryManResponse,
				message: "Delivery man updated successfully",
			});
		} catch (error) {
			next(error);
		}
	}
);

// Deactivate delivery man
router.delete(
	"/:deliveryManId",
	authenticateToken,
	requireAdmin,
	async (req, res, next) => {
		try {
			const { deliveryManId } = req.params;

			const deliveryMan = await DeliveryMan.findOne({
				_id: deliveryManId,
				distributorId: req.user.id,
			});

			if (!deliveryMan) {
				return res.status(404).json({
					success: false,
					error: "Delivery man not found",
				});
			}

			// Soft delete
			deliveryMan.isActive = false;
			await deliveryMan.save();

			res.json({
				success: true,
				message: "Delivery man deactivated successfully",
			});
		} catch (error) {
			next(error);
		}
	}
);

module.exports = router;
