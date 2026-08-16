import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDietBotPrompt,
  describeAppPage,
  DIET_BOT_TOOL_DEFINITIONS,
  DIET_BOT_TOOL_NAMES,
  formatDietSnapshot,
} from './dietBotService.js';

describe('diet bot', () => {
  it('cannot write the diary', () => {
    const names = DIET_BOT_TOOL_DEFINITIONS.map((tool) => tool.function.name);
    assert.deepEqual([...names].sort(), [...DIET_BOT_TOOL_NAMES].sort());
    assert.ok(names.includes('get_weight'));
    assert.ok(!names.includes('log_meal'));
    assert.ok(!names.includes('log_weight'));
    assert.ok(!names.includes('generate_report_pdf'));
    assert.ok(!names.includes('set_goal'));
    assert.ok(!names.includes('update_entry'));
    assert.ok(!names.includes('delete_entry'));
  });

  it('explains the page they are on', () => {
    assert.match(describeAppPage('/log'), /Log Meal/);
    assert.match(describeAppPage('/weight'), /Weight/);
    assert.match(describeAppPage('/chat?x=1'), /Chat Support/);
    assert.match(describeAppPage('/mystery'), /unsure/);
  });

  it('puts live numbers in the prompt instead of asking the model to guess', () => {
    const snapshot = formatDietSnapshot({
      remaining: {
        date: '2026-08-16',
        hasGoal: true,
        target: { calories: 2200, proteinGrams: 140, carbGrams: 200, fatGrams: 70 },
        eaten: { calories: 800, proteinGrams: 40, carbGrams: 70, fatGrams: 20 },
        remaining: { calories: 1400, proteinGrams: 100, carbGrams: 130, fatGrams: 50 },
      },
      meals: [{ foodName: 'Eggs', mealType: 'breakfast', calories: 180 }],
      weight: {
        latestKg: 72.4,
        latestOn: '2026-08-16',
        previousKg: 72.8,
        targetKg: 70,
      },
    });

    const prompt = buildDietBotPrompt({
      today: '2026-08-16',
      firstName: 'Ram',
      page: '/dashboard',
      snapshot,
    });

    assert.match(prompt, /Bite/);
    assert.match(prompt, /Ram/);
    assert.match(prompt, /1400 kcal/);
    assert.match(prompt, /Eggs/);
    assert.match(prompt, /cannot log/i);
    assert.match(prompt, /72\.4 kg/);
    assert.match(prompt, /Goal weight: 70 kg/);
    assert.match(prompt, /GYM AND TRAINING/);
    assert.match(prompt, /Weight: one reading per day/);
  });
});
