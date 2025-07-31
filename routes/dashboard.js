const express = require("express");
const Inspection = require("../models/Inspection");
const DeliveryMan = require("../models/DeliveryMan");
const Product = require("../models/Product");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Get dashboard statistics for distributor admin
router.get(
	"/stats/:distributorId",
	authenticateToken,
	requireAdmin,
	async (req, res, next) => {
		try {
			const { distributorId } = req.params;

			// Verify access
			if (req.user.id !== distributorId) {
				return res.status(403).json({
					success: false,
					error: "Access denied",
				});
			}

			// Get current date range
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const tomorrow = new Date(today);
			tomorrow.setDate(tomorrow.getDate() + 1);

			const thisWeekStart = new Date(today);
			thisWeekStart.setDate(today.getDate() - today.getDay());

			const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

			// Parallel queries for better performance
			const [
				totalInspections,
				todayInspections,
				thisWeekInspections,
				thisMonthInspections,
				totalDeliveryMen,
				activeProducts,
				salesData,
				topPerformers,
			] = await Promise.all([
				// Total inspections
				Inspection.countDocuments({ distributorId }),

				// Today's inspections
				Inspection.countDocuments({
					distributorId,
					inspectionDate: { $gte: today, $lt: tomorrow },
				}),

				// This week's inspections
				Inspection.countDocuments({
					distributorId,
					inspectionDate: { $gte: thisWeekStart },
				}),

				// This month's inspections
				Inspection.countDocuments({
					distributorId,
					inspectionDate: { $gte: thisMonthStart },
				}),

				// Total delivery men
				DeliveryMan.countDocuments({ distributorId, isActive: true }),

				// Active products
				Product.countDocuments({ distributorId, isActive: true }),

				// Sales data
				Inspection.aggregate([
					{ $match: { distributorId: distributorId } },
					{
						$group: {
							_id: null,
							totalSales: { $sum: "$totalAmount" },
							averageOrderValue: { $avg: "$totalAmount" },
						},
					},
				]),

				// Top performing delivery men
				Inspection.aggregate([
					{ $match: { distributorId: distributorId } },
					{
						$group: {
							_id: "$deliveryManId",
							totalInspections: { $sum: 1 },
							totalSales: { $sum: "$totalAmount" },
						},
					},
					{ $sort: { totalSales: -1 } },
					{ $limit: 5 },
					{
						$lookup: {
							from: "deliverymen",
							localField: "_id",
							foreignField: "_id",
							as: "deliveryMan",
						},
					},
					{ $unwind: "$deliveryMan" },
					{
						$project: {
							name: "$deliveryMan.name",
							totalInspections: 1,
							totalSales: 1,
						},
					},
				]),
			]);

			// Weekly inspection trend
			const weeklyTrend = await Inspection.aggregate([
				{
					$match: {
						distributorId: distributorId,
						inspectionDate: { $gte: thisWeekStart },
					},
				},
				{
					$group: {
						_id: { $dayOfWeek: "$inspectionDate" },
						count: { $sum: 1 },
						sales: { $sum: "$totalAmount" },
					},
				},
				{ $sort: { _id: 1 } },
			]);

			const totalSales = salesData.length > 0 ? salesData[0].totalSales : 0;
			const averageOrderValue =
				salesData.length > 0 ? salesData[0].averageOrderValue : 0;

			res.json({
				success: true,
				data: {
					overview: {
						totalInspections,
						todayInspections,
						thisWeekInspections,
						thisMonthInspections,
						totalDeliveryMen,
						activeProducts,
						totalSales,
						averageOrderValue: Math.round(averageOrderValue || 0),
					},
					topPerformers,
					weeklyTrend,
					lastUpdated: new Date().toISOString(),
				},
			});
		} catch (error) {
			next(error);
		}
	}
);

// Get delivery man performance
router.get(
	"/delivery-man/:deliveryManId/performance",
	authenticateToken,
	async (req, res, next) => {
		try {
			const { deliveryManId } = req.params;

			// Get delivery man details
			const deliveryMan = await DeliveryMan.findById(deliveryManId).select(
				"-password"
			);

			if (!deliveryMan) {
				return res.status(404).json({
					success: false,
					error: "Delivery man not found",
				});
			}

			// Check access permissions
			if (req.user.role === "delivery" && req.user.id !== deliveryManId) {
				return res.status(403).json({
					success: false,
					error: "Access denied",
				});
			}

			if (
				req.user.role === "admin" &&
				req.user.id !== deliveryMan.distributorId.toString()
			) {
				return res.status(403).json({
					success: false,
					error: "Access denied",
				});
			}

			// Get performance data
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

			const [monthlyInspections, monthlyPerformance] = await Promise.all([
				// Monthly inspections count
				Inspection.countDocuments({
					deliveryManId,
					inspectionDate: { $gte: thisMonthStart },
				}),

				// Monthly performance details
				Inspection.aggregate([
					{
						$match: {
							deliveryManId: deliveryManId,
							inspectionDate: { $gte: thisMonthStart },
						},
					},
					{
						$group: {
							_id: null,
							totalSales: { $sum: "$totalAmount" },
							averageOrderValue: { $avg: "$totalAmount" },
							totalPassedQuestions: { $sum: "$passedQuestions" },
							totalQuestions: {
								$sum: { $add: ["$passedQuestions", "$failedQuestions"] },
							},
						},
					},
				]),
			]);

			const performance =
				monthlyPerformance.length > 0 ? monthlyPerformance[0] : {};

			res.json({
				success: true,
				data: {
					deliveryMan: {
						id: deliveryMan._id,
						name: deliveryMan.name,
						phone: deliveryMan.phone,
						totalInspections: deliveryMan.totalInspections,
						totalSales: deliveryMan.totalSales,
					},
					monthlyStats: {
						inspections: monthlyInspections,
						sales: performance.totalSales || 0,
						averageOrderValue: Math.round(performance.averageOrderValue || 0),
						safetyScore: performance.totalQuestions
							? Math.round(
									(performance.totalPassedQuestions /
										performance.totalQuestions) *
										100
							  )
							: 0,
					},
				},
			});
		} catch (error) {
			next(error);
		}
	}
);

module.exports = router;
