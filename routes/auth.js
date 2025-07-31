const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const DeliveryMan = require("../models/DeliveryMan")
const Distributor = require("../models/Distributor")
const { validatePhone, validateSapCode, validatePassword } = require("../utils/validators")
const { handleError } = require("../utils/errorHandler")

const router = express.Router()

// Validate SAP Code endpoint
router.post("/validate-sap", async (req, res) => {
  try {
    const { sapCode } = req.body

    if (!sapCode) {
      return res.status(400).json({
        success: false,
        message: "SAP code is required",
      })
    }

    // Check for super admin SAP code
    if (sapCode === "000000") {
      return res.json({
        success: true,
        message: "Super Admin SAP code validated",
        data: {
          type: "super_admin",
          name: "Super Admin",
        },
      })
    }

    // Validate SAP code format
    if (!validateSapCode(sapCode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid SAP code format. Must be 5-10 alphanumeric characters.",
      })
    }

    // Check if distributor exists with this SAP code
    const distributor = await Distributor.findOne({ sapCode: sapCode.toUpperCase() })

    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: "SAP code not found. Please contact administrator.",
      })
    }

    res.json({
      success: true,
      message: "SAP code validated successfully",
      data: {
        type: "distributor",
        name: distributor.agencyName,
        distributorId: distributor._id,
      },
    })
  } catch (error) {
    console.error("SAP validation error:", error)
    handleError(res, error, "SAP code validation failed")
  }
})

// Login route for all user types
router.post("/login", async (req, res) => {
  try {
    const { sapCode, phone, password } = req.body

    // Validate input
    if (!sapCode || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "SAP code, phone, and password are required",
      })
    }

    // Check for super admin login
    if (sapCode === "000000" && phone === "0987654321" && password === "7228") {
      const token = jwt.sign(
        {
          id: "super_admin",
          role: "super_admin",
          sapCode: sapCode,
          phone: phone,
        },
        process.env.JWT_SECRET,
        { expiresIn: "24h" },
      )

      return res.json({
        success: true,
        message: "Super admin login successful",
        data: {
          token,
          user: {
            id: "super_admin",
            role: "super_admin",
            name: "Super Admin",
            sapCode: sapCode,
            phone: phone,
          },
        },
      })
    }

    // Validate SAP code format
    if (!validateSapCode(sapCode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid SAP code format",
      })
    }

    // Validate phone format
    if (!validatePhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format",
      })
    }

    // Check for distributor admin login
    const distributor = await Distributor.findOne({ sapCode: sapCode.toUpperCase() })

    if (distributor && distributor.adminPhone === phone) {
      // Check password
      const isPasswordValid = await bcrypt.compare(password, distributor.adminPassword)
      if (isPasswordValid) {
        const token = jwt.sign(
          {
            id: distributor._id,
            role: "admin",
            sapCode: distributor.sapCode,
          },
          process.env.JWT_SECRET,
          { expiresIn: "24h" },
        )

        return res.json({
          success: true,
          message: "Admin login successful",
          data: {
            token,
            user: {
              id: distributor._id,
              role: "admin",
              name: distributor.adminName,
              sapCode: distributor.sapCode,
              phone: distributor.adminPhone,
              agencyName: distributor.agencyName,
            },
          },
        })
      }
    }

    // Check for delivery man login
    const deliveryMan = await DeliveryMan.findOne({ sapCode: sapCode.toUpperCase(), phone }).populate("distributorId")

    if (!deliveryMan) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    // Check if delivery man is approved
    if (deliveryMan.status !== "approved") {
      return res.status(401).json({
        success: false,
        message: "Your account is not approved yet. Please contact your distributor.",
      })
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, deliveryMan.password)
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: deliveryMan._id,
        role: "delivery",
        distributorId: deliveryMan.distributorId._id,
        sapCode: deliveryMan.sapCode,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    )

    res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: deliveryMan._id,
          role: "delivery",
          name: deliveryMan.name,
          phone: deliveryMan.phone,
          sapCode: deliveryMan.sapCode,
          distributor: deliveryMan.distributorId.agencyName,
          distributorId: deliveryMan.distributorId._id,
        },
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    handleError(res, error, "Login failed")
  }
})

module.exports = router
