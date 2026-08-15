import { body } from 'express-validator';
import { MEAL_TYPES } from '../domain/nutrition.js';
import { MAX_IMPORT_ROWS } from '../services/pdfImportParser.js';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The caller's calendar day, sent with both the parse and the save so "today"
 * and a row with no date land on the day the user is having, not the server's
 * UTC day.
 */
export const importTodayValidators = [
  body('today')
    .matches(DATE_KEY)
    .withMessage('today must be a calendar date in YYYY-MM-DD form.')
    .isISO8601({ strict: true })
    .withMessage('today must be a real calendar date.'),
];

export const importParseValidators = [
  ...importTodayValidators,
  body('mode')
    .optional()
    .isIn(['script', 'gemini'])
    .withMessage('mode must be "script" or "gemini".'),
];

const amount = (path: string, label: string) =>
  body(path)
    .isFloat({ min: 0, max: 100_000 })
    .withMessage(`${label} must be a number between 0 and 100000.`)
    .toFloat();

/**
 * The rows the user confirmed in the preview. Validated to the same bounds as a
 * hand-typed entry, so an import cannot write numbers the form would reject.
 */
export const importCommitValidators = [
  ...importTodayValidators,
  body('rows')
    .isArray({ min: 1, max: MAX_IMPORT_ROWS })
    .withMessage(`Send between 1 and ${MAX_IMPORT_ROWS} rows.`),
  body('rows.*.foodName')
    .trim()
    .notEmpty()
    .withMessage('Each row needs a food name.')
    .isLength({ max: 160 }),
  body('rows.*.mealType')
    .isIn(MEAL_TYPES)
    .withMessage(`Meal type must be one of: ${MEAL_TYPES.join(', ')}.`),
  body('rows.*.quantity')
    .isFloat({ gt: 0, max: 10_000 })
    .withMessage('Quantity must be greater than zero.')
    .toFloat(),
  body('rows.*.unit').trim().notEmpty().isLength({ max: 24 }),
  amount('rows.*.calories', 'Calories'),
  amount('rows.*.proteinGrams', 'Protein'),
  amount('rows.*.carbGrams', 'Carbohydrates'),
  amount('rows.*.fatGrams', 'Fat'),
  body('rows.*.consumedOn')
    .matches(DATE_KEY)
    .withMessage('consumedOn must be a calendar date in YYYY-MM-DD form.')
    .isISO8601({ strict: true })
    .withMessage('consumedOn must be a real calendar date.'),
  body('rows.*.consumedAt')
    .optional()
    .isISO8601()
    .withMessage('consumedAt must be an ISO date or date-time.'),
];
