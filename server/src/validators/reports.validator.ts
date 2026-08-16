import { query } from 'express-validator';
import { paginationValidators } from '../lib/pagination.js';

/**
 * Shared by every report endpoint. The range itself defaults in the service so
 * "the last 30 days" is computed per request rather than at server start-up.
 */
const rangeValidators = [
  query('from').optional().isISO8601().withMessage('from must be an ISO date.').toDate(),
  query('to').optional().isISO8601().withMessage('to must be an ISO date.').toDate(),
];

export const reportRangeValidators = [...rangeValidators, ...paginationValidators];
