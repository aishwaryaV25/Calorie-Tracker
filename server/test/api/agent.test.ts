import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { applyAttachPending } from '../../src/services/chatAttach.js';
import { applyPending, createPending } from '../../src/services/chatPending.js';
import { runTool } from '../../src/services/chatTools.js';
import { daysAgoKey, request, signup, startApi, todayKey } from '../helpers.js';

describe('agent tools and pending choices', () => {
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

  async function seedYesterday(displayName: string) {
    const account = await signup(base, displayName);
    const yesterday = daysAgoKey(1);
    const token = account.token;

    const foods = [
      { foodName: 'Greek yogurt', mealType: 'breakfast', calories: 146, quantity: 200, unit: 'g' },
      { foodName: 'Rice', mealType: 'lunch', calories: 200, quantity: 1, unit: 'cup' },
      { foodName: 'Salmon', mealType: 'snack', calories: 520, quantity: 1, unit: 'serving' },
      { foodName: 'Omelette', mealType: 'dinner', calories: 390, quantity: 1, unit: 'serving' },
    ];

    for (const food of foods) {
      const created = await request(base, '/entries', {
        method: 'POST',
        token,
        body: { ...food, consumedOn: yesterday },
      });
      assert.equal(created.status, 201, JSON.stringify(created.data));
    }

    return { userId: account.user.id as string, token, yesterday };
  }

  it('logs a meal through the same service the form uses', async () => {
    const account = await signup(base, 'Agent Log');
    const outcome = await runTool(
      'log_meal',
      JSON.stringify({
        foodName: 'Two scrambled eggs and toast',
        mealType: 'breakfast',
        calories: 350,
        proteinGrams: 20,
        carbGrams: 28,
        fatGrams: 16,
        consumedOn: todayKey(),
      }),
      { userId: account.user.id, today: todayKey() },
    );

    assert.equal((outcome.result as { foodName: string }).foodName, 'Two scrambled eggs and toast');
    assert.equal(outcome.action?.type, 'meal_created');

    const listed = await request(base, `/entries?from=${todayKey()}&to=${todayKey()}`, {
      token: account.token,
    });
    assert.equal(listed.data.meta.totalItems, 1);
  });

  it('refuses to delete yesterday when several meals match, then deletes lunch after a follow-up', async () => {
    const { userId, token, yesterday } = await seedYesterday('Agent Delete');

    const first = await runTool(
      'delete_entry',
      JSON.stringify({ from: yesterday, to: yesterday }),
      { userId, today: todayKey() },
    );

    assert.ok(first.pending);
    assert.equal(first.pending?.kind, 'choose_delete');
    assert.equal(first.pending?.candidates.length, 4);
    assert.equal(first.action, undefined);

    const stillThere = await request(base, `/entries?from=${yesterday}&to=${yesterday}`, { token });
    assert.equal(stillThere.data.meta.totalItems, 4);

    const resolved = await applyPending(userId, first.pending!, 'Lunch');
    assert.equal(resolved.pendingAction, null);
    assert.match(resolved.reply, /Rice/);
    assert.equal(resolved.actions[0]?.type, 'meal_deleted');

    const after = await request(base, `/entries?from=${yesterday}&to=${yesterday}`, { token });
    assert.equal(after.data.meta.totalItems, 3);
    assert.equal(
      after.data.data.some((entry: { foodName: string }) => entry.foodName === 'Rice'),
      false,
    );
  });

  it('requires confirmation before deleting every meal from a day', async () => {
    const { userId, token, yesterday } = await seedYesterday('Agent Bulk');

    const first = await runTool(
      'delete_entry',
      JSON.stringify({ from: yesterday, to: yesterday, deleteAll: true }),
      { userId, today: todayKey() },
    );

    assert.equal(first.pending?.kind, 'confirm_bulk_delete');
    const listed = await request(base, `/entries?from=${yesterday}&to=${yesterday}`, { token });
    assert.equal(listed.data.meta.totalItems, 4);

    const cancelled = await applyPending(userId, first.pending!, 'No');
    assert.match(cancelled.reply, /left those meals/);
    const still = await request(base, `/entries?from=${yesterday}&to=${yesterday}`, { token });
    assert.equal(still.data.meta.totalItems, 4);

    const confirmed = await applyPending(userId, first.pending!, 'Yes', { confirm: true });
    assert.equal(confirmed.actions.length, 4);
    const gone = await request(base, `/entries?from=${yesterday}&to=${yesterday}`, { token });
    assert.equal(gone.data.meta.totalItems, 0);
  });

  it('patches only the requested field on a resolved meal', async () => {
    const { userId, yesterday } = await seedYesterday('Agent Patch');

    const outcome = await runTool(
      'update_entry',
      JSON.stringify({ from: yesterday, to: yesterday, search: 'Rice', calories: 250 }),
      { userId, today: todayKey() },
    );

    assert.equal((outcome.result as { calories: number }).calories, 250);
    assert.equal((outcome.result as { foodName: string }).foodName, 'Rice');
    assert.equal(outcome.action?.type, 'meal_updated');
  });

  it('updates protein on an existing goal without inventing a new calorie target', async () => {
    const account = await signup(base, 'Agent Goal');
    await request(base, '/goals', {
      method: 'POST',
      token: account.token,
      body: {
        dailyCalories: 2200,
        proteinGrams: 100,
        carbGrams: 220,
        fatGrams: 70,
        effectiveFrom: todayKey(),
      },
    });

    const outcome = await runTool(
      'set_goal',
      JSON.stringify({ proteinGrams: 120 }),
      { userId: account.user.id, today: todayKey() },
    );

    const goal = (outcome.result as { goal: { dailyCalories: number; proteinGrams: number } }).goal;
    assert.equal(goal.dailyCalories, 2200);
    assert.equal(goal.proteinGrams, 120);
    assert.equal(outcome.action?.type, 'goals_updated');
  });

  it('computes remaining nutrition from the database, not from the model', async () => {
    const account = await signup(base, 'Agent Remain');
    await request(base, '/goals', {
      method: 'POST',
      token: account.token,
      body: {
        dailyCalories: 2000,
        proteinGrams: 150,
        carbGrams: 200,
        fatGrams: 60,
        effectiveFrom: todayKey(),
      },
    });
    await request(base, '/entries', {
      method: 'POST',
      token: account.token,
      body: {
        foodName: 'Oatmeal',
        mealType: 'breakfast',
        quantity: 1,
        unit: 'bowl',
        calories: 400,
        proteinGrams: 14,
        consumedOn: todayKey(),
      },
    });

    const remaining = await runTool('get_remaining', JSON.stringify({ date: todayKey() }), {
      userId: account.user.id,
      today: todayKey(),
    });
    const data = remaining.result as { remaining: { calories: number; proteinGrams: number } };
    assert.equal(data.remaining.calories, 1600);
    assert.equal(data.remaining.proteinGrams, 136);

    const recs = await runTool('recommend_meal', JSON.stringify({}), {
      userId: account.user.id,
      today: todayKey(),
    });
    const suggestions = (recs.result as { suggestions: { foodName: string }[] }).suggestions;
    assert.ok(suggestions.length > 0);
  });

  it('does not invent a pending choice from an expired payload', async () => {
    const { userId } = await seedYesterday('Agent Expire');
    const pending = createPending('choose_delete', 'remove', [
      {
        entryId: 'missing',
        foodName: 'Ghost',
        mealType: 'lunch',
        quantity: 1,
        unit: 'serving',
        calories: 1,
        consumedOn: daysAgoKey(1),
      },
    ]);
    pending.expiresAt = new Date(Date.now() - 1000).toISOString();

    const result = await applyPending(userId, pending, 'Lunch');
    assert.match(result.reply, /expired/);
    assert.equal(result.pendingAction, null);
  });

  it('logs a photo extract draft as one diary row', async () => {
    const account = await signup(base, 'Agent Photo');
    const pending = createPending('confirm_extract', 'photo', []);
    pending.extract = {
      source: 'meal_photo',
      suggestedMealType: 'lunch',
      confidence: 'high',
      warnings: [],
      notes: null,
      components: [
        { name: 'Rice', quantity: 1, unit: 'cup', calories: 200, proteinGrams: 4, carbGrams: 45, fatGrams: 0 },
      ],
      entry: {
        foodName: 'Rice and chicken',
        quantity: 1,
        unit: 'plate',
        calories: 520,
        proteinGrams: 38,
        carbGrams: 55,
        fatGrams: 14,
        micronutrients: [],
      },
    };

    const result = await applyAttachPending(account.user.id, pending, 'log it', todayKey());
    assert.equal(result.pendingAction, null);
    assert.equal(result.actions[0]?.type, 'meal_created');

    const listed = await request(base, `/entries?from=${todayKey()}&to=${todayKey()}`, {
      token: account.token,
    });
    assert.equal(listed.data.meta.totalItems, 1);
    assert.equal(listed.data.data[0].foodName, 'Rice and chicken');
    assert.equal(listed.data.data[0].source, 'image');
  });

  it('commits a PDF import draft through the same service as bulk import', async () => {
    const account = await signup(base, 'Agent Pdf');
    const pending = createPending('review_import', 'pdf', []);
    pending.importRows = [
      {
        foodName: 'Oats',
        mealType: 'breakfast',
        quantity: 1,
        unit: 'bowl',
        calories: 300,
        proteinGrams: 10,
        carbGrams: 50,
        fatGrams: 6,
        consumedOn: todayKey(),
      },
      {
        foodName: 'Salmon',
        mealType: 'dinner',
        quantity: 1,
        unit: 'serving',
        calories: 520,
        proteinGrams: 40,
        carbGrams: 0,
        fatGrams: 20,
        consumedOn: todayKey(),
      },
    ];

    const result = await applyAttachPending(account.user.id, pending, 'log these', todayKey());
    assert.equal(result.pendingAction, null);
    assert.match(result.reply, /Saved 2/);

    const listed = await request(base, `/entries?from=${todayKey()}&to=${todayKey()}`, {
      token: account.token,
    });
    assert.equal(listed.data.meta.totalItems, 2);
    assert.equal(listed.data.data[0].source, 'pdf');
  });
});
