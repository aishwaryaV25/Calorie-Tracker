import { body } from 'express-validator';

/**
 * The transcript is sent whole on every turn, so it is also the request's size
 * budget. These caps keep one turn's prompt bounded regardless of how long the
 * user has been chatting; the client trims older turns to match.
 */
export const MAX_CHAT_MESSAGES = 24;
export const MAX_CHAT_MESSAGE_LENGTH = 2_000;

export const chatValidators = [
  body('messages')
    .isArray({ min: 1, max: MAX_CHAT_MESSAGES })
    .withMessage(`Send between 1 and ${MAX_CHAT_MESSAGES} messages.`),
  body('messages.*.role')
    .isIn(['user', 'assistant'])
    .withMessage('Each message role must be "user" or "assistant".'),
  body('messages.*.content')
    .isString()
    .withMessage('Each message needs text content.')
    .bail()
    .trim()
    .isLength({ min: 1, max: MAX_CHAT_MESSAGE_LENGTH })
    .withMessage(`Each message must be between 1 and ${MAX_CHAT_MESSAGE_LENGTH} characters.`),
  // A calendar day, kept as a string for the same reason as an entry's
  // `consumedOn`: parsing it into an instant is what loses the day.
  body('today')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('today must be a calendar date in YYYY-MM-DD form.')
    .isISO8601({ strict: true })
    .withMessage('today must be a real calendar date.'),
  body('conversationId').optional().isString().isLength({ min: 1, max: 80 }),
  body('pendingAction').optional(),
  body('choice').optional().isObject(),
  body('choice.entryId').optional().isString().isLength({ min: 1, max: 80 }),
  body('choice.index').optional().isInt({ min: 1, max: 50 }).toInt(),
  body('choice.confirm').optional().isBoolean().toBoolean(),
];
