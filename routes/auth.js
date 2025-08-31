const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const Distributor = require("../models/Distributor")
const DeliveryMan = require("../models/DeliveryMan")
const DistributorRequest = require("../models/DistributorRequest")
const { validateSapCode, validatePhone, validatePassword } = require("../utils/validators")
const { sendSuccess, sendError, asyncHandler } = require("../utils/errorHandler")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

// Super Admin Constants (with fallbacks)
const SUPER_ADMIN_SAP_CODE = process.env.SUPER_ADMIN_SAP_CODE || "000000"
const SUPER_ADMIN_PHONE = process.env.SUPER_ADMIN_PHONE || "9876543210"
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "admin123"
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

// Validate SAP Code
router.post(
  "/validate-sap",
  asyncHandler(async (req, res) => {
    const { sapCode } = req.body

    if (!sapCode) {
      return sendError(res, "SAP code is required", 400)
    }

    // Check if it's super admin SAP code
    if (sapCode === SUPER_ADMIN_SAP_CODE) {
      return sendSuccess(
        res,
        {
          type: "super_admin",
          name: "Super Admin",
          sapCode: sapCode,
        },
        "Super Admin SAP code validated",
      )
    }

    // Check if distributor exists with this SAP code
    const distributor = await Distributor.findOne({ sapCode })
    if (distributor) {
      console.log("✅ Distributor SAP code validated:", distributor.agencyName)
      return sendSuccess(
        res,
        {
          type: "distributor",
          name: distributor.agencyName,
          sapCode: sapCode,
          distributorId: distributor._id,
        },
        "Distributor SAP code validated",
      )
    }

    // Check if there's a pending request for this SAP code
    const pendingRequest = await DistributorRequest.findOne({ sapCode, status: "pending" })
    if (pendingRequest) {
      console.log("⏳ Pending distributor request found")
      return sendError(res, "Registration request is pending approval", 400)
    }

    // SAP code not found
    console.log("❌ SAP code not found:", sapCode)
    return sendError(res, "SAP code not found. Please enter valid SAP code.", 404)
  }),
)

// Login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    console.log("🔐 Login request:", { ...req.body, password: "***" })
    const { phone, password, sapCode } = req.body

    // Validate required fields
    if (!phone || !password || !sapCode) {
      return sendError(res, "Phone, password, and SAP code are required", 400)
    }

    // Check if it's super admin login
    if (sapCode === SUPER_ADMIN_SAP_CODE) {
      console.log("🔍 SAP code matches, checking phone and password...")

      if (phone === SUPER_ADMIN_PHONE && password === SUPER_ADMIN_PASSWORD) {
        const token = jwt.sign(
          {
            id: "super_admin",
            type: "super_admin",
            role: "super_admin",
            sapCode: sapCode,
            distributorId: null, // Important: Set to null for super admin
          },
          JWT_SECRET,
          { expiresIn: "24h" },
        )

        console.log("✅ Super Admin login successful")
        return sendSuccess(
          res,
          {
            token,
            user: {
              id: "super_admin",
              name: "Super Admin",
              phone: phone,
              role: "super_admin",
              type: "super_admin",
              sapCode: sapCode,
              distributorId: null,
            },
          },
          "Super Admin login successful",
        )
      } else {
        console.log("❌ Super admin credentials mismatch:", {
          phoneMatch: phone === SUPER_ADMIN_PHONE,
          passwordMatch: password === SUPER_ADMIN_PASSWORD,
          inputPhone: phone,
          expectedPhone: SUPER_ADMIN_PHONE,
          inputPassword: password,
          expectedPassword: SUPER_ADMIN_PASSWORD,
        })
        return sendError(res, "Invalid super admin credentials", 401)
      }
    }

    // Check distributor login
    const distributor = await Distributor.findOne({ sapCode })
    if (distributor) {
      // Check if it's admin login (using adminPhone field)
      if (phone === distributor.adminPhone || phone === distributor.phone) {
        const isValidPassword = await bcrypt.compare(password, distributor.adminPassword || distributor.password)
        if (isValidPassword) {
          const token = jwt.sign(
            {
              id: distributor._id,
              type: "distributor_admin",
              role: "admin",
              sapCode: sapCode,
              distributorId: distributor._id,
            },
            JWT_SECRET,
            { expiresIn: "24h" },
          )

          console.log("✅ Distributor admin login successful")
          return sendSuccess(
            res,
            {
              token,
              user: {
                id: distributor._id,
                name: distributor.adminName,
                phone: phone,
                role: "admin",
                type: "distributor_admin",
                sapCode: sapCode,
                agencyName: distributor.agencyName,
                distributorId: distributor._id,
              },
            },
            "Distributor admin login successful",
          )
        }
      }

      // Check delivery man login
      const deliveryMan = await DeliveryMan.findOne({
        distributorId: distributor._id,
        phone: phone,
      })

      if (deliveryMan) {
        const isValidPassword = await bcrypt.compare(password, deliveryMan.password)
        if (isValidPassword) {
          const token = jwt.sign(
            {
              id: deliveryMan._id,
              type: "delivery_man",
              role: "delivery",
              sapCode: sapCode,
              distributorId: distributor._id,
              deliveryManId: deliveryMan._id,
            },
            JWT_SECRET,
            { expiresIn: "24h" },
          )

          return sendSuccess(
            res,
            {
              token,
              user: {
                id: deliveryMan._id,
                name: deliveryMan.name,
                phone: phone,
                role: "delivery",
                type: "delivery_man",
                sapCode: sapCode,
                distributorId: distributor._id,
                deliveryManId: deliveryMan._id,
                isActive: deliveryMan.isActive,
              },
            },
            "Delivery man login successful",
          )
        }
      }
    }

    console.log("❌ Invalid login credentials")
    return sendError(res, "Invalid phone number or password", 401)
  }),
)

// Reset Password
router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    console.log("🔄 Password reset request:", { ...req.body, newPassword: "***" })
    const { phone, newPassword, sapCode } = req.body

    // Validate required fields
    if (!phone || !newPassword || !sapCode) {
      return sendError(res, "Phone, new password, and SAP code are required", 400)
    }

    // Validate phone number
    if (!validatePhone(phone)) {
      return sendError(res, "Invalid phone number format", 400)
    }

    // Validate password
    if (!validatePassword(newPassword)) {
      return sendError(res, "Password must be at least 4 characters", 400)
    }

    // Check if it's super admin reset (not allowed)
    if (sapCode === SUPER_ADMIN_SAP_CODE) {
      return sendError(res, "Super admin password cannot be reset through this method", 403)
    }

    // Find distributor
    const distributor = await Distributor.findOne({ sapCode })
    if (!distributor) {
      return sendError(res, "SAP code not found", 404)
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Check if it's admin phone
    if (phone === distributor.adminPhone || phone === distributor.phone) {
      // Reset admin password
      distributor.adminPassword = hashedPassword
      await distributor.save()

      console.log("✅ Admin password reset successful")
      return sendSuccess(res, null, "Admin password reset successfully")
    }

    // Check if it's delivery man phone
    const deliveryMan = await DeliveryMan.findOne({
      distributorId: distributor._id,
      phone: phone,
    })

    if (deliveryMan) {
      // Reset delivery man password
      deliveryMan.password = hashedPassword
      await deliveryMan.save()

      console.log("✅ Delivery man password reset successful")
      return sendSuccess(res, null, "Password reset successfully")
    }

    console.log("❌ Phone number not found for this SAP code")
    return sendError(res, "Phone number not found for this SAP code", 404)
  }),
)

// Register Distributor
router.post(
  "/register-distributor",
  asyncHandler(async (req, res) => {
    console.log("📝 Distributor registration request:", { ...req.body, adminPassword: "***" })
    const { sapCode, agencyName, adminName, adminPhone, adminPassword, deliveryMen } = req.body

    // Validate required fields
    if (!sapCode || !agencyName || !adminName || !adminPhone || !adminPassword) {
      return sendError(res, "All fields are required", 400)
    }

    // Validate SAP code format
    if (!validateSapCode(sapCode)) {
      return sendError(res, "Invalid SAP code format", 400)
    }

    // Validate agency name
    if (agencyName.length < 3 || agencyName.length > 40) {
      return sendError(res, "Agency name must be between 3 and 40 characters", 400)
    }

    // Validate admin name
    if (adminName.length < 3 || adminName.length > 40) {
      return sendError(res, "Admin name must be between 3 and 40 characters", 400)
    }

    // Validate phone number
    if (!validatePhone(adminPhone)) {
      return sendError(res, "Invalid phone number format", 400)
    }

    // Validate password
    if (!validatePassword(adminPassword)) {
      return sendError(res, "Password must be at least 4 characters", 400)
    }

    // Check if SAP code already exists
    const existingDistributor = await Distributor.findOne({ sapCode })
    if (existingDistributor) {
      return sendError(res, "SAP code already registered", 400)
    }

    // Check if there's already a pending request
    const existingRequest = await DistributorRequest.findOne({ sapCode, status: "pending" })
    if (existingRequest) {
      return sendError(res, "Registration request already pending", 400)
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    // Hash delivery men passwords if provided
    let hashedDeliveryMen = []
    if (deliveryMen && deliveryMen.length > 0) {
      hashedDeliveryMen = await Promise.all(
        deliveryMen.map(async (dm) => ({
          ...dm,
          password: await bcrypt.hash(dm.password, 10),
        })),
      )
    }

    // Create distributor request
    const distributorRequest = new DistributorRequest({
      sapCode,
      agencyName,
      adminName,
      adminPhone,
      adminPassword: hashedPassword,
      deliveryMen: hashedDeliveryMen,
      status: "pending",
    })

    await distributorRequest.save()

    return sendSuccess(
      res,
      {
        requestId: distributorRequest._id,
        sapCode: sapCode,
        status: "pending",
      },
      "Registration request submitted successfully. Please wait for admin approval.",
    )
  }),
)

// Register User (Delivery Man)
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    console.log("📝 User registration request:", { ...req.body, password: "***" })
    const { name, phone, password, sapCode } = req.body

    // Validate required fields
    if (!name || !phone || !password) {
      return sendError(res, "Name, phone, and password are required", 400)
    }

    // Validate name
    if (name.length < 3 || name.length > 40) {
      return sendError(res, "Name must be between 3 and 40 characters", 400)
    }

    // Validate phone number
    if (!validatePhone(phone)) {
      return sendError(res, "Invalid phone number format", 400)
    }

    // Validate password
    if (!validatePassword(password)) {
      return sendError(res, "Password must be at least 4 characters", 400)
    }

    // Find distributor
    let distributor
    if (sapCode) {
      distributor = await Distributor.findOne({ sapCode })
    }

    if (!distributor) {
      return sendError(res, `Distributor not found ${sapCode}`, 404)
    }

    // Check if phone already exists for this distributor
    const existingDeliveryMan = await DeliveryMan.findOne({
      distributorId: distributor._id,
      phone: phone,
    })

    if (existingDeliveryMan) {
      return sendError(res, "Phone number already registered for this distributor", 400)
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create delivery man
    const deliveryMan = new DeliveryMan({
      distributorId: distributor._id,
      name: name.trim(),
      phone: phone,
      password: hashedPassword,
    })

    await deliveryMan.save()

    console.log("✅ Delivery man registered successfully")
    return sendSuccess(
      res,
      {
        id: deliveryMan._id,
        name: deliveryMan.name,
        phone: deliveryMan.phone,
        distributorId: distributor._id,
      },
      "User registered successfully",
    )
  }),
)

// Get user profile
router.get(
  "/profile",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id, role, type } = req.user

    let user = null

    if (type === "super_admin") {
      user = {
        id: "super_admin",
        name: "Super Admin",
        phone: SUPER_ADMIN_PHONE,
        sapCode: SUPER_ADMIN_SAP_CODE,
        role: "super_admin",
        type: "super_admin",
      }
    } else if (type === "delivery_man") {
      user = await DeliveryMan.findById(id).populate("distributorId", "agencyName").select("-password")
    } else if (type === "distributor_admin") {
      user = await Distributor.findById(id).select("-adminPassword -password")
    }

    if (!user) {
      return sendError(res, "User not found", 404)
    }

    return sendSuccess(res, { user }, "Profile fetched successfully")
  }),
)

module.exports = router
