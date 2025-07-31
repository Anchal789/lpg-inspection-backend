const express = require("express");
const Product = require("../models/Product");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Get products by distributor
router.get("/:distributorId", authenticateToken, async (req, res, next) => {
	try {
		const { distributorId } = req.params;

		// Check if user has access to this distributor's products
		if (req.user.role === "admin" && req.user.id !== distributorId) {
			return res.status(403).json({
				success: false,
				error: "Access denied",
			});
		}

		const products = await Product.find({
			distributorId,
			isActive: true,
		}).sort({ name: 1 });

		res.json({
			success: true,
			data: products,
		});
	} catch (error) {
		next(error);
	}
});

// Create new product
router.post("/", authenticateToken, requireAdmin, async (req, res, next) => {
	try {
		const { name, price, minPrice, quantity, category } = req.body;

		if (!name || !price || !minPrice || quantity === undefined) {
			return res.status(400).json({
				success: false,
				error: "Missing required fields",
			});
		}

		if (price < 0 || minPrice < 0 || quantity < 0) {
			return res.status(400).json({
				success: false,
				error: "Price and quantity must be non-negative",
			});
		}

		if (minPrice > price) {
			return res.status(400).json({
				success: false,
				error: "Minimum price cannot be greater than selling price",
			});
		}

		const product = new Product({
			distributorId: req.user.id,
			name,
			price,
			minPrice,
			quantity,
			category: category || "general",
		});

		await product.save();

		res.status(201).json({
			success: true,
			data: product,
			message: "Product created successfully",
		});
	} catch (error) {
		next(error);
	}
});

// Update product
router.put(
	"/:productId",
	authenticateToken,
	requireAdmin,
	async (req, res, next) => {
		try {
			const { productId } = req.params;
			const { name, price, minPrice, quantity, category } = req.body;

			const product = await Product.findOne({
				_id: productId,
				distributorId: req.user.id,
			});

			if (!product) {
				return res.status(404).json({
					success: false,
					error: "Product not found",
				});
			}

			// Validate price constraints
			if (minPrice && price && minPrice > price) {
				return res.status(400).json({
					success: false,
					error: "Minimum price cannot be greater than selling price",
				});
			}

			// Update fields
			if (name) product.name = name;
			if (price !== undefined) product.price = price;
			if (minPrice !== undefined) product.minPrice = minPrice;
			if (quantity !== undefined) product.quantity = quantity;
			if (category) product.category = category;

			await product.save();

			res.json({
				success: true,
				data: product,
				message: "Product updated successfully",
			});
		} catch (error) {
			next(error);
		}
	}
);

// Delete product
router.delete(
	"/:productId",
	authenticateToken,
	requireAdmin,
	async (req, res, next) => {
		try {
			const { productId } = req.params;

			const product = await Product.findOne({
				_id: productId,
				distributorId: req.user.id,
			});

			if (!product) {
				return res.status(404).json({
					success: false,
					error: "Product not found",
				});
			}

			// Soft delete
			product.isActive = false;
			await product.save();

			res.json({
				success: true,
				message: "Product deleted successfully",
			});
		} catch (error) {
			next(error);
		}
	}
);

// Get product by ID
router.get("/single/:productId", authenticateToken, async (req, res, next) => {
	try {
		const { productId } = req.params;

		const product = await Product.findById(productId);

		if (!product || !product.isActive) {
			return res.status(404).json({
				success: false,
				error: "Product not found",
			});
		}

		res.json({
			success: true,
			data: product,
		});
	} catch (error) {
		next(error);
	}
});

module.exports = router;
