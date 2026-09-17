import multer from "multer";
import path from "path";

// 5 MB maximum allowed file size
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// Allowed image MIME types and file extensions
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/octet-stream",
]);

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// In-memory buffer storage (avoids saving unneeded files on VPS disk)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mimeType = (file.mimetype || "").toLowerCase();

  const isMimeValid = ALLOWED_MIME_TYPES.has(mimeType);
  const isExtValid = ALLOWED_EXTENSIONS.has(ext);

  if (!isMimeValid && !isExtValid) {
    const error = new Error(
      "Invalid file type. Only JPEG, PNG, and WebP images are allowed."
    );
    error.code = "INVALID_FILE_TYPE";
    return cb(error, false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1, // Single image per upload request
  },
  fileFilter,
});

/**
 * Middleware wrapper for single image upload under field name 'image'.
 * Catches Multer errors (file too large, invalid MIME) and returns clear 400 responses.
 */
export const uploadPhotoMiddleware = (req, res, next) => {
  const singleUpload = upload.single("image");

  singleUpload(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File size exceeds the 5 MB limit. Please select an image under 5 MB.",
        });
      }

      if (err.code === "INVALID_FILE_TYPE") {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }

      return res.status(400).json({
        success: false,
        message: err.message || "Failed to process uploaded file.",
      });
    }

    next();
  });
};
