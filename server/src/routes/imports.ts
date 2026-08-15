import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { badRequest } from '../lib/errors.js';
import { authenticate, requireUser } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { PDF_SIZE_LIMIT_MB, uploadPdf } from '../middleware/upload.js';
import { handleValidation, validatedBody } from '../middleware/validate.js';
import {
  importCommitValidators,
  importParseValidators,
} from '../validators/imports.validator.js';
import type { ImportDraftRow, ImportMethod } from '../services/pdfImportService.js';
import * as pdfImportService from '../services/pdfImportService.js';

export const importsRouter = Router();

importsRouter.use(authenticate);

/** Whether Deep Analyse can run. The script parse is always available. */
importsRouter.get('/status', (_req, res) => {
  res.json(pdfImportService.importStatus());
});

/**
 * Reads a PDF into a draft table. Nothing is saved: the user reviews the rows
 * (and can ask Gemini to try again) before posting them to /commit.
 */
importsRouter.post(
  '/parse',
  rateLimit({ name: 'import', max: 8, windowMs: 60_000 }),
  uploadPdf,
  importParseValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw badRequest(`Attach a PDF in the "file" field (up to ${PDF_SIZE_LIMIT_MB} MB).`);
    }

    const { today, mode } = validatedBody<{ today: string; mode?: ImportMethod }>(req);

    const preview = await pdfImportService.previewImport(
      req.file.buffer,
      today,
      mode === 'gemini' ? 'gemini' : 'script',
    );

    res.json(preview);
  }),
);

/** Writes the confirmed rows as food entries sourced from a PDF. */
importsRouter.post(
  '/commit',
  importCommitValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    const { today, rows } = validatedBody<{ today: string; rows: ImportDraftRow[] }>(req);
    const result = await pdfImportService.commitImport(requireUser(req).userId, rows, today);

    res.status(201).json(result);
  }),
);
