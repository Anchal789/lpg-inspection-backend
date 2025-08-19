const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const DeliveryMan = require("../models/DeliveryMan")
const Distributor = require("../models/Distributor")
const DistributorRequest = require("../models/DistributorRequest")
const { sendSuccess, sendError, asyncHandler } = require("../utils/errorHandler")

const router = express.Router()

// Validate SAP Code
router.post(
  "/validate-sap",
  asyncHandler(async (req, res) => {
    const { sapCode } = req.body

    if (!sapCode) {
      return sendError(res, "SAP code is required")
    }

    // Super Admin SAP Code
    if (sapCode === "000000") {
      return sendSuccess(res, {
        isValid: true,
        userType: "super_admin",
        message: "Super Admin SAP code validated",
      })
    }

    // Check if SAP code exists in delivery men
    const deliveryMan = await DeliveryMan.findOne({ sapCode, isActive: true })
    if (deliveryMan) {
      return sendSuccess(res, {
        isValid: true,
        userType: "delivery_man",
        distributorId: deliveryMan.distributorId,
        message: "Delivery man SAP code validated",
      })
    }

    // Check if SAP code exists in distributors
    const distributor = await Distributor.findOne({ sapCode, status: "approved" })
    if (distributor) {
      return sendSuccess(res, {
        isValid: true,
        userType: "distributor_admin",
        distributorId: distributor._id,
        message: "Distributor admin SAP code validated",
      })
    }

    return sendError(res, "Invalid SAP code", 404)
  }),
)

// Login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { sapCode, phone, password } = req.body

    if (!sapCode || !phone || !password) {
      return sendError(res, "SAP code, phone, and password are required")
    }

    let user = null
    let userType = ""

    // Super Admin Login
    if (sapCode === "000000" && phone === "9876543210") {
      if (password === "admin123") {
        user = {
          _id: "super_admin",
          name: "Super Admin",
          phone: "9876543210",
          sapCode: "000000",
          role: "super_admin",
        }
        userType = "super_admin"
      } else {
        return sendError(res, "Invalid credentials", 401)
      }
    } else {
      // Check delivery man
      const deliveryMan = await DeliveryMan.findOne({ sapCode, phone, isActive: true }).populate(
        "distributorId",
        "name",
      )

      if (deliveryMan) {
        const isPasswordValid = await bcrypt.compare(password, deliveryMan.password)
        if (isPasswordValid) {
          user = deliveryMan
          userType = "delivery_man"
        }
      }

      // Check distributor admin if not found in delivery men
      if (!user) {
        const distributor = await Distributor.findOne({ sapCode, adminPhone: phone, status: "approved" })
        if (distributor) {
          const isPasswordValid = await bcrypt.compare(password, distributor.adminPassword)
          if (isPasswordValid) {
            user = distributor
            userType = "distributor_admin"
          }
        }
      }

      if (!user) {
        return sendError(res, "Invalid credentials", 401)
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user._id,
        role: userType,
        sapCode: user.sapCode,
        distributorId: user.distributorId || user._id,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "24h" },
    )

    return sendSuccess(
      res,
      {
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone || user.adminPhone,
          sapCode: user.sapCode,
          role: userType,
          distributorId: user.distributorId || user._id,
        },
      },
      "Login successful",
    )
  }),
)

// Register Distributor Request
router.post(
  "/register-distributor",
  asyncHandler(async (req, res) => {
    const { companyName, ownerName, email, phone, address, city, state, pincode, adminPhone, adminPassword, sapCode } =
      req.body

    // Validate required fields
    if (!companyName || !ownerName || !email || !phone || !address || !adminPhone || !adminPassword || !sapCode) {
      return sendError(res, "All fields are required")
    }

    // Check if SAP code already exists
    const existingSapCode = await DistributorRequest.findOne({ sapCode })
    if (existingSapCode) {
      return sendError(res, "SAP code already exists", 409)
    }

    // Check if email already exists
    const existingEmail = await DistributorRequest.findOne({ email })
    if (existingEmail) {
      return sendError(res, "Email already registered", 409)
    }

    // Hash admin password
    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    // Create distributor request
    const distributorRequest = new DistributorRequest({
      companyName,
      ownerName,
      email,
      phone,
      address,
      city,
      state,
      pincode,
      adminPhone,
      adminPassword: hashedPassword,
      sapCode,
      status: "pending",
    })

    await distributorRequest.save()

    return sendSuccess(
      res,
      {
        requestId: distributorRequest._id,
        message: "Registration request submitted successfully. Please wait for admin approval.",
      },
      "Registration request submitted",
    )
  }),
)

// Register Delivery Man
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { name, phone, password, sapCode, distributorId } = req.body

    // Validate required fields
    if (!name || !phone || !password || !sapCode || !distributorId) {
      return sendError(res, "All fields are required")
    }

    // Check if SAP code already exists
    const existingSapCode = await DeliveryMan.findOne({ sapCode })
    if (existingSapCode) {
      return sendError(res, "SAP code already exists", 409)
    }

    // Check if phone already exists
    const existingPhone = await DeliveryMan.findOne({ phone })
    if (existingPhone) {
      return sendError(res, "Phone number already registered", 409)
    }

    // Verify distributor exists
    const distributor = await Distributor.findById(distributorId)
    if (!distributor) {
      return sendError(res, "Invalid distributor", 404)
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create delivery man
    const deliveryMan = new DeliveryMan({
      name,
      phone,
      password: hashedPassword,
      sapCode,
      distributorId,
      isActive: true,
    })

    await deliveryMan.save()

    return sendSuccess(
      res,
      {
        deliveryManId: deliveryMan._id,
        message: "Delivery man registered successfully",
      },
      "Registration successful",
    )
  }),
)

// Get user profile
router.get(
  "/profile",
  require("../middleware/auth"),
  asyncHandler(async (req, res) => {
    const { id, role } = req.user

    let user = null

    if (role === "super_admin") {
      user = {
        id: "super_admin",
        name: "Super Admin",
        phone: "9876543210",
        sapCode: "000000",
        role: "super_admin",
      }
    } else if (role === "delivery_man") {
      user = await DeliveryMan.findById(id).populate("distributorId", "name").select("-password")
    } else if (role === "distributor_admin") {
      user = await Distributor.findById(id).select("-adminPassword")
    }

    if (!user) {
      return sendError(res, "User not found", 404)
    }

    return sendSuccess(res, { user }, "Profile fetched successfully")
  }),
)

module.exports = router
