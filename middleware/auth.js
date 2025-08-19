const jwt = require("jsonwebtoken")
const { sendError } = require("../utils/errorHandler")

const auth = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1]

    if (!token) {
      return sendError(res, "Access token required", 401)
    }

    jwt.verify(token, process.env.JWT_SECRET || "your-secret-key", (err, decoded) => {
      if (err) {
        return sendError(res, "Invalid or expired token", 403)
      }

      req.user = decoded
      next()
    })
  } catch (error) {
    return sendError(res, "Authentication failed", 401)
  }
}

// Role-based middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, "Authentication required", 401)
    }

    if (!roles.includes(req.user.role)) {
      return sendError(res, "Insufficient permissions", 403)
    }

    next()
  }
}

module.exports = auth
module.exports.requireRole = requireRole
