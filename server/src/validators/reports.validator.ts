import { query } from 'express-validator';
import { paginationValidators } from '../lib/pagination.js';

const rangeValidators = [
  query('from').optional().isISO8601().withMessage('from must be an ISO date.').toDate(),
  query('to').optional().isISO8601().withMessage('to must be an ISO date.').toDate(),
];

export const reportRangeValidators = [...rangeValidators, ...paginationValidators];
