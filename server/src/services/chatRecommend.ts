import { fromDateKey } from '../lib/dates.js';
import * as entriesService from './entriesService.js';
import * as goalsService from './goalsService.js';

export interface RemainingNutrition {
  date: string;
  hasGoal: boolean;
  target: { calories: number; proteinGrams: number; carbGrams: number; fatGrams: number } | null;
  eaten: { calories: number; proteinGrams: number; carbGrams: number; fatGrams: number };
  remaining: { calories: number; proteinGrams: number; carbGrams: number; fatGrams: number };
}

/**
 * Common plate-sized suggestions. These are not the user's diary — they are a
 * short list the assistant can offer after remaining macros have been computed
 * from the database.
 */
const SUGGESTIONS = [
  { foodName: 'Greek yogurt', quantity: 200, unit: 'g', calories: 130, proteinGrams: 20, carbGrams: 8, fatGrams: 4 },
  { foodName: 'Chicken breast', quantity: 150, unit: 'g', calories: 248, proteinGrams: 46, carbGrams: 0, fatGrams: 5 },
  { foodName: 'Eggs', quantity: 2, unit: 'large', calories: 144, proteinGrams: 13, carbGrams: 1, fatGrams: 10 },
  { foodName: 'Cottage cheese', quantity: 150, unit: 'g', calories: 147, proteinGrams: 17, carbGrams: 5, fatGrams: 6 },
  { foodName: 'Tofu stir-fry', quantity: 1, unit: 'bowl', calories: 280, proteinGrams: 18, carbGrams: 16, fatGrams: 14 },
  { foodName: 'Salmon', quantity: 120, unit: 'g', calories: 250, proteinGrams: 25, carbGrams: 0, fatGrams: 16 },
  { foodName: 'Lentil soup', quantity: 1, unit: 'bowl', calories: 220, proteinGrams: 12, carbGrams: 32, fatGrams: 4 },
  { foodName: 'Apple and peanut butter', quantity: 1, unit: 'serving', calories: 190, proteinGrams: 5, carbGrams: 24, fatGrams: 9 },
  { foodName: 'Protein shake', quantity: 1, unit: 'scoop', calories: 120, proteinGrams: 24, carbGrams: 3, fatGrams: 2 },
  { foodName: 'Mixed salad with chickpeas', quantity: 1, unit: 'bowl', calories: 320, proteinGrams: 14, carbGrams: 38, fatGrams: 12 },
] as const;

export async function getRemainingNutrition(userId: string, date: string): Promise<RemainingNutrition> {
  const [goal, day] = await Promise.all([
    goalsService.getGoalForDate(userId, fromDateKey(date)),
    entriesService.listEntries(userId, {
      from: fromDateKey(date),
      to: fromDateKey(date),
      sort: 'consumedAt',
      order: 'asc',
      page: 1,
      pageSize: 1,
    }),
  ]);

  const eaten = {
    calories: day.totals.calories,
    proteinGrams: day.totals.proteinGrams,
    carbGrams: day.totals.carbGrams,
    fatGrams: day.totals.fatGrams,
  };

  if (!goal) {
    return {
      date,
      hasGoal: false,
      target: null,
      eaten,
      remaining: { calories: 0, proteinGrams: 0, carbGrams: 0, fatGrams: 0 },
    };
  }

  const remaining = {
    calories: Math.max(0, goal.dailyCalories - eaten.calories),
    proteinGrams: Math.max(0, goal.proteinGrams - eaten.proteinGrams),
    carbGrams: Math.max(0, goal.carbGrams - eaten.carbGrams),
    fatGrams: Math.max(0, goal.fatGrams - eaten.fatGrams),
  };

  return {
    date,
    hasGoal: true,
    target: {
      calories: goal.dailyCalories,
      proteinGrams: goal.proteinGrams,
      carbGrams: goal.carbGrams,
      fatGrams: goal.fatGrams,
    },
    eaten,
    remaining,
  };
}

export async function recommendFoods(userId: string, date: string) {
  const remaining = await getRemainingNutrition(userId, date);

  if (!remaining.hasGoal) {
    return {
      remaining,
      suggestions: [],
      message: 'Set a calorie and protein target first, then I can suggest what still fits.',
    };
  }

  const budget = remaining.remaining;
  const wantsProtein = budget.proteinGrams >= 10;

  const suggestions = SUGGESTIONS.filter((food) => food.calories <= Math.max(budget.calories, 0) + 20)
    .filter((food) => !wantsProtein || food.proteinGrams >= 10)
    .slice(0, 4);

  return {
    remaining,
    suggestions,
    message:
      suggestions.length === 0
        ? 'Nothing in the shortlist fits the remaining budget. A smaller snack, or stopping for the day, is the honest answer.'
        : 'These are suggestions that fit the remaining budget, not foods from your diary.',
  };
}
