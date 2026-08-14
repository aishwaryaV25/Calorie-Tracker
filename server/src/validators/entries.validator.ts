import { body, param, query, type ValidationChain } from 'express-validator';
import { MEAL_TYPES } from '../domain/nutrition.js';
import { paginationValidators } from '../lib/pagination.js';

const MAX_MICRONUTRIENTS = 40;

/** Nutrition amounts are non-negative, with a ceiling that catches typos. */
const amountField = (path: string, label: string, optional: boolean) => {
  const chain = body(path);
  return (optional ? chain.optional() : chain)
    .isFloat({ min: 0, max: 100_000 })
    .withMessage(`${label} must be a number between 0 and 100000.`)
    .toFloat();
};

/**
 * Micronutrients are always an optional array; when present, each element must be
 * complete. The `*` wildcard applies the rules to every item in the array.
 */
const micronutrientValidators: ValidationChain[] = [
  body('micronutrients')
    .optional()
    .isArray({ max: MAX_MICRONUTRIENTS })
    .withMessage(`Provide at most ${MAX_MICRONUTRIENTS} micronutrients.`),
  body('micronutrients.*.nutrient')
    .trim()
    .notEmpty()
    .withMessage('Each micronutrient needs a name.')
    .matches(/^[a-z0-9_]+$/)
    .withMessage('Use lowercase letters, digits and underscores, for example "vitamin_c".')
    .isLength({ max: 60 }),
  body('micronutrients.*.amount')
    .isFloat({ min: 0, max: 100_000 })
    .withMessage('Each micronutrient needs a non-negative amount.')
    .toFloat(),
  body('micronutrients.*.unit').optional().trim().isLength({ min: 1, max: 12 }),
];

const coreEntryValidators = (optional: boolean): ValidationChain[] => {
  const field = (name: string) => (optional ? body(name).optional() : body(name));

  return [
    field('foodName')
      .trim()
      .notEmpty()
      .withMessage('Food name is required.')
      .isLength({ max: 160 })
      .withMessage('Food name must be 160 characters or fewer.'),
    field('mealType')
      .isIn(MEAL_TYPES)
      .withMessage(`Meal type must be one of: ${MEAL_TYPES.join(', ')}.`),
    field('quantity')
      .isFloat({ gt: 0, max: 10_000 })
      .withMessage('Quantity must be greater than zero.')
      .toFloat(),
    field('unit')
      .trim()
      .notEmpty()
      .withMessage('Unit is required, for example "g" or "cup".')
      .isLength({ max: 24 }),
    amountField('calories', 'Calories', optional),
    amountField('proteinGrams', 'Protein', true),
    amountField('carbGrams', 'Carbohydrates', true),
    amountField('fatGrams', 'Fat', true),
    // Left optional rather than given a default: a chain is built once at import
    // time, so a "now" default would freeze to the moment the server started.
    // The service fills in the current time instead.
    body('consumedAt')
      .optional()
      .isISO8601()
      .withMessage('consumedAt must be an ISO date or date-time.')
      .toDate(),
    ...micronutrientValidators,
  ];
};

export const createEntryValidators = coreEntryValidators(false);

/**
 * Every field is optional for a patch. The "at least one field" rule lives in the
 * service instead of here, because it has to be judged against the sanitised
 * result: a body containing only unrecognised keys is still an empty update.
 */
export const updateEntryValidators = coreEntryValidators(true);

export const listEntriesValidators = [
  ...paginationValidators,
  query('from').optional().isISO8601().withMessage('from must be an ISO date.').toDate(),
  query('to')
    .optional()
    .isISO8601()
    .withMessage('to must be an ISO date.')
    .toDate()
    .custom((to: Date, { req }) => {
      const from = req.query?.from ? new Date(req.query.from as string) : null;

      if (from && to < from) {
        throw new Error('"to" must be on or after "from".');
      }

      return true;
    }),
  query('mealType')
    .optional()
    .isIn(MEAL_TYPES)
    .withMessage(`Meal type must be one of: ${MEAL_TYPES.join(', ')}.`),
  query('search').optional().trim().isLength({ min: 1, max: 160 }),
  query('sort').default('consumedAt').isIn(['consumedAt', 'calories', 'createdAt']),
  query('order').default('desc').isIn(['asc', 'desc']),
];

export const entryIdValidators = [param('id').trim().notEmpty().withMessage('Entry id is required.')];
