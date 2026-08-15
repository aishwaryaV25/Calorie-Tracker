import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { paginate, toSkipTake } from './pagination.js';

describe('pagination', () => {
  it('uses 1-based pages for skip/take', () => {
    assert.deepEqual(toSkipTake({ page: 1, pageSize: 20 }), { skip: 0, take: 20 });
    assert.deepEqual(toSkipTake({ page: 3, pageSize: 10 }), { skip: 20, take: 10 });
  });

  it('reports hasNext / hasPrevious from the total, not the page length', () => {
    const result = paginate(['a', 'b'], 5, { page: 1, pageSize: 2 });
    assert.equal(result.meta.totalPages, 3);
    assert.equal(result.meta.hasNextPage, true);
    assert.equal(result.meta.hasPreviousPage, false);
  });

  it('treats an empty list as zero pages so the UI can hide the pager', () => {
    const result = paginate([], 0, { page: 1, pageSize: 20 });
    assert.equal(result.meta.totalPages, 0);
    assert.equal(result.meta.hasNextPage, false);
  });
});
