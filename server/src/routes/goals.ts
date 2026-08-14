import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { pathParam } from '../lib/request.js';
import { authenticate, requireUser } from '../middleware/auth.js';
import { handleValidation, validatedBody, validatedQuery } from '../middleware/validate.js';
import type { CreateGoalInput, ListGoalsQuery } from '../types/dto.js';
import {
  createGoalValidators,
  goalIdValidators,
  listGoalsValidators,
} from '../validators/goals.validator.js';
import * as goalsService from '../services/goalsService.js';

export const goalsRouter = Router();

goalsRouter.use(authenticate);

/** The targets in force today, or null if the user has never set any. */
goalsRouter.get(
  '/current',
  asyncHandler(async (req, res) => {
    res.json({ goal: await goalsService.getCurrentGoal(requireUser(req).userId) });
  }),
);

goalsRouter.get(
  '/',
  listGoalsValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    const history = await goalsService.listGoals(
      requireUser(req).userId,
      validatedQuery<ListGoalsQuery>(req),
    );
    res.json(history);
  }),
);

goalsRouter.post(
  '/',
  createGoalValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    const goal = await goalsService.setGoal(
      requireUser(req).userId,
      validatedBody<CreateGoalInput>(req),
    );
    res.status(201).json(goal);
  }),
);

goalsRouter.delete(
  '/:id',
  goalIdValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    await goalsService.deleteGoal(requireUser(req).userId, pathParam(req, 'id'));
    res.status(204).send();
  }),
);
