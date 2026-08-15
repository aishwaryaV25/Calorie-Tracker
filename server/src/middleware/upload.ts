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

const uploadChatFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype === 'application/pdf' || ACCEPTED_IMAGE_TYPES.includes(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(badRequest('Attach a photo (JPEG, PNG or WebP) or a PDF diary.'));
  },
}).single('attachment');

/**
 * Chat accepts either JSON or multipart. The file, when present, is read by the
 * extract or import service and is never forwarded to the chat model.
 */
export function parseChatUpload(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction,
) {
  const type = String(req.headers['content-type'] ?? '');

  if (!type.includes('multipart/form-data')) {
    next();
    return;
  }

  uploadChatFile(req, res, (error) => {
    if (error) {
      next(error);
      return;
    }

    try {
      hydrateChatBody(req.body as Record<string, unknown>);
    } catch {
      next(badRequest('The chat request could not be read. Send the transcript as JSON text fields.'));
      return;
    }

    if (req.file?.mimetype.startsWith('image/') && req.file.size > MAX_IMAGE_BYTES) {
      next(badRequest(`Photos can be up to ${IMAGE_SIZE_LIMIT_MB} MB.`));
      return;
    }

    next();
  });
}

function hydrateChatBody(body: Record<string, unknown>) {
  if (typeof body.messages === 'string') {
    body.messages = JSON.parse(body.messages);
  }

  if (typeof body.pendingAction === 'string' && body.pendingAction.length > 0) {
    body.pendingAction = JSON.parse(body.pendingAction);
  }

  if (typeof body.choice === 'string' && body.choice.length > 0) {
    body.choice = JSON.parse(body.choice);
  }
}
