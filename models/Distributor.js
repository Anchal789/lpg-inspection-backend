const mongoose = require("mongoose")

const appSettingsSchema = new mongoose.Schema({
  hotplateName: {
    type: String,
    default: "Hi-star Hotplate",
    trim: true,
  },
  hotplatePrice: {
    type: Number,
    default: 2500,
    min: 0,
  },
  portablePlatformName: {
    type: String,
    default: "Portable Kitchen Platform",
    trim: true,
  },
  portablePlatformPrice: {
    type: Number,
    default: 1500,
    min: 0,
  },
  hotplateExchangeRate: {
    type: Number,
    default: 450,
    min: 0,
  },
}, { _id: false })

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
     appSettings: {
      type: appSettingsSchema,
      default: () => ({}), // This will use the defaults from appSettingsSchema
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model("Distributor", distributorSchema)
