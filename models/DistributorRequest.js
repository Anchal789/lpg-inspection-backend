const mongoose = require("mongoose")

const distributorRequestSchema = new mongoose.Schema(
  {
    sapCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    agencyName: {
      type: String,
      required: true,
      trim: true,
    },
    adminName: {
      type: String,
      required: true,
      trim: true,
    },
    adminPhone: {
      type: String,
      required: true,
      trim: true,
    },
    adminPassword: {
      type: String,
      required: true,
    },
    deliveryMen: [
      {
        name: {
          type: String,
          required: true,
        },
        phone: {
          type: String,
          required: true,
        },
        password: {
          type: String,
          required: true,
        },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    requestDate: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
    },
    reviewedBy: {
      type: String, // Super admin ID
    },
    rejectionReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model("DistributorRequest", distributorRequestSchema)
