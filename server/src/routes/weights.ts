import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { pathParam } from '../lib/request.js';
import { authenticate, requireUser } from '../middleware/auth.js';
import { handleValidation, validatedBody, validatedQuery } from '../middleware/validate.js';
import type { CreateWeightInput, ListWeightsQuery } from '../types/dto.js';
import {
  createWeightValidators,
  listWeightsValidators,
  weightIdValidators,
} from '../validators/weights.validator.js';
import * as weightsService from '../services/weightsService.js';

export const weightsRouter = Router();

weightsRouter.use(authenticate);

weightsRouter.get(
  '/current',
  asyncHandler(async (req, res) => {
    const latest = await weightsService.getLatest(requireUser(req).userId);
    res.json({ weight: latest });
  }),
);

weightsRouter.get(
  '/',
  listWeightsValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    const history = await weightsService.listWeights(
      requireUser(req).userId,
      validatedQuery<ListWeightsQuery>(req),
    );
    res.json(history);
  }),
);

weightsRouter.post(
  '/',
  createWeightValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    const weight = await weightsService.logWeight(
      requireUser(req).userId,
      validatedBody<CreateWeightInput>(req),
    );
    res.status(201).json(weight);
  }),
);

weightsRouter.delete(
  '/:id',
  weightIdValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    await weightsService.deleteWeight(requireUser(req).userId, pathParam(req, 'id'));
    res.status(204).send();
  }),
);
