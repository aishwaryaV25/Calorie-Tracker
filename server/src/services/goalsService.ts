import type { Goal } from '@prisma/client';
import { startOfUtcDay } from '../lib/dates.js';
import { notFound } from '../lib/errors.js';
import { paginate, toSkipTake, type Paginated } from '../lib/pagination.js';
import { prisma } from '../lib/prisma.js';
import type { CreateGoalInput, ListGoalsQuery } from '../types/dto.js';

export interface GoalDto {
  id: string;
  dailyCalories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  targetWeightKg: number | null;
  effectiveFrom: string;
  createdAt: string;
}

const toGoalDto = (goal: Goal): GoalDto => ({
  id: goal.id,
  dailyCalories: goal.dailyCalories,
  proteinGrams: goal.proteinGrams,
  carbGrams: goal.carbGrams,
  fatGrams: goal.fatGrams,
  targetWeightKg: goal.targetWeightKg,
  effectiveFrom: goal.effectiveFrom.toISOString().slice(0, 10),
  createdAt: goal.createdAt.toISOString(),
});

/**
 * Setting a goal appends a new version rather than editing the current one, so a
 * report for an earlier week still compares against the targets that were in
 * force then. Re-saving on a date that already has a goal replaces that version,
 * which keeps "I set it twice today" from creating two competing rows.
 */
export async function setGoal(userId: string, input: CreateGoalInput): Promise<GoalDto> {
  // Defaults to today here rather than in the validation chain, which is built
  // once at import and would otherwise freeze to the server's start-up date.
  const effectiveFrom = startOfUtcDay(input.effectiveFrom ?? new Date());

  const existing = await prisma.goal.findFirst({
    where: { userId, effectiveFrom },
    select: { id: true },
  });

  const data = {
    userId,
    dailyCalories: input.dailyCalories,
    proteinGrams: input.proteinGrams,
    carbGrams: input.carbGrams,
    fatGrams: input.fatGrams,
    targetWeightKg: input.targetWeightKg ?? null,
    effectiveFrom,
  };

  const goal = existing
    ? await prisma.goal.update({ where: { id: existing.id }, data })
    : await prisma.goal.create({ data });

  return toGoalDto(goal);
}

/**
 * The goal in force on `date`: the most recent version not later than that day.
 *
 * There is deliberately no "current goal" convenience wrapper around this. The
 * server's own UTC day is not the day the user is having — a goal saved at 04:00
 * in Delhi is dated tomorrow as far as UTC is concerned — so every caller has to
 * say which day it means.
 */
export async function getGoalForDate(userId: string, date: Date): Promise<GoalDto | null> {
  const goal = await prisma.goal.findFirst({
    where: { userId, effectiveFrom: { lte: startOfUtcDay(date) } },
    orderBy: { effectiveFrom: 'desc' },
  });

  return goal ? toGoalDto(goal) : null;
}

/**
 * Every goal version that applies to any day in the range, newest first. Reports
 * use this to attribute each day to its own targets in a single query instead of
 * one lookup per day.
 */
export async function getGoalsCovering(userId: string, from: Date, to: Date): Promise<GoalDto[]> {
  const goals = await prisma.goal.findMany({
    where: { userId, effectiveFrom: { lte: startOfUtcDay(to) } },
    orderBy: { effectiveFrom: 'desc' },
  });

  const firstRelevant = goals.findIndex((goal) => goal.effectiveFrom <= startOfUtcDay(from));

  // Keep every version inside the range, plus the one that was already active
  // when the range began.
  return (firstRelevant === -1 ? goals : goals.slice(0, firstRelevant + 1)).map(toGoalDto);
}

export async function listGoals(
  userId: string,
  query: ListGoalsQuery,
): Promise<Paginated<GoalDto>> {
  const where = { userId };
  const { skip, take } = toSkipTake(query);

  const [rows, totalItems] = await Promise.all([
    prisma.goal.findMany({ where, orderBy: { effectiveFrom: 'desc' }, skip, take }),
    prisma.goal.count({ where }),
  ]);

  return paginate(rows.map(toGoalDto), totalItems, query);
}

export async function deleteGoal(userId: string, id: string): Promise<void> {
  const existing = await prisma.goal.findFirst({ where: { id, userId }, select: { id: true } });

  if (!existing) {
    throw notFound('Goal');
  }

  await prisma.goal.delete({ where: { id } });
}
