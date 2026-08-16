import { body, param, query } from 'express-validator';
import { paginationValidators } from '../lib/pagination.js';

const macroTarget = (name: string, label: string) =>
  body(name)
    .isFloat({ min: 0, max: 2_000 })
    .withMessage(`${label} target must be between 0 and 2000 grams.`)
    .toFloat();

export const createGoalValidators = [
  body('dailyCalories')
    .isFloat({ gt: 0, max: 20_000 })
    .withMessage('Daily calorie target must be greater than zero.')
    .toFloat(),
  macroTarget('proteinGrams', 'Protein'),
  macroTarget('carbGrams', 'Carbohydrate'),
  macroTarget('fatGrams', 'Fat'),
  body('targetWeightKg')
    .optional()
    .isFloat({ gt: 0, max: 500 })
    .withMessage('Target weight must be between 0 and 500 kg.')
    .toFloat(),

  body('effectiveFrom')
    .optional()
    .isISO8601()
    .withMessage('effectiveFrom must be an ISO date.')
    .toDate(),
];

export const listGoalsValidators = paginationValidators;

export const currentGoalValidators = [
  query('date')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('date must be a calendar date in YYYY-MM-DD form.')
    .isISO8601({ strict: true })
    .withMessage('date must be a real calendar date.'),
];

export const goalIdValidators = [param('id').trim().notEmpty().withMessage('Goal id is required.')];
