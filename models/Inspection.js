const mongoose = require("mongoose")

const inspectionSchema = new mongoose.Schema(
  {
    inspectionId: {
      type: String,
      unique: true,
      required: true,
    },
    distributorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Distributor",
      required: true,
    },
    deliveryManId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryMan",
      required: true,
    },
    consumer: {
      name: {
        type: String,
        required: true,
      },
      consumerNumber: {
        type: String,
        required: true,
      },
      mobileNumber: {
        type: String,
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
    },
    safetyQuestions: [
      {
        questionId: Number,
        question: String,
        answer: {
          type: String,
          enum: ["yes", "no"],
        },
      },
    ],
    surakshaHoseDueDate: String,
    images: [
      {
        imageId: String,
        imageUrl: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
        fileSize: Number,
      },
    ],
    products: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        name: String,
        price: Number,
        quantity: Number,
        subtotal: Number,
      },
    ],
    hotplateExchange: {
      type: Boolean,
      default: false,
    },
    otherDiscount: {
      type: Number,
      default: 0,
    },
    subtotalAmount: Number,
    totalDiscount: Number,
    location: {
      latitude: Number,
      longitude: Number,
      address: String,
      accuracy: Number,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["completed", "pending", "issues_found"],
      default: "completed",
    },
    passedQuestions: Number,
    failedQuestions: Number,
    inspectionDate: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

// Auto-generate inspection ID
inspectionSchema.pre("save", async function (next) {
  if (!this.inspectionId) {
    const count = await mongoose.model("Inspection").countDocuments()
    this.inspectionId = `INS-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`
  }
  next()
})

module.exports = mongoose.model("Inspection", inspectionSchema)
