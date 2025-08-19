// Input validation utilities without external dependencies

// Validate phone number (Indian format)
const validatePhone = (phone) => {
  if (!phone) return false
  const phoneStr = phone.toString().replace(/\s+/g, "")
  const phoneRegex = /^[6-9]\d{9}$/
  return phoneRegex.test(phoneStr)
}

// Validate SAP code format (allow super admin code)
const validateSapCode = (sapCode) => {
  if (!sapCode) return false
  const sapStr = sapCode.toString().toUpperCase()
  // Allow super admin SAP code "000000" or regular format
  if (sapStr === "000000") return true
  const sapRegex = /^[A-Z0-9]{6}$/
  return sapRegex.test(sapStr)
}

// Validate password strength
const validatePassword = (password) => {
  return password && password.length >= 4
}

// Validate email
const validateEmail = (email) => {
  if (!email) return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Validate required fields
const validateRequired = (fields, data) => {
  const missing = []
  fields.forEach((field) => {
    if (!data[field] || data[field].toString().trim() === "") {
      missing.push(field)
    }
  })
  return missing
}

// Validate date format
const validateDate = (dateString) => {
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date)
}

// Validate MongoDB ObjectId
const validateObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id)
}

// Sanitize input data
const sanitizeInput = (data) => {
  const sanitized = {}
  for (const key in data) {
    if (typeof data[key] === "string") {
      sanitized[key] = data[key].trim().replace(/[<>]/g, "")
    } else {
      sanitized[key] = data[key]
    }
  }
  return sanitized
}

// Validate inspection data
const validateInspectionData = (data) => {
  const errors = []

  const required = ["deliveryManId", "customerName", "customerPhone", "customerAddress"]
  const missing = validateRequired(required, data)
  if (missing.length > 0) {
    errors.push(`Missing required fields: ${missing.join(", ")}`)
  }

  if (data.customerPhone && !validatePhone(data.customerPhone)) {
    errors.push("Invalid phone number format")
  }

  if (data.deliveryManId && !validateObjectId(data.deliveryManId)) {
    errors.push("Invalid delivery man ID")
  }

  return errors
}

// Validate product data
const validateProductData = (data) => {
  const errors = []

  const required = ["name", "type", "serialNumber", "distributorId"]
  const missing = validateRequired(required, data)
  if (missing.length > 0) {
    errors.push(`Missing required fields: ${missing.join(", ")}`)
  }

  if (data.distributorId && !validateObjectId(data.distributorId)) {
    errors.push("Invalid distributor ID")
  }

  if (data.manufacturingDate && !validateDate(data.manufacturingDate)) {
    errors.push("Invalid manufacturing date")
  }

  if (data.expiryDate && !validateDate(data.expiryDate)) {
    errors.push("Invalid expiry date")
  }

  return errors
}

// Validate delivery man data
const validateDeliveryManData = (data) => {
  const errors = []

  const required = ["name", "phone", "password", "distributorId", "sapCode"]
  const missing = validateRequired(required, data)
  if (missing.length > 0) {
    errors.push(`Missing required fields: ${missing.join(", ")}`)
  }

  if (data.phone && !validatePhone(data.phone)) {
    errors.push("Invalid phone number format")
  }

  if (data.password && !validatePassword(data.password)) {
    errors.push("Password must be at least 4 characters long")
  }

  if (data.distributorId && !validateObjectId(data.distributorId)) {
    errors.push("Invalid distributor ID")
  }

  if (data.sapCode && !validateSapCode(data.sapCode)) {
    errors.push("Invalid SAP code format")
  }

  return errors
}

module.exports = {
  validatePhone,
  validateSapCode,
  validatePassword,
  validateEmail,
  validateRequired,
  validateDate,
  validateObjectId,
  sanitizeInput,
  validateInspectionData,
  validateProductData,
  validateDeliveryManData,
}
