import { query } from 'express-validator';
import type { PaginationQuery } from '../types/dto.js';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const paginationValidators = [
  query('page').default(1).isInt({ min: 1 }).withMessage('page must be 1 or greater.').toInt(),
  query('pageSize')
    .default(DEFAULT_PAGE_SIZE)
    .isInt({ min: 1, max: MAX_PAGE_SIZE })
    .withMessage(`pageSize must be between 1 and ${MAX_PAGE_SIZE}.`)
    .toInt(),
];

export interface PageMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export const toSkipTake = ({ page, pageSize }: PaginationQuery) => ({
  skip: (page - 1) * pageSize,
  take: pageSize,
});

export function paginate<T>(
  data: T[],
  totalItems: number,
  { page, pageSize }: PaginationQuery,
): Paginated<T> {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

  return {
    data,
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && totalPages > 0,
    },
  };
}
