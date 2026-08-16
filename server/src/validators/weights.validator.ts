import { body, param } from 'express-validator';
import { paginationValidators } from '../lib/pagination.js';

export const createWeightValidators = [
  body('kg')
    .isFloat({ gt: 0, max: 500 })
    .withMessage('Weight must be between 0 and 500 kg.')
    .toFloat(),
  body('loggedOn')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('loggedOn must be a calendar date in YYYY-MM-DD form.')
    .isISO8601({ strict: true })
    .withMessage('loggedOn must be a real calendar date.'),
  body('note')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Note must be at most 200 characters.'),
];

export const listWeightsValidators = paginationValidators;

export const weightIdValidators = [param('id').trim().notEmpty().withMessage('Weight id is required.')];
