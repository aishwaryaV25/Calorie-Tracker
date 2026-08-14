import multer from 'multer';
import { badRequest } from '../lib/errors.js';

/**
 * Uploads are held in memory rather than written to disk: the files are small,
 * they are forwarded straight to an external API or parsed in-process, and
 * nothing needs to persist afterwards. That also avoids leaving user photos
 * lying around the filesystem.
 */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.mimetype)) {
      callback(badRequest(`Unsupported image type "${file.mimetype}". Use JPEG, PNG or WebP.`));
      return;
    }
    callback(null, true);
  },
}).single('image');

export const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'application/pdf') {
      callback(badRequest(`Expected a PDF but received "${file.mimetype}".`));
      return;
    }
    callback(null, true);
  },
}).single('file');

export const IMAGE_SIZE_LIMIT_MB = MAX_IMAGE_BYTES / (1024 * 1024);
export const PDF_SIZE_LIMIT_MB = MAX_PDF_BYTES / (1024 * 1024);
