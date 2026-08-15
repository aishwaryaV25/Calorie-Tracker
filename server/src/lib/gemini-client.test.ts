import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldTryNextGeminiModel } from './gemini-client.js';

describe('shouldTryNextGeminiModel', () => {
  it('moves on when a model is retired for new keys', () => {
    assert.equal(
      shouldTryNextGeminiModel(
        404,
        'This model models/gemini-2.5-flash is no longer available to new users.',
      ),
      true,
    );
  });

  it('moves on when the pool is slammed', () => {
    assert.equal(shouldTryNextGeminiModel(503, 'high demand'), true);
  });

  it('does not retry a bad request as a model swap', () => {
    assert.equal(shouldTryNextGeminiModel(400, 'invalid argument'), false);
  });
});
