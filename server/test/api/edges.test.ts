import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { request, signup, startApi, todayKey } from '../helpers.js';

describe('API edge cases', () => {
  let base = '';
  let close: () => Promise<void> = async () => undefined;

  before(async () => {
    const server = await startApi();
    base = server.base;
    close = server.close;
  });

  after(async () => {
    await close();
  });

  it('rejects unauthenticated reads and writes on every resource', async () => {
    const paths = [
      ['GET', '/entries'],
      ['GET', '/goals'],
      ['GET', '/weights'],
      ['GET', '/weights/current'],
      ['GET', '/reports/daily'],
      ['GET', '/reports/pdf'],
      ['POST', '/ai/chat'],
    ] as const;

    for (const [method, path] of paths) {
      const response = await request(base, path, { method });
      assert.equal(response.status, 401, `${method} ${path}`);
    }
  });

  it('rejects a meal that is missing a name or uses an unknown meal type', async () => {
    const { token } = await signup(base, 'Edge Meal');

    const nameless = await request(base, '/entries', {
      method: 'POST',
      token,
      body: { mealType: 'breakfast', quantity: 1, unit: 'bowl', calories: 200 },
    });
    assert.equal(nameless.status, 400);

    const mealType = await request(base, '/entries', {
      method: 'POST',
      token,
      body: {
        foodName: 'Soup',
        mealType: 'brunch',
        quantity: 1,
        unit: 'bowl',
        calories: 200,
      },
    });
    assert.equal(mealType.status, 400);

    const calories = await request(base, '/entries', {
      method: 'POST',
      token,
      body: {
        foodName: 'Soup',
        mealType: 'lunch',
        quantity: 1,
        unit: 'bowl',
        calories: -10,
      },
    });
    assert.equal(calories.status, 400);
  });

  it('rejects a goal that is missing energy or uses an impossible weight', async () => {
    const { token } = await signup(base, 'Edge Goal');

    const incomplete = await request(base, '/goals', {
      method: 'POST',
      token,
      body: { proteinGrams: 120, carbGrams: 200, fatGrams: 60 },
    });
    assert.equal(incomplete.status, 400);

    const weight = await request(base, '/goals', {
      method: 'POST',
      token,
      body: {
        dailyCalories: 2200,
        proteinGrams: 120,
        carbGrams: 200,
        fatGrams: 60,
        targetWeightKg: 0,
      },
    });
    assert.equal(weight.status, 400);
  });

  it('rejects a weigh-in that is empty, out of range, or badly dated', async () => {
    const { token } = await signup(base, 'Edge Weight');

    const missing = await request(base, '/weights', { method: 'POST', token, body: {} });
    assert.equal(missing.status, 400);

    const zero = await request(base, '/weights', { method: 'POST', token, body: { kg: 0 } });
    assert.equal(zero.status, 400);

    const heavy = await request(base, '/weights', { method: 'POST', token, body: { kg: 501 } });
    assert.equal(heavy.status, 400);

    const date = await request(base, '/weights', {
      method: 'POST',
      token,
      body: { kg: 70, loggedOn: '16-08-2026' },
    });
    assert.equal(date.status, 400);

    const note = await request(base, '/weights', {
      method: 'POST',
      token,
      body: { kg: 70, note: 'x'.repeat(201) },
    });
    assert.equal(note.status, 400);

    const empty = await request(base, '/weights/current', { token });
    assert.equal(empty.status, 200);
    assert.equal(empty.data.weight, null);
  });

  it('rejects a report window longer than a year and still accepts a swapped pair', async () => {
    const { token } = await signup(base, 'Edge Report');
    const today = todayKey();

    const wide = await request(base, `/reports/daily?from=2024-01-01&to=2026-08-16`, { token });
    assert.equal(wide.status, 400);

    const swapped = await request(base, `/reports/daily?from=${today}&to=2026-08-01&pageSize=5`, {
      token,
    });
    assert.equal(swapped.status, 200);
    assert.ok(swapped.data.range.from <= swapped.data.range.to);
  });

  it('returns 404 when a second user tries to delete someone else\'s weigh-in', async () => {
    const alice = await signup(base, 'Edge Alice');
    const bob = await signup(base, 'Edge Bob');

    const saved = await request(base, '/weights', {
      method: 'POST',
      token: alice.token,
      body: { kg: 68.2, loggedOn: todayKey() },
    });
    assert.equal(saved.status, 201);

    const stolen = await request(base, `/weights/${saved.data.id}`, {
      method: 'DELETE',
      token: bob.token,
    });
    assert.equal(stolen.status, 404);

    const still = await request(base, '/weights/current', { token: alice.token });
    assert.equal(still.data.weight.id, saved.data.id);
  });
});
