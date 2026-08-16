import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { badRequest } from '../lib/errors.js';
import { isAiConfigured } from '../lib/ai-client.js';
import { isGeminiConfigured } from '../lib/gemini-client.js';
import { authenticate, requireUser } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { IMAGE_SIZE_LIMIT_MB, parseChatUpload, uploadImage } from '../middleware/upload.js';
import { handleValidation, validatedBody } from '../middleware/validate.js';
import type { ChatRequestInput, DietBotRequestInput } from '../types/dto.js';
import { chatValidators, dietBotValidators } from '../validators/ai.validator.js';
import * as aiExtractService from '../services/aiExtractService.js';
import * as chatService from '../services/chatService.js';
import * as dietBotService from '../services/dietBotService.js';

export const aiRouter = Router();

aiRouter.use(authenticate);
aiRouter.use(rateLimit({ name: 'ai', max: 20, windowMs: 60_000 }));

/** Lets the client hide or disable AI features when the matching key is missing. */
aiRouter.get('/status', (_req, res) => {
  res.json({
    available: isAiConfigured(),
    extractAvailable: isAiConfigured(),
    chatAvailable: isGeminiConfigured(),
    dietBotAvailable: isGeminiConfigured(),
  });
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

/**
 * One turn of the conversational interface. The whole transcript is sent each
 * time and nothing is stored, so this route holds no session of its own.
 * An optional photo or PDF is read by the extract / import services and is
 * never forwarded to the chat model.
 */
aiRouter.post(
  '/chat',
  parseChatUpload,
  chatValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    const attachment = req.file
      ? { buffer: req.file.buffer, mimeType: req.file.mimetype }
      : undefined;

    const reply = await chatService.respond(
      requireUser(req).userId,
      validatedBody<ChatRequestInput>(req),
      attachment,
    );

    res.json(reply);
  }),
);

/**
 * The floating diet buddy. Same Gemini key as chat; read-only tools only.
 * Transcript is sent each turn and nothing is stored.
 */
aiRouter.post(
  '/diet-bot',
  dietBotValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    const reply = await dietBotService.respond(
      requireUser(req).userId,
      validatedBody<DietBotRequestInput>(req),
    );

    res.json(reply);
  }),
);
