import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { badRequest } from '../lib/errors.js';
import { isAiConfigured } from '../lib/ai-client.js';
import { authenticate } from '../middleware/auth.js';
import { IMAGE_SIZE_LIMIT_MB, uploadImage } from '../middleware/upload.js';
import * as aiExtractService from '../services/aiExtractService.js';

export const aiRouter = Router();

aiRouter.use(authenticate);

/** Lets the client hide or disable AI features when the server has no key. */
aiRouter.get('/status', (_req, res) => {
  res.json({ available: isAiConfigured() });
});

/**
 * Analyses a nutrition label or a photo of a meal and returns a draft entry.
 * The result is deliberately not saved: the user confirms or corrects the
 * numbers in the form first.
 */
aiRouter.post(
  '/extract',
  uploadImage,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw badRequest(
        `Attach an image in the "image" field (JPEG, PNG or WebP, up to ${IMAGE_SIZE_LIMIT_MB} MB).`,
      );
    }

    const result = await aiExtractService.extractNutritionFromImage(
      req.file.buffer,
      req.file.mimetype,
    );

    res.json(result);
  }),
);
