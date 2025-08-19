// Success response handler
const sendSuccess = (res, data, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  })
}

// Error response handler
const sendError = (res, message = "Internal Server Error", statusCode = 500, error = null) => {
  console.error("API Error:", { message, statusCode, error })
  return res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === "development" ? error : undefined,
    timestamp: new Date().toISOString(),
  })
}

// Async handler wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// JWT Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return sendError(res, "Access token required", 401)
  }

  const jwt = require("jsonwebtoken")
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
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
