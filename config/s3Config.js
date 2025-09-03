// config/s3Config.js
const AWS = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");

// Configure AWS with explicit configuration
AWS.config.update({
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	region: process.env.AWS_REGION,
});

const s3 = new AWS.S3({
	apiVersion: "2006-03-01",
	region: process.env.AWS_REGION,
	signatureVersion: "v4",
});

// Test S3 connection on startup
const testS3Connection = async () => {
	try {
		console.log("🧪 Testing S3 connection...");
		const data = await s3.listBuckets().promise();
		console.log("✅ S3 Connection Test Successful");

		const bucketNames = data.Buckets.map((b) => b.Name);
		console.log("Available buckets:", bucketNames);

		// Check if target bucket exists
		if (!bucketNames.includes(process.env.S3_BUCKET_NAME)) {
			console.error(
				`❌ Target bucket '${process.env.S3_BUCKET_NAME}' not found`
			);
		} else {
			console.log(`✅ Target bucket '${process.env.S3_BUCKET_NAME}' found`);
		}

		// Test bucket access
		try {
			await s3.headBucket({ Bucket: process.env.S3_BUCKET_NAME }).promise();
			console.log("✅ Bucket access confirmed");
		} catch (accessError) {
			console.error("❌ Bucket access test failed:", accessError.code);
		}
	} catch (err) {
		console.error("❌ S3 Connection Test Failed:", err.code, err.message);
		if (err.code === "InvalidAccessKeyId") {
			console.error("   -> Check your AWS_ACCESS_KEY_ID");
		} else if (err.code === "SignatureDoesNotMatch") {
			console.error("   -> Check your AWS_SECRET_ACCESS_KEY");
		} else if (err.code === "TokenRefreshRequired") {
			console.error("   -> Your AWS credentials may have expired");
		}
	}
};

// Run connection test
testS3Connection();

// Configure multer-s3 for direct upload to S3
const s3Storage = multerS3({
	s3: s3,
	bucket: process.env.S3_BUCKET_NAME,
	// Remove ACL since your bucket policy handles access
	// acl: "public-read", // Commented out
	contentType: multerS3.AUTO_CONTENT_TYPE,
	metadata: function (req, file, cb) {
		console.log("📋 Setting S3 metadata for file:", file.originalname);
		cb(null, {
			fieldName: file.fieldname,
			userId: req.user?.id?.toString() || "unknown",
			userType: req.user?.type || "unknown",
			uploadedAt: new Date().toISOString(),
			originalName: file.originalname,
		});
	},
	key: function (req, file, cb) {
		console.log("🔑 Generating S3 key for file:", file.originalname);

		const { inspectionId } = req.body;
		const timestamp = Date.now();
		const randomString = Math.round(Math.random() * 1e9);
		const extension = file.originalname.split(".").pop() || "jpg";

		// Create organized folder structure
		const folder = req.user?.type || "general";
		const filename = inspectionId
			? `${folder}/inspections/${inspectionId}/${timestamp}-${randomString}.${extension}`
			: `${folder}/${file.fieldname}-${timestamp}-${randomString}.${extension}`;

		console.log("Generated S3 key:", filename);
		cb(null, filename);
	},
});

const fileFilter = (req, file, cb) => {
	console.log("🔍 File filter check:", {
		originalname: file.originalname,
		mimetype: file.mimetype,
		fieldname: file.fieldname,
		size: file.size,
	});

	// Allow images and PDFs with more flexible checking
	const allowedExtensions = ["jpeg", "jpg", "png", "gif", "pdf"];
	const allowedMimeTypes = [
		"image/jpeg",
		"image/jpg",
		"image/png",
		"image/gif",
		"application/pdf",
	];

	// Get file extension
	const fileExtension = file.originalname.split(".").pop()?.toLowerCase();

	// Check both extension and mime type
	const isValidExtension = allowedExtensions.includes(fileExtension);
	const isValidMimeType = allowedMimeTypes.includes(file.mimetype);

	if (isValidExtension && isValidMimeType) {
		console.log("✅ File type accepted:", file.mimetype);
		return cb(null, true);
	} else {
		console.log("❌ File type rejected:", {
			extension: fileExtension,
			mimetype: file.mimetype,
			validExtension: isValidExtension,
			validMimeType: isValidMimeType,
		});
		cb(
			new Error(
				`File type not allowed. Allowed types: ${allowedExtensions.join(", ")}`
			)
		);
	}
};

const uploadToS3 = multer({
	storage: s3Storage,
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB limit
		fieldSize: 10 * 1024 * 1024, // 10MB field size
	},
	fileFilter: fileFilter,
});

// Enhanced upload wrapper with better error handling
const uploadWrapper = {
	single: (fieldName) => {
		return (req, res, next) => {
			console.log(`🔄 Processing single file upload for field: ${fieldName}`);
			console.log("Request details:", {
				"content-type": req.get("content-type"),
				"content-length": req.get("content-length"),
				"user-agent": req.get("user-agent"),
				authorization: req.get("authorization") ? "Present" : "Missing",
				body: req.body ? "Present" : "Missing",
			});

			const upload = uploadToS3.single(fieldName);

			upload(req, res, (err) => {
				if (err) {
					console.error("❌ Upload error details:", {
						message: err.message,
						code: err.code,
						name: err.name,
						statusCode: err.statusCode,
						stack: err.stack,
					});

					// Enhanced error handling
					let errorMessage = "Upload failed";
					let statusCode = 500;

					switch (err.code) {
						case "NoSuchBucket":
							errorMessage = `S3 bucket '${process.env.S3_BUCKET_NAME}' does not exist`;
							statusCode = 500;
							break;
						case "InvalidAccessKeyId":
							errorMessage = "Invalid AWS credentials - check access key";
							statusCode = 500;
							break;
						case "SignatureDoesNotMatch":
							errorMessage = "Invalid AWS credentials - check secret key";
							statusCode = 500;
							break;
						case "AccessDenied":
							errorMessage = "S3 access denied - check bucket permissions";
							statusCode = 403;
							break;
						case "LIMIT_FILE_SIZE":
							errorMessage = "File too large. Maximum size is 10MB";
							statusCode = 400;
							break;
						case "LIMIT_FIELD_VALUE":
							errorMessage = "Field value too large";
							statusCode = 400;
							break;
						case "LIMIT_UNEXPECTED_FILE":
							errorMessage = `Unexpected field name. Expected: ${fieldName}`;
							statusCode = 400;
							break;
						default:
							if (err.message.includes("File type not allowed")) {
								errorMessage = err.message;
								statusCode = 400;
							} else if (err.message.includes("Unexpected field")) {
								errorMessage = `Invalid field name. Expected: ${fieldName}`;
								statusCode = 400;
							} else {
								errorMessage = `Upload failed: ${err.message}`;
								statusCode = 500;
							}
					}

					return res.status(statusCode).json({
						success: false,
						error: errorMessage,
						code: err.code,
						timestamp: new Date().toISOString(),
						debug:
							process.env.NODE_ENV === "development"
								? {
										originalError: err.message,
										stack: err.stack,
								  }
								: undefined,
					});
				}

				// Success logging
				if (req.file) {
					console.log("✅ File uploaded successfully:", {
						key: req.file.key,
						location: req.file.location,
						size: req.file.size,
						mimetype: req.file.mimetype,
						bucket: req.file.bucket,
					});
				} else {
					console.log("⚠️ Upload completed but no file found in request");
				}

				next();
			});
		};
	},

	array: (fieldName, maxCount) => {
		return (req, res, next) => {
			console.log(
				`🔄 Processing array file upload for field: ${fieldName}, max: ${maxCount}`
			);

			const upload = uploadToS3.array(fieldName, maxCount);

			upload(req, res, (err) => {
				if (err) {
					console.error("❌ Array upload error:", err);

					let errorMessage = `Upload failed: ${err.message}`;
					let statusCode = 500;

					if (err.code === "LIMIT_FILE_COUNT") {
						errorMessage = `Too many files. Maximum allowed: ${maxCount}`;
						statusCode = 400;
					}

					return res.status(statusCode).json({
						success: false,
						error: errorMessage,
						code: err.code,
						timestamp: new Date().toISOString(),
					});
				}

				console.log(
					`✅ Array upload completed, ${req.files?.length || 0} files processed`
				);
				next();
			});
		};
	},
};

// Enhanced delete function with better error handling
const deleteFromS3 = async (key) => {
	console.log("🗑️ Deleting from S3:", key);

	try {
		const result = await s3
			.deleteObject({
				Bucket: process.env.S3_BUCKET_NAME,
				Key: key,
			})
			.promise();

		console.log("✅ Successfully deleted from S3:", key);
		return result;
	} catch (err) {
		console.error("❌ S3 delete error:", err);
		throw new Error(`Failed to delete file from S3: ${err.message}`);
	}
};

// Helper function to generate signed URLs for private access
const getSignedUrl = (key, expires = 3600) => {
	console.log("🔗 Generating signed URL for:", key);

	try {
		const url = s3.getSignedUrl("getObject", {
			Bucket: process.env.S3_BUCKET_NAME,
			Key: key,
			Expires: expires,
		});
		return url;
	} catch (err) {
		console.error("❌ Error generating signed URL:", err);
		throw new Error(`Failed to generate signed URL: ${err.message}`);
	}
};

// Health check function
const healthCheck = async () => {
	try {
		await s3.headBucket({ Bucket: process.env.S3_BUCKET_NAME }).promise();
		return { status: "healthy", timestamp: new Date().toISOString() };
	} catch (err) {
		return {
			status: "unhealthy",
			error: err.message,
			timestamp: new Date().toISOString(),
		};
	}
};

module.exports = {
	uploadToS3: uploadWrapper,
	deleteFromS3,
	getSignedUrl,
	healthCheck,
	s3,
};
