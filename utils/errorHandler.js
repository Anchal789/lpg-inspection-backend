// Success response helper
const sendSuccess = (res, data = null, message = "Success", statusCode = 200) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString(),
  }

  if (data !== null) {
    response.data = data
  }

  return res.status(statusCode).json(response)
}

// Error response helper
const sendError = (res, message = "An error occurred", statusCode = 500, error = null) => {
  const response = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  }

  if (error && process.env.NODE_ENV === "development") {
    response.details = error
  }

  console.error(`❌ Error ${statusCode}:`, message, error || "")
  return res.status(statusCode).json(response)
}

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

// Authentication token middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return sendError(res, "Access token required", 401)
  }

  const jwt = require("jsonwebtoken")
  const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error("❌ Token verification failed:", err.message)
      return sendError(res, "Invalid or expired token", 403)
    }

    req.user = user
    next()
  })
}

module.exports = {
  sendSuccess,
  sendError,
  asyncHandler,
  authenticateToken,
}
