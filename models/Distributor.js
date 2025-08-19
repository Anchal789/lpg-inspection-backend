const mongoose = require("mongoose")

const distributorSchema = new mongoose.Schema(
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
    phone: {
      type: String,
      trim: true,
    },
    adminPassword: {
      type: String,
      required: true,
    },
    password: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    approvedAt: {
      type: Date,
      default: Date.now,
    },
    deliveryMenCount: {
      type: Number,
      default: 0,
    },
    inspectionsCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model("Distributor", distributorSchema)
