import { Readable } from "stream";
import { cloudinary } from "../config/cloudinary.js";

/**
 * Dedicated Cloudinary folders namespace for easy extension.
 * Currently using PROFILES; gallery and chat-media can be added seamlessly.
 */
export const CLOUDINARY_FOLDERS = {
  PROFILES: "dating-app/profiles",
  GALLERY: "dating-app/gallery",
  CHAT_MEDIA: "dating-app/chat-media",
};

/**
 * Upload an image buffer directly to Cloudinary via stream.
 * Automatically compresses, optimizes format/quality, and scales to max 1200x1200.
 *
 * @param {Buffer} buffer - In-memory image buffer from Multer
 * @param {Object} options - Custom options (folder, tags, transformations)
 * @returns {Promise<{ secure_url: string, public_id: string, format: string, width: number, height: number, bytes: number }>}
 */
export const uploadImageStream = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      return reject(new Error("Valid image buffer is required for upload."));
    }

    const folder = options.folder || CLOUDINARY_FOLDERS.PROFILES;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        // Automatic optimization and responsive resizing up to 1200x1200 preserving aspect ratio
        transformation: [
          {
            width: 1200,
            height: 1200,
            crop: "limit", // preserves aspect ratio, never stretches or upscales small images
          },
          {
            quality: "auto", // automatic perceptually optimal compression
          },
          {
            fetch_format: "auto", // delivers modern format (WebP / AVIF) where supported
          },
        ],
        ...options,
      },
      (error, result) => {
        if (error) {
          console.error("[CLOUDINARY SERVICE] Upload stream error:", error.message || error);
          return reject(new Error(error.message || "Failed to upload image to Cloudinary."));
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
        });
      }
    );

    // Stream the buffer without storing anything on the local filesystem
    const readableStream = Readable.from(buffer);
    readableStream.pipe(uploadStream);
  });
};

/**
 * Delete an image from Cloudinary by its public ID.
 * Reusable helper for photo updates and account cleanup.
 *
 * @param {string} publicId - The Cloudinary public_id of the asset
 * @returns {Promise<{ result: string }>}
 */
export const deleteImageFromCloudinary = async (publicId) => {
  if (!publicId) return { result: "skipped" };
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });
    return result;
  } catch (error) {
    console.error(`[CLOUDINARY SERVICE] Failed to delete image ${publicId}:`, error.message || error);
    // Don't throw fatal error on delete cleanup so main workflow continues smoothly
    return { result: "error", message: error.message };
  }
};
