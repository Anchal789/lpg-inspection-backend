const express = require("express");
const { sendSuccess, sendError, asyncHandler } = require("../utils/errorHandler");
const { authenticateToken } = require("../middleware/auth");
const { uploadToS3, deleteFromS3 } = require("../config/s3Config");

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Upload single file to S3
router.post(
  "/single",
  uploadToS3.single("file"),
  asyncHandler(async (req, res) => {
    console.log("📁 Single file upload request to S3");

    if (!req.file) {
      return sendError(res, "No file uploaded", 400);
    }

    console.log("✅ File uploaded to S3:", req.file.key);
    return sendSuccess(
      res,
      {
        filename: req.file.key.split('/').pop(),
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: req.file.location, // S3 URL
        key: req.file.key, // S3 key for deletion
      },
      "File uploaded successfully to S3"
    );
  })
);

// Upload multiple files to S3
router.post(
  "/multiple",
  uploadToS3.array("files", 10), // Max 10 files
  asyncHandler(async (req, res) => {
    console.log("📁 Multiple files upload request to S3");

    if (!req.files || req.files.length === 0) {
      return sendError(res, "No files uploaded", 400);
    }

    const files = req.files.map((file) => ({
      filename: file.key.split('/').pop(),
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      url: file.location, // S3 URL
      key: file.key, // S3 key for deletion
    }));

    console.log(`✅ ${files.length} files uploaded to S3`);
    return sendSuccess(res, { files }, "Files uploaded successfully to S3");
  })
);

// Upload inspection images to S3 with inspection ID
router.post(
  "/inspection-images",
  uploadToS3.array("images", 5), // Max 5 images for inspection
  asyncHandler(async (req, res) => {
    console.log("📸 Inspection images upload request to S3");
    console.log("Inspection ID from body:", req.body.inspectionId);

    if (!req.files || req.files.length === 0) {
      return sendError(res, "No images uploaded", 400);
    }

    const images = req.files.map((file) => ({
      imageId: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      filename: file.key.split('/').pop(),
      originalName: file.originalname,
      size: file.size,
      url: file.location, // S3 URL - this is what you'll save in inspection
      key: file.key, // S3 key for deletion
      uploadedAt: new Date(),
    }));

    console.log(`✅ ${images.length} inspection images uploaded to S3`);
    return sendSuccess(
      res, 
      { images }, 
      "Inspection images uploaded successfully to S3"
    );
  })
);

// Upload signature to S3
router.post(
  "/signature",
  uploadToS3.single("signature"),
  asyncHandler(async (req, res) => {
    console.log("✍️ Signature upload request to S3");

    if (!req.file) {
      return sendError(res, "No signature uploaded", 400);
    }

    console.log("✅ Signature uploaded to S3:", req.file.key);
    return sendSuccess(
      res,
      {
        filename: req.file.key.split('/').pop(),
        url: req.file.location, // S3 URL
        key: req.file.key,
      },
      "Signature uploaded successfully to S3"
    );
  })
);

// Delete file from S3
router.delete(
  "/:key(*)", // Allow slashes in the key parameter
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    console.log("🗑️ Deleting file from S3:", key);

    try {
      await deleteFromS3(key);
      console.log("✅ File deleted from S3:", key);
      return sendSuccess(res, null, "File deleted successfully from S3");
    } catch (error) {
      console.error("❌ Error deleting file from S3:", error);
      return sendError(res, "Failed to delete file from S3", 500);
    }
  })
);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  console.error("Upload error:", error);
  
  if (error.code === "LIMIT_FILE_SIZE") {
    return sendError(res, "File too large. Maximum size is 10MB", 400);
  }
  if (error.code === "LIMIT_FILE_COUNT") {
    return sendError(res, "Too many files. Maximum is 10 files", 400);
  }
  if (error.message.includes("Only images")) {
    return sendError(res, error.message, 400);
  }

  return sendError(res, "Upload failed", 500);
});

module.exports = router;