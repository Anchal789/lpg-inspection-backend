const mongoose = require("mongoose")
require("dotenv").config()

const verifySetup = async () => {
  console.log("🔍 Verifying LPG Inspection Backend Setup...")

  // Check environment variables
  console.log("\n📋 Environment Variables:")
  const requiredEnvVars = [
    "MONGODB_CONNECTION_STRING",
    "JWT_SECRET",
    "SUPER_ADMIN_SAP_CODE",
    "SUPER_ADMIN_PHONE",
    "SUPER_ADMIN_PASSWORD",
  ]

  let envVarsOk = true
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar}: Set`)
    } else {
      console.log(`❌ ${envVar}: Missing`)
      envVarsOk = false
    }
  }

  if (!envVarsOk) {
    console.log("\n❌ Please set all required environment variables in .env file")
    return false
  }

  // Test MongoDB connection
  console.log("\n🔗 Testing MongoDB Connection...")
  try {
    await mongoose.connect(process.env.MONGODB_CONNECTION_STRING, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    console.log("✅ MongoDB connection successful")
    await mongoose.disconnect()
  } catch (error) {
    console.log("❌ MongoDB connection failed:", error.message)
    return false
  }

  // Check if server can start
  console.log("\n🚀 Server Configuration:")
  console.log(`✅ Port: ${process.env.PORT || 3000}`)
  console.log(`✅ Environment: ${process.env.NODE_ENV || "development"}`)

  console.log("\n✅ Setup verification completed successfully!")
  console.log("\n🚀 You can now start the server with: npm start")

  return true
}

// Run verification if this file is executed directly
if (require.main === module) {
  verifySetup()
    .then((success) => {
      process.exit(success ? 0 : 1)
    })
    .catch((error) => {
      console.error("Verification failed:", error)
      process.exit(1)
    })
}

module.exports = { verifySetup }
