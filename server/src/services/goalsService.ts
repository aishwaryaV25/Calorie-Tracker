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

export async function setGoal(userId: string, input: CreateGoalInput): Promise<GoalDto> {

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

export async function getGoalForDate(userId: string, date: Date): Promise<GoalDto | null> {
  const goal = await prisma.goal.findFirst({
    where: { userId, effectiveFrom: { lte: startOfUtcDay(date) } },
    orderBy: { effectiveFrom: 'desc' },
  });

  return goal ? toGoalDto(goal) : null;
}

export async function getGoalsCovering(userId: string, from: Date, to: Date): Promise<GoalDto[]> {
  const goals = await prisma.goal.findMany({
    where: { userId, effectiveFrom: { lte: startOfUtcDay(to) } },
    orderBy: { effectiveFrom: 'desc' },
  });

  const firstRelevant = goals.findIndex((goal) => goal.effectiveFrom <= startOfUtcDay(from));

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
