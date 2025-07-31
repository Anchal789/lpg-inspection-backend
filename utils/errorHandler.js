const globalErrorHandler = (err, req, res, next) => {
	console.error("❌ Global Error:", {
		message: err.message,
		stack: err.stack,
		url: req.url,
		method: req.method,
		body: req.body,
		timestamp: new Date().toISOString(),
	});

	const errorResponse = {
		success: false,
		error: err.message || "Internal server error",
		timestamp: new Date().toISOString(),
		path: req.path,
		method: req.method,
		contactInfo: {
			developer: "Anchal Deshmukh",
			email: "anchaldesh7@gmail.com",
			phone: "+91 7747865603",
			message: "Please contact the developer if this error persists",
		},
	};

	// MongoDB validation errors
	if (err.name === "ValidationError") {
		const validationErrors = Object.values(err.errors).map((e) => e.message);
		errorResponse.error = "Validation failed";
		errorResponse.details = validationErrors;
		return res.status(400).json(errorResponse);
	}

	// MongoDB cast errors (invalid ObjectId)
	if (err.name === "CastError") {
		errorResponse.error = "Invalid ID format";
		return res.status(400).json(errorResponse);
	}

	// MongoDB duplicate key errors
	if (err.code === 11000) {
		const field = Object.keys(err.keyValue)[0];
		errorResponse.error = `Duplicate ${field}: ${err.keyValue[field]} already exists`;
		return res.status(409).json(errorResponse);
	}

	// JWT errors
	if (err.name === "JsonWebTokenError") {
		errorResponse.error = "Invalid token";
		return res.status(401).json(errorResponse);
	}

	if (err.name === "TokenExpiredError") {
		errorResponse.error = "Token expired";
		return res.status(401).json(errorResponse);
	}

	// Multer errors (file upload)
	if (err.code === "LIMIT_FILE_SIZE") {
		errorResponse.error = "File too large";
		return res.status(413).json(errorResponse);
	}

	// AWS S3 errors
	if (err.code && err.code.startsWith("AWS")) {
		errorResponse.error = "File upload failed";
		return res.status(500).json(errorResponse);
	}

	// Default server error
	res.status(500).json(errorResponse);
};

module.exports = globalErrorHandler;
