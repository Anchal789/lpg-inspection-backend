const express = require("express");
const { sendSuccess, sendError, asyncHandler } = require("../utils/errorHandler");
const { authenticateToken } = require("../middleware/auth");
const multer = require("multer");

// AWS SDK v3 imports
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const multerS3 = require("multer-s3");

const router = express.Router();

// AWS SDK v3 Configuration
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const myBucket = process.env.S3_BUCKET_NAME;

// Multer configuration with AWS SDK v3
const upload = multer({
    storage: multerS3({
        s3: s3Client,
        bucket: myBucket,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: function (req, file, cb) {
            const timestamp = Date.now();
            const userId = req.user?.id || 'anonymous';
            const fileExtension = file.originalname.split('.').pop();
            const uniqueKey = `uploads/${userId}/${timestamp}-${file.originalname}`;
            cb(null, uniqueKey);
        },
    }),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

router.use(authenticateToken);

router.post(
    "/single",
    upload.single("file"),
    asyncHandler(async (req, res) => {
        if (!req.file) {
            return sendError(
                res,
                "No file uploaded. Make sure the field name is 'file'",
                400
            );
        }


        const responseData = {
            filename: req.file.key.split("/").pop(),
            originalName: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            url: req.file.location,
            key: req.file.key,
            bucket: req.file.bucket,
            uploadedAt: new Date().toISOString(),
            metadata: {
                userId: req.user?.id,
                userType: req.user?.type,
            },
        };

        console.log("✅ File uploaded to S3 successfully:", responseData);

        return sendSuccess(res, responseData, "File uploaded successfully to S3");
    })
);

module.exports = router;