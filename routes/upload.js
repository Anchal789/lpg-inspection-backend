const express = require("express")
const multer = require("multer")
const AWS = require("aws-sdk")
const { v4: uuidv4 } = require("uuid")
const { authenticateToken } = require("../middleware/auth")

const router = express.Router()

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
})

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true)
    } else {
      cb(new Error("Only image files are allowed"), false)
    }
  },
})

// Upload image to S3
router.post("/image", authenticateToken, upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No image file provided",
      })
    }

    const { inspectionId } = req.body
    const fileExtension = req.file.originalname.split(".").pop()
    const fileName = `inspections/${inspectionId}/${uuidv4()}.${fileExtension}`

    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: "public-read",
    }

    const result = await s3.upload(uploadParams).promise()

    res.json({
      success: true,
      data: {
        imageUrl: result.Location,
        fileName: fileName,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      },
    })
  } catch (error) {
    next(error)
  }
})

// Upload multiple images
router.post("/images", authenticateToken, upload.array("images", 5), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No image files provided",
      })
    }

    const { inspectionId } = req.body
    const uploadPromises = req.files.map(async (file) => {
      const fileExtension = file.originalname.split(".").pop()
      const fileName = `inspections/${inspectionId}/${uuidv4()}.${fileExtension}`

      const uploadParams = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: "public-read",
      }

      const result = await s3.upload(uploadParams).promise()

      return {
        imageUrl: result.Location,
        fileName: fileName,
        fileSize: file.size,
        mimeType: file.mimetype,
      }
    })

    const uploadedImages = await Promise.all(uploadPromises)

    res.json({
      success: true,
      data: uploadedImages,
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
