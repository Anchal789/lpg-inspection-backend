const jwt = require("jsonwebtoken")
const { sendError } = require("../utils/errorHandler")

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return sendError(res, "Access token required", 401)
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error("❌ Token verification failed:", err.message)
      return sendError(res, "Invalid or expired token", 403)
    }
    req.user = user
    next()
  })
}

// Role-based middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, "Authentication required", 401)
    }

    const userRole = req.user.type || req.user.role
    if (!roles.includes(userRole)) {
      return sendError(res, "Insufficient permissions", 403)
    }

    next()
  }
}

// Super admin only middleware
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.type !== "super_admin") {
    return sendError(res, "Super admin access required", 403)
  }
  next()
}

// Admin or super admin middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || !["super_admin", "distributor_admin"].includes(req.user.type)) {
    return sendError(res, "Admin access required", 403)
  }
  next()
}

module.exports = {
  authenticateToken,
  requireRole,
  requireSuperAdmin,
  requireAdmin,
}
