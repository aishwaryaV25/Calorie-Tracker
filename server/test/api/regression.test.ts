import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  PASSWORD,
  buildDiaryPdf,
  daysAgoKey,
  request,
  signup,
  startApi,
  todayKey,
} from '../helpers.js';

describe('API regression', () => {
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

  it('serves health from the API process, not the web app', async () => {
    const { status, data } = await request(base, '/health');
    assert.equal(status, 200);
    assert.equal(data.status, 'ok');
  });

  it('rejects a short password and a duplicate email', async () => {
    const email = `dup.${Date.now()}@example.com`;

    const weak = await request(base, '/auth/signup', {
      method: 'POST',
      body: { email, password: 'short', displayName: 'Weak' },
    });
    assert.equal(weak.status, 400);

    const first = await request(base, '/auth/signup', {
      method: 'POST',
      body: { email, password: PASSWORD, displayName: 'First' },
    });
    assert.equal(first.status, 201);

    const again = await request(base, '/auth/signup', {
      method: 'POST',
      body: { email, password: PASSWORD, displayName: 'Second' },
    });
    assert.equal(again.status, 409);
  });

  it('logs a user back in and rejects a missing token', async () => {
    const account = await signup(base, 'Login User');

    const login = await request(base, '/auth/login', {
      method: 'POST',
      body: { email: account.email, password: PASSWORD },
    });
    assert.equal(login.status, 200);
    assert.ok(login.data.token);

    const me = await request(base, '/auth/me', { token: login.data.token });
    assert.equal(me.status, 200);
    assert.equal(me.data.user.email, account.email);

    const bare = await request(base, '/entries');
    assert.equal(bare.status, 401);
  });

  it('covers goal create, current, history, replace-same-day, and delete', async () => {
    const { token } = await signup(base, 'Goal User');
    const today = todayKey();
    const lastWeek = daysAgoKey(7);

    const created = await request(base, '/goals', {
      method: 'POST',
      token,
      body: {
        dailyCalories: 2200,
        proteinGrams: 150,
        carbGrams: 230,
        fatGrams: 70,
        targetWeightKg: 62,
        effectiveFrom: lastWeek,
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.dailyCalories, 2200);

    const current = await request(base, `/goals/current?date=${today}`, { token });
    assert.equal(current.data.goal.dailyCalories, 2200);

    const updated = await request(base, '/goals', {
      method: 'POST',
      token,
      body: {
        dailyCalories: 2600,
        proteinGrams: 180,
        carbGrams: 260,
        fatGrams: 72,
        targetWeightKg: 62,
        effectiveFrom: today,
      },
    });
    assert.equal(updated.status, 201);

    const history = await request(base, '/goals?page=1&pageSize=5', { token });
    assert.equal(history.data.meta.totalItems, 2);
    assert.equal(history.data.meta.pageSize, 5);

    const replaced = await request(base, '/goals', {
      method: 'POST',
      token,
      body: {
        dailyCalories: 2550,
        proteinGrams: 180,
        carbGrams: 260,
        fatGrams: 72,
        effectiveFrom: today,
      },
    });
    assert.equal(replaced.status, 201);
    assert.equal(replaced.data.id, updated.data.id);

    const afterReplace = await request(base, '/goals?page=1&pageSize=5', { token });
    assert.equal(afterReplace.data.meta.totalItems, 2);

    const removed = await request(base, `/goals/${created.data.id}`, { method: 'DELETE', token });
    assert.equal(removed.status, 204);

    const leftover = await request(base, '/goals?page=1&pageSize=5', { token });
    assert.equal(leftover.data.meta.totalItems, 1);
  });

  it('covers weight create, same-day replace, current, list, delete, and isolation', async () => {
    const alice = await signup(base, 'Weight Alice');
    const bob = await signup(base, 'Weight Bob');
    const today = todayKey();
    const yesterday = daysAgoKey(1);

    const first = await request(base, '/weights', {
      method: 'POST',
      token: alice.token,
      body: { kg: 72.4, loggedOn: yesterday, note: 'morning' },
    });
    assert.equal(first.status, 201, JSON.stringify(first.data));
    assert.equal(first.data.kg, 72.4);
    assert.equal(first.data.loggedOn, yesterday);
    assert.equal(first.data.note, 'morning');

    const todayRow = await request(base, '/weights', {
      method: 'POST',
      token: alice.token,
      body: { kg: 72.1, loggedOn: today },
    });
    assert.equal(todayRow.status, 201);
    assert.equal(todayRow.data.kg, 72.1);

    const replaced = await request(base, '/weights', {
      method: 'POST',
      token: alice.token,
      body: { kg: 71.9, loggedOn: today, note: 'after walk' },
    });
    assert.equal(replaced.status, 201);
    assert.equal(replaced.data.id, todayRow.data.id);
    assert.equal(replaced.data.kg, 71.9);
    assert.equal(replaced.data.note, 'after walk');

    const current = await request(base, '/weights/current', { token: alice.token });
    assert.equal(current.status, 200);
    assert.equal(current.data.weight.id, replaced.data.id);
    assert.equal(current.data.weight.kg, 71.9);

    const listed = await request(base, '/weights?page=1&pageSize=5', { token: alice.token });
    assert.equal(listed.status, 200);
    assert.equal(listed.data.meta.totalItems, 2);
    assert.equal(listed.data.data[0].loggedOn, today);
    assert.equal(listed.data.data[1].loggedOn, yesterday);

    const bobCurrent = await request(base, '/weights/current', { token: bob.token });
    assert.equal(bobCurrent.data.weight, null);

    const bobList = await request(base, '/weights?page=1&pageSize=5', { token: bob.token });
    assert.equal(bobList.data.meta.totalItems, 0);

    const bobDelete = await request(base, `/weights/${first.data.id}`, {
      method: 'DELETE',
      token: bob.token,
    });
    assert.equal(bobDelete.status, 404);

    const removed = await request(base, `/weights/${first.data.id}`, {
      method: 'DELETE',
      token: alice.token,
    });
    assert.equal(removed.status, 204);

    const afterDelete = await request(base, '/weights?page=1&pageSize=5', { token: alice.token });
    assert.equal(afterDelete.data.meta.totalItems, 1);
    assert.equal(afterDelete.data.data[0].id, replaced.data.id);
  });

  it('covers meal CRUD, filters, pagination, macros and micros', async () => {
    const { token } = await signup(base, 'Meal User');
    const today = todayKey();
    const yesterday = daysAgoKey(1);

    for (const meal of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
      const created = await request(base, '/entries', {
        method: 'POST',
        token,
        body: {
          foodName: `${meal} item`,
          mealType: meal,
          quantity: 1,
          unit: 'serving',
          calories: 400,
          proteinGrams: 20,
          carbGrams: 40,
          fatGrams: 12,
          consumedOn: today,
          micronutrients: [{ nutrient: 'iron', amount: 2, unit: 'mg' }],
        },
      });
      assert.equal(created.status, 201, JSON.stringify(created.data));
      assert.equal(created.data.macros.proteinGrams, 20);
      assert.equal(created.data.micronutrients[0].nutrient, 'iron');
    }

    const oats = await request(base, '/entries', {
      method: 'POST',
      token,
      body: {
        foodName: 'Yesterday oats',
        mealType: 'breakfast',
        quantity: 1,
        unit: 'bowl',
        calories: 350,
        consumedOn: yesterday,
      },
    });
    assert.equal(oats.status, 201);

    const todayList = await request(base, `/entries?from=${today}&to=${today}&pageSize=1`, { token });
    assert.equal(todayList.data.meta.totalItems, 4);

    const range = await request(base, `/entries?from=${yesterday}&to=${today}&pageSize=2`, { token });
    assert.equal(range.data.meta.totalItems, 5);
    assert.equal(range.data.meta.hasNextPage, true);

    const breakfasts = await request(
      base,
      `/entries?from=${yesterday}&to=${today}&mealType=breakfast&pageSize=20`,
      { token },
    );
    assert.equal(breakfasts.data.meta.totalItems, 2);

    const page2 = await request(base, `/entries?from=${yesterday}&to=${today}&page=2&pageSize=2`, {
      token,
    });
    assert.equal(page2.data.data.length, 2);

    const lunch = await request(base, `/entries?from=${today}&to=${today}&search=lunch&pageSize=1`, {
      token,
    });
    const lunchId = lunch.data.data[0].id as string;

    const patched = await request(base, `/entries/${lunchId}`, {
      method: 'PATCH',
      token,
      body: { foodName: 'lunch item updated' },
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.data.foodName, 'lunch item updated');

    const deleted = await request(base, `/entries/${lunchId}`, { method: 'DELETE', token });
    assert.equal(deleted.status, 204);

    const afterDelete = await request(base, `/entries?from=${today}&to=${today}&pageSize=1`, {
      token,
    });
    assert.equal(afterDelete.data.meta.totalItems, 3);
  });

  it('keeps two users isolated', async () => {
    const alice = await signup(base, 'Alice');
    const bob = await signup(base, 'Bob');
    const today = todayKey();

    const entry = await request(base, '/entries', {
      method: 'POST',
      token: alice.token,
      body: {
        foodName: 'Alice oats',
        mealType: 'breakfast',
        quantity: 1,
        unit: 'bowl',
        calories: 300,
        consumedOn: today,
      },
    });
    assert.equal(entry.status, 201);

    const bobList = await request(base, `/entries?from=${today}&to=${today}`, { token: bob.token });
    assert.equal(bobList.data.meta.totalItems, 0);

    const bobRead = await request(base, `/entries/${entry.data.id}`, { token: bob.token });
    assert.equal(bobRead.status, 404);

    const bobGoal = await request(base, `/goals/current?date=${today}`, { token: bob.token });
    assert.equal(bobGoal.data.goal, null);
  });

  it('builds daily, weekly, macro, micro and goal-comparison reports plus a PDF', async () => {
    const { token } = await signup(base, 'Report User');
    const today = todayKey();
    const yesterday = daysAgoKey(1);

    await request(base, '/goals', {
      method: 'POST',
      token,
      body: {
        dailyCalories: 2000,
        proteinGrams: 120,
        carbGrams: 200,
        fatGrams: 60,
        effectiveFrom: yesterday,
      },
    });

    await request(base, '/entries', {
      method: 'POST',
      token,
      body: {
        foodName: 'Report oats',
        mealType: 'breakfast',
        quantity: 1,
        unit: 'bowl',
        calories: 400,
        proteinGrams: 20,
        carbGrams: 60,
        fatGrams: 8,
        consumedOn: today,
        micronutrients: [{ nutrient: 'vitamin_c', amount: 12, unit: 'mg' }],
      },
    });

    const daily = await request(base, `/reports/daily?from=${yesterday}&to=${today}&pageSize=10`, {
      token,
    });
    assert.equal(daily.status, 200);
    assert.ok(daily.data.meta.totalItems >= 2);

    const weekly = await request(base, `/reports/weekly?from=${yesterday}&to=${today}&pageSize=10`, {
      token,
    });
    assert.equal(weekly.status, 200);
    assert.ok(weekly.data.meta.totalItems >= 1);

    const macros = await request(base, `/reports/macros?from=${yesterday}&to=${today}`, { token });
    assert.equal(macros.data.grams.proteinGrams, 20);

    const micros = await request(base, `/reports/micronutrients?from=${yesterday}&to=${today}`, {
      token,
    });
    assert.equal(micros.data.meta.totalItems, 1);
    assert.equal(micros.data.data[0].nutrient, 'vitamin_c');

    const comparison = await request(base, `/reports/goal-comparison?from=${yesterday}&to=${today}`, {
      token,
    });
    assert.ok(comparison.data.adherence.calories);

    const pdf = await fetch(`${base}/reports/pdf?from=${yesterday}&to=${today}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers.get('content-type') ?? '', /pdf/i);
    const bytes = Buffer.from(await pdf.arrayBuffer());
    assert.ok(bytes.subarray(0, 4).toString() === '%PDF');
  });

  it('parses a diary PDF and commits the rows', async () => {
    const { token } = await signup(base, 'Import User');
    const today = todayKey();
    const pdf = buildDiaryPdf([
      'Type of meal | Name of meal | Calories | Protein | Carbs | Fat',
      'Breakfast | Imported khichdi | 380 | 14 | 58 | 8',
      'Snack | Imported banana | 105 | 1 | 27 | 0',
    ]);

    const form = new FormData();
    form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'diary.pdf');
    form.append('today', today);
    form.append('mode', 'script');

    const parsed = await request(base, '/imports/parse', { method: 'POST', token, form });
    assert.equal(parsed.status, 200, JSON.stringify(parsed.data));
    assert.equal(parsed.data.method, 'script');
    assert.equal(parsed.data.rows.length, 2);

    const committed = await request(base, '/imports/commit', {
      method: 'POST',
      token,
      body: { today, rows: parsed.data.rows },
    });
    assert.equal(committed.status, 201, JSON.stringify(committed.data));
    assert.equal(committed.data.imported, 2);

    const listed = await request(base, `/entries?from=${today}&to=${today}&search=khichdi`, {
      token,
    });
    assert.equal(listed.data.meta.totalItems, 1);
  });

  it('exposes AI status and rejects extract without a file', async () => {
    const { token } = await signup(base, 'Ai User');

    const status = await request(base, '/ai/status', { token });
    assert.equal(status.status, 200);
    assert.equal(typeof status.data.available, 'boolean');

    const extract = await request(base, '/ai/extract', { method: 'POST', token });
    assert.ok(extract.status >= 400);
    assert.match(extract.data.error.message, /image/i);
  });
});
