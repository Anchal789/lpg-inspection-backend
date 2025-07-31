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
    password: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    approvedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model("Distributor", distributorSchema)
