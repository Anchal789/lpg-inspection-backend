const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const Distributor = require("../models/Distributor")
const DeliveryMan = require("../models/DeliveryMan")
const DistributorRequest = require("../models/DistributorRequest")
const { validateInput } = require("../utils/validators")
const { authenticateToken } = require("../middleware/auth")
const router = express.Router()

// Validate SAP Code
router.post("/validate-sap", async (req, res) => {
  try {
    console.log("🔍 SAP Code validation request:", req.body)
    const { sapCode } = req.body

    if (!sapCode) {
      return res.status(400).json({
        success: false,
        error: "SAP code is required",
      })
    }

    // Check if it's super admin SAP code
    if (sapCode === process.env.SUPER_ADMIN_SAP_CODE || sapCode === "000000") {
      console.log("✅ Super Admin SAP code validated")
      return res.json({
        success: true,
        message: "Super Admin SAP code validated",
        data: {
          type: "super_admin",
          name: "Super Admin",
          sapCode: sapCode,
        },
      })
    }

    // Check if distributor exists with this SAP code
    const distributor = await Distributor.findOne({ sapCode })
    if (distributor) {
      console.log("✅ Distributor SAP code validated:", distributor.agencyName)
      return res.json({
        success: true,
        message: "Distributor SAP code validated",
        data: {
          type: "distributor",
          name: distributor.agencyName,
          sapCode: sapCode,
          distributorId: distributor._id,
        },
      })
    }

    // Check if there's a pending request for this SAP code
    const pendingRequest = await DistributorRequest.findOne({ sapCode, status: "pending" })
    if (pendingRequest) {
      console.log("⏳ Pending distributor request found")
      return res.json({
        success: false,
        error: "Registration request is pending approval",
        data: {
          type: "pending",
          sapCode: sapCode,
        },
      })
    }

    // SAP code not found
    console.log("❌ SAP code not found:", sapCode)
    return res.status(404).json({
      success: false,
      error: "SAP code not found. Please register first or contact admin.",
    })
  } catch (error) {
    console.error("❌ SAP validation error:", error)
    res.status(500).json({
      success: false,
      error: "Server error during SAP code validation",
      message: error.message,
    })
  }
})

// Login
router.post("/login", async (req, res) => {
  try {
    console.log("🔐 Login request:", { ...req.body, password: "***" })
    const { phone, password, sapCode } = req.body

    // Validate required fields
    if (!phone || !password || !sapCode) {
      return res.status(400).json({
        success: false,
        error: "Phone, password, and SAP code are required",
      })
    }

    // Check if it's super admin login
    if (sapCode === process.env.SUPER_ADMIN_SAP_CODE || sapCode === "000000") {
      if (phone === process.env.SUPER_ADMIN_PHONE && password === process.env.SUPER_ADMIN_PASSWORD) {
        const token = jwt.sign(
          {
            id: "super_admin",
            type: "super_admin",
            sapCode: sapCode,
          },
          process.env.JWT_SECRET,
          { expiresIn: "24h" },
        )

        console.log("✅ Super Admin login successful")
        return res.json({
          success: true,
          message: "Super Admin login successful",
          data: {
            token,
            user: {
              id: "super_admin",
              name: "Super Admin",
              phone: phone,
              type: "super_admin",
              role: "super_admin",
              sapCode: sapCode,
            },
          },
        })
      } else {
        console.log("❌ Invalid super admin credentials")
        return res.status(401).json({
          success: false,
          error: "Invalid super admin credentials",
        })
      }
    }

    // Check distributor login
    const distributor = await Distributor.findOne({ sapCode })
    if (distributor) {
      // Check if it's admin login
      if (phone === distributor.adminPhone) {
        const isValidPassword = await bcrypt.compare(password, distributor.adminPassword)
        if (isValidPassword) {
          const token = jwt.sign(
            {
              id: distributor._id,
              type: "distributor_admin",
              sapCode: sapCode,
              distributorId: distributor._id,
            },
            process.env.JWT_SECRET,
            { expiresIn: "24h" },
          )

          console.log("✅ Distributor admin login successful")
          return res.json({
            success: true,
            message: "Distributor admin login successful",
            data: {
              token,
              user: {
                id: distributor._id,
                name: distributor.adminName,
                phone: phone,
                type: "distributor_admin",
                role: "admin",
                sapCode: sapCode,
                agencyName: distributor.agencyName,
                distributorId: distributor._id,
              },
            },
          })
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
              sapCode: sapCode,
              distributorId: distributor._id,
              deliveryManId: deliveryMan._id,
            },
            process.env.JWT_SECRET,
            { expiresIn: "24h" },
          )

          console.log("✅ Delivery man login successful")
          return res.json({
            success: true,
            message: "Delivery man login successful",
            data: {
              token,
              user: {
                id: deliveryMan._id,
                name: deliveryMan.name,
                phone: phone,
                type: "delivery_man",
                role: "delivery",
                sapCode: sapCode,
                distributorId: distributor._id,
                deliveryManId: deliveryMan._id,
              },
            },
          })
        }
      }
    }

    console.log("❌ Invalid login credentials")
    return res.status(401).json({
      success: false,
      error: "Invalid phone number or password",
    })
  } catch (error) {
    console.error("❌ Login error:", error)
    res.status(500).json({
      success: false,
      error: "Server error during login",
      message: error.message,
    })
  }
})

// Register Distributor
router.post("/register-distributor", async (req, res) => {
  try {
    console.log("📝 Distributor registration request:", { ...req.body, adminPassword: "***" })
    const { sapCode, agencyName, adminName, adminPhone, adminPassword, deliveryMen } = req.body

    // Validate required fields
    if (!sapCode || !agencyName || !adminName || !adminPhone || !adminPassword) {
      return res.status(400).json({
        success: false,
        error: "All fields are required",
      })
    }

    // Validate SAP code format
    if (sapCode.length < 5 || sapCode.length > 10) {
      return res.status(400).json({
        success: false,
        error: "SAP code must be between 5 and 10 characters",
      })
    }

    // Validate agency name
    if (agencyName.length < 3 || agencyName.length > 40) {
      return res.status(400).json({
        success: false,
        error: "Agency name must be between 3 and 40 characters",
      })
    }

    // Validate admin name
    if (adminName.length < 3 || adminName.length > 40) {
      return res.status(400).json({
        success: false,
        error: "Admin name must be between 3 and 40 characters",
      })
    }

    // Validate phone number
    if (!/^\d{10}$/.test(adminPhone)) {
      return res.status(400).json({
        success: false,
        error: "Phone number must be exactly 10 digits",
      })
    }

    // Validate password
    if (adminPassword.length < 4) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 4 characters",
      })
    }

    // Check if SAP code already exists
    const existingDistributor = await Distributor.findOne({ sapCode })
    if (existingDistributor) {
      return res.status(400).json({
        success: false,
        error: "SAP code already registered",
      })
    }

    // Check if there's already a pending request
    const existingRequest = await DistributorRequest.findOne({ sapCode, status: "pending" })
    if (existingRequest) {
      return res.status(400).json({
        success: false,
        error: "Registration request already pending",
      })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    // Hash delivery men passwords if provided
    let processedDeliveryMen = []
    if (deliveryMen && Array.isArray(deliveryMen)) {
      processedDeliveryMen = await Promise.all(
        deliveryMen.map(async (dm) => ({
          name: dm.name,
          phone: dm.phone,
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
      deliveryMen: processedDeliveryMen,
      status: "pending",
      requestDate: new Date(),
    })

    await distributorRequest.save()

    console.log("✅ Distributor registration request created")
    res.json({
      success: true,
      message: "Registration request submitted successfully. Please wait for admin approval.",
      data: {
        requestId: distributorRequest._id,
        sapCode: sapCode,
        status: "pending",
      },
    })
  } catch (error) {
    console.error("❌ Registration error:", error)
    res.status(500).json({
      success: false,
      error: "Server error during registration",
      message: error.message,
    })
  }
})

// Register User (Delivery Man) - MISSING ROUTE
router.post("/register", authenticateToken, async (req, res) => {
  try {
    console.log("📝 User registration request:", { ...req.body, password: "***" })
    const { name, phone, password, role } = req.body

    // Validate required fields
    if (!name || !phone || !password) {
      return res.status(400).json({
        success: false,
        error: "Name, phone, and password are required",
      })
    }

    // Validate name
    if (name.length < 3 || name.length > 40) {
      return res.status(400).json({
        success: false,
        error: "Name must be between 3 and 40 characters",
      })
    }

    // Validate phone number
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid 10-digit Indian mobile number",
      })
    }

    // Validate password
    if (password.length < 4) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 4 characters",
      })
    }

    // Get distributor ID from token
    const distributorId = req.user.distributorId || req.user.id

    // Check if phone number already exists for this distributor
    const existingDeliveryMan = await DeliveryMan.findOne({
      distributorId: distributorId,
      phone: phone,
    })

    if (existingDeliveryMan) {
      return res.status(400).json({
        success: false,
        error: "Phone number already registered",
      })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create delivery man
    const deliveryMan = new DeliveryMan({
      distributorId: distributorId,
      name: name.trim(),
      phone: phone,
      password: hashedPassword,
      isActive: true,
      createdAt: new Date(),
    })

    await deliveryMan.save()

    console.log("✅ Delivery man registered successfully")
    res.json({
      success: true,
      message: "User registered successfully",
      data: {
        id: deliveryMan._id,
        name: deliveryMan.name,
        phone: deliveryMan.phone,
        distributorId: deliveryMan.distributorId,
      },
    })
  } catch (error) {
    console.error("❌ User registration error:", error)
    res.status(500).json({
      success: false,
      error: "Server error during user registration",
      message: error.message,
    })
  }
})

// Get user profile
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const user = req.user
    res.json({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error("❌ Profile fetch error:", error)
    res.status(500).json({
      success: false,
      error: "Server error fetching profile",
      message: error.message,
    })
  }
})

// Logout
router.post("/logout", authenticateToken, async (req, res) => {
  try {
    // In a real app, you might want to blacklist the token
    res.json({
      success: true,
      message: "Logged out successfully",
    })
  } catch (error) {
    console.error("❌ Logout error:", error)
    res.status(500).json({
      success: false,
      error: "Server error during logout",
      message: error.message,
    })
  }
})

module.exports = router
