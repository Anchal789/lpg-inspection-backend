const jwt = require("jsonwebtoken")

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Access token required",
    })
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error("Token verification error:", err)
      return res.status(403).json({
        success: false,
        error: "Invalid or expired token",
      })
    }

    req.user = user
    next()
  })
}

const requireSuperAdmin = (req, res, next) => {
  if (req.user.type !== "super_admin") {
    return res.status(403).json({
      success: false,
      error: "Super admin access required",
    })
  }
  next()
}

const requireDistributorAdmin = (req, res, next) => {
  if (req.user.type !== "distributor_admin") {
    return res.status(403).json({
      success: false,
      error: "Distributor admin access required",
    })
  }
  next()
}

const requireDeliveryMan = (req, res, next) => {
  if (req.user.type !== "delivery_man") {
    return res.status(403).json({
      success: false,
      error: "Delivery man access required",
    })
  }
  next()
}

module.exports = {
  authenticateToken,
  requireSuperAdmin,
  requireDistributorAdmin,
  requireDeliveryMan,
}
