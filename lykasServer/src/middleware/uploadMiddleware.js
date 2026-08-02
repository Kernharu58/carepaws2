const multer = require("multer");

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOCUMENT_TYPES = [...IMAGE_TYPES, "application/pdf"];

const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;

/**
 * Builds a multer instance with memory storage (buffer streamed straight
 * to Cloudinary by the controller, never written to disk) plus a
 * MIME-type allowlist. The original source validated uploads by size
 * only — this fileFilter is the fix (§11.6.3): anything outside the
 * allowlist is rejected before the buffer is ever read.
 */
function makeUploader(allowedTypes) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) {
        return cb(null, true);
      }
      return cb(new Error(`Unsupported file type: ${file.mimetype}`));
    },
  });
}

const uploadImage = makeUploader(IMAGE_TYPES);
const uploadDocument = makeUploader(DOCUMENT_TYPES);

module.exports = { uploadImage, uploadDocument, IMAGE_TYPES, DOCUMENT_TYPES };
