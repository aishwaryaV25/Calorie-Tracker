import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { fromDateKey } from '../lib/dates.js';
import { pathParam } from '../lib/request.js';
import { authenticate, requireUser } from '../middleware/auth.js';
import { handleValidation, validatedBody, validatedQuery } from '../middleware/validate.js';
import type { CreateGoalInput, ListGoalsQuery } from '../types/dto.js';
import {
  createGoalValidators,
  currentGoalValidators,
  goalIdValidators,
  listGoalsValidators,
} from '../validators/goals.validator.js';
import * as goalsService from '../services/goalsService.js';

export const goalsRouter = Router();

goalsRouter.use(authenticate);

goalsRouter.get(
  '/current',
  currentGoalValidators,
  handleValidation,
  asyncHandler(async (req, res) => {
    const { date } = validatedQuery<{ date?: string }>(req);

    const goal = await goalsService.getGoalForDate(
      requireUser(req).userId,
      date ? fromDateKey(date) : new Date(),
    );

    res.json({ goal });
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
