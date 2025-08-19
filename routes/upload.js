const express = require("express")
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const { sendSuccess, sendError, asyncHandler } = require("../utils/errorHandler")
const auth = require("../middleware/auth")

const router = express.Router()

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../uploads")
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(uploadsDir, "inspections")
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true })
    }
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname))
  },
})

const fileFilter = (req, file, cb) => {
  // Allow images only
  if (file.mimetype.startsWith("image/")) {
    cb(null, true)
  } else {
    cb(new Error("Only image files are allowed"), false)
  }
}

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10, // Maximum 10 files
  },
  fileFilter: fileFilter,
})

// Upload inspection images
router.post(
  "/inspection-images",
  auth,
  upload.array("images", 10),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return sendError(res, "No files uploaded", 400)
    }

    const uploadedFiles = req.files.map((file) => ({
      filename: file.filename,
      originalName: file.originalname,
      path: `/uploads/inspections/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype,
    }))

    return sendSuccess(
      res,
      {
        files: uploadedFiles,
      },
      "Files uploaded successfully",
    )
  }),
)

// Upload single image
router.post(
  "/single-image",
  auth,
  upload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return sendError(res, "No file uploaded", 400)
    }

    const uploadedFile = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: `/uploads/inspections/${req.file.filename}`,
      size: req.file.size,
      mimetype: req.file.mimetype,
    }

    return sendSuccess(
      res,
      {
        file: uploadedFile,
      },
      "File uploaded successfully",
    )
  }),
)

// Get uploaded file
router.get("/file/:filename", (req, res) => {
  const { filename } = req.params
  const filePath = path.join(uploadsDir, "inspections", filename)

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: "File not found",
    })
  }

  res.sendFile(filePath)
})

// Delete uploaded file
router.delete(
  "/file/:filename",
  auth,
  asyncHandler(async (req, res) => {
    const { filename } = req.params
    const filePath = path.join(uploadsDir, "inspections", filename)

    if (!fs.existsSync(filePath)) {
      return sendError(res, "File not found", 404)
    }

    fs.unlinkSync(filePath)

    return sendSuccess(
      res,
      {
        message: "File deleted successfully",
      },
      "File deleted",
    )
  }),
)

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return sendError(res, "File too large. Maximum size is 10MB", 400)
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return sendError(res, "Too many files. Maximum is 10 files", 400)
    }
  }

  if (error.message === "Only image files are allowed") {
    return sendError(res, "Only image files are allowed", 400)
  }

  return sendError(res, error.message || "Upload failed", 500)
})

module.exports = router
