// Validate SAP Code (6 digits)
const validateSapCode = (sapCode) => {
  if (!sapCode.trim()) return false
  if (sapCode.length < 5) return false
  if (sapCode.length > 10) return false
  return true
}

// Validate phone number (10 digits)
const validatePhone = (phone) => {
  if (!phone) return false
  const phoneRegex = /^\d{10}$/
  return phoneRegex.test(phone)
}

// Validate password (minimum 4 characters)
const validatePassword = (password) => {
  if (!password) return false
  return password.length >= 4
}

// Validate email
const validateEmail = (email) => {
  if (!email) return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Validate name (3-40 characters, letters and spaces only)
const validateName = (name) => {
  if (!name) return false
  const nameRegex = /^[a-zA-Z\s]{3,40}$/
  return nameRegex.test(name.trim())
}

// Validate required fields
const validateRequired = (fields) => {
  const missing = []
  for (const [key, value] of Object.entries(fields)) {
    if (!value || (typeof value === "string" && value.trim() === "")) {
      missing.push(key)
    }
  }
  return missing
}

module.exports = {
  validateSapCode,
  validatePhone,
  validatePassword,
  validateEmail,
  validateName,
  validateRequired,
}
