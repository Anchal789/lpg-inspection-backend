// config/s3Config.js
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

// Configure multer-s3 for direct upload to S3
const s3Storage = multerS3({
  s3: s3,
  bucket: process.env.S3_BUCKET_NAME,
  acl: 'public-read', // Make files publicly readable
  metadata: function (req, file, cb) {
    cb(null, {
      fieldName: file.fieldname,
      userId: req.user.id.toString(),
      userType: req.user.type,
      uploadedAt: new Date().toISOString()
    });
  },
  key: function (req, file, cb) {
    const { inspectionId } = req.body;
    const timestamp = Date.now();
    const randomString = Math.round(Math.random() * 1e9);
    const extension = file.originalname.split('.').pop();
    
    // Create organized folder structure
    const folder = req.user.type || 'general';
    const filename = inspectionId 
      ? `${folder}/inspections/${inspectionId}/${timestamp}-${randomString}.${extension}`
      : `${folder}/${file.fieldname}-${timestamp}-${randomString}.${extension}`;
    
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow images and PDFs
  const allowedTypes = /jpeg|jpg|png|gif|pdf/;
  const extname = allowedTypes.test(file.originalname.split('.').pop().toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only images (JPEG, JPG, PNG, GIF) and PDF files are allowed"));
  }
};

const uploadToS3 = multer({
  storage: s3Storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: fileFilter,
});

// Helper function to delete files from S3
const deleteFromS3 = (key) => {
  return new Promise((resolve, reject) => {
    s3.deleteObject({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key
    }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

// Helper function to generate signed URLs for private access (if needed)
const getSignedUrl = (key, expires = 3600) => {
  return s3.getSignedUrl('getObject', {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Expires: expires
  });
};

module.exports = {
  uploadToS3,
  deleteFromS3,
  getSignedUrl,
  s3
};