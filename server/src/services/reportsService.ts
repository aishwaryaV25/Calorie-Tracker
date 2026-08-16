import { MACRO_KEYS, labelForNutrient } from '../domain/nutrition.js';
import {
  addDays,
  differenceInDays,
  eachDayInRange,
  startOfIsoWeek,
  startOfUtcDay,
  toDateKey,
} from '../lib/dates.js';
import { badRequest } from '../lib/errors.js';
import { paginate, type Paginated } from '../lib/pagination.js';
import { prisma } from '../lib/prisma.js';
import type { ReportRangeQuery } from '../types/dto.js';
import { getGoalsCovering, type GoalDto } from './goalsService.js';

const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 30;

export interface MacroTotals {
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}

export interface DailyTotals extends MacroTotals {
  date: string;
  calories: number;
  entryCount: number;
}

export interface DailyReportRow extends DailyTotals {

  goal: { dailyCalories: number } & MacroTotals | null;
  caloriesRemaining: number | null;
}

export interface WeeklyReportRow extends MacroTotals {
  weekStart: string;
  weekEnd: string;
  calories: number;
  entryCount: number;
  daysLogged: number;
  averageDailyCalories: number;
}

export interface ResolvedRange {
  from: Date;
  to: Date;
  days: number;
}

export function resolveRange(query: ReportRangeQuery): ResolvedRange {
  let to = startOfUtcDay(query.to ?? new Date());
  let from = startOfUtcDay(query.from ?? addDays(to, -(DEFAULT_RANGE_DAYS - 1)));

  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }

  const days = differenceInDays(to, from) + 1;

  if (days > MAX_RANGE_DAYS) {
    throw badRequest(`Date range must be ${MAX_RANGE_DAYS} days or fewer (received ${days}).`);
  }

  return { from, to, days };
}

async function sumByDay(userId: string, from: Date, to: Date) {
  const grouped = await prisma.foodEntry.groupBy({
    by: ['consumedOn'],
    where: { userId, consumedOn: { gte: from, lte: to } },
    _sum: { calories: true, proteinGrams: true, carbGrams: true, fatGrams: true },
    _count: { _all: true },
  });

  return new Map(
    grouped.map((row) => [
      toDateKey(row.consumedOn),
      {
        calories: row._sum.calories ?? 0,
        proteinGrams: row._sum.proteinGrams ?? 0,
        carbGrams: row._sum.carbGrams ?? 0,
        fatGrams: row._sum.fatGrams ?? 0,
        entryCount: row._count._all,
      },
    ]),
  );
}

async function buildDailyTotals(userId: string, from: Date, to: Date): Promise<DailyTotals[]> {
  const totals = await sumByDay(userId, from, to);

  return eachDayInRange(from, to).map((day) => {
    const key = toDateKey(day);
    const found = totals.get(key);

    return {
      date: key,
      calories: found?.calories ?? 0,
      proteinGrams: found?.proteinGrams ?? 0,
      carbGrams: found?.carbGrams ?? 0,
      fatGrams: found?.fatGrams ?? 0,
      entryCount: found?.entryCount ?? 0,
    };
  });
}

function goalForDay(goals: GoalDto[], dateKey: string): GoalDto | null {
  return goals.find((goal) => goal.effectiveFrom <= dateKey) ?? null;
}

export async function getDailyReport(
  userId: string,
  query: ReportRangeQuery,
): Promise<Paginated<DailyReportRow> & { range: { from: string; to: string } }> {
  const { from, to } = resolveRange(query);
  const [totals, goals] = await Promise.all([
    buildDailyTotals(userId, from, to),
    getGoalsCovering(userId, from, to),
  ]);

  const rows: DailyReportRow[] = totals.map((day) => {
    const goal = goalForDay(goals, day.date);

    return {
      ...day,
      goal: goal
        ? {
            dailyCalories: goal.dailyCalories,
            proteinGrams: goal.proteinGrams,
            carbGrams: goal.carbGrams,
            fatGrams: goal.fatGrams,
          }
        : null,
      caloriesRemaining: goal ? round(goal.dailyCalories - day.calories) : null,
    };
  });

  const ordered = [...rows].reverse();
  const start = (query.page - 1) * query.pageSize;

  return {
    ...paginate(ordered.slice(start, start + query.pageSize), ordered.length, query),
    range: { from: toDateKey(from), to: toDateKey(to) },
  };
}

export async function getWeeklyReport(
  userId: string,
  query: ReportRangeQuery,
): Promise<Paginated<WeeklyReportRow> & { range: { from: string; to: string } }> {
  const { from, to } = resolveRange(query);
  const totals = await buildDailyTotals(userId, from, to);

  const buckets = new Map<string, WeeklyReportRow>();

  for (const day of totals) {
    const weekStart = startOfIsoWeek(new Date(`${day.date}T00:00:00Z`));
    const key = toDateKey(weekStart);

    const bucket = buckets.get(key) ?? {
      weekStart: key,
      weekEnd: toDateKey(addDays(weekStart, 6)),
      calories: 0,
      proteinGrams: 0,
      carbGrams: 0,
      fatGrams: 0,
      entryCount: 0,
      daysLogged: 0,
      averageDailyCalories: 0,
    };

    bucket.calories += day.calories;
    bucket.proteinGrams += day.proteinGrams;
    bucket.carbGrams += day.carbGrams;
    bucket.fatGrams += day.fatGrams;
    bucket.entryCount += day.entryCount;
    bucket.daysLogged += day.entryCount > 0 ? 1 : 0;

    buckets.set(key, bucket);
  }

  const rows = [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      calories: round(bucket.calories),
      proteinGrams: round(bucket.proteinGrams),
      carbGrams: round(bucket.carbGrams),
      fatGrams: round(bucket.fatGrams),

      averageDailyCalories: bucket.daysLogged > 0 ? round(bucket.calories / bucket.daysLogged) : 0,
    }))
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  const start = (query.page - 1) * query.pageSize;

  return {
    ...paginate(rows.slice(start, start + query.pageSize), rows.length, query),
    range: { from: toDateKey(from), to: toDateKey(to) },
  };
}

export interface MicronutrientRow {
  nutrient: string;
  label: string;
  total: number;
  averagePerDay: number;
  unit: string;
}

export async function getMicronutrientReport(
  userId: string,
  query: ReportRangeQuery,
): Promise<Paginated<MicronutrientRow> & { range: { from: string; to: string }; days: number }> {
  const { from, to, days } = resolveRange(query);

  const grouped = await prisma.nutrientAmount.groupBy({
    by: ['nutrient', 'unit'],
    where: { entry: { userId, consumedOn: { gte: from, lte: to } } },
    _sum: { amount: true },
  });

  const rows: MicronutrientRow[] = grouped
    .map((row) => {
      const total = round(row._sum.amount ?? 0);

      return {
        nutrient: row.nutrient,
        label: labelForNutrient(row.nutrient),
        total,
        averagePerDay: round(total / days),
        unit: row.unit,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  const start = (query.page - 1) * query.pageSize;

  return {
    ...paginate(rows.slice(start, start + query.pageSize), rows.length, query),
    range: { from: toDateKey(from), to: toDateKey(to) },
    days,
  };
}

export interface GoalComparison {
  range: { from: string; to: string; days: number };
  daysLogged: number;
  actual: { calories: number; averageDailyCalories: number } & MacroTotals;
  target: { calories: number; averageDailyCalories: number } & MacroTotals;

  adherence: { calories: number; proteinGrams: number; carbGrams: number; fatGrams: number } | null;
  hasGoal: boolean;
}

export async function getGoalComparison(
  userId: string,
  query: ReportRangeQuery,
): Promise<GoalComparison> {
  const { from, to, days } = resolveRange(query);
  const [totals, goals] = await Promise.all([
    buildDailyTotals(userId, from, to),
    getGoalsCovering(userId, from, to),
  ]);

  const actual = { calories: 0, proteinGrams: 0, carbGrams: 0, fatGrams: 0 };
  const target = { calories: 0, proteinGrams: 0, carbGrams: 0, fatGrams: 0 };
  let daysLogged = 0;
  let daysWithGoal = 0;

  for (const day of totals) {
    actual.calories += day.calories;
    actual.proteinGrams += day.proteinGrams;
    actual.carbGrams += day.carbGrams;
    actual.fatGrams += day.fatGrams;

    if (day.entryCount > 0) {
      daysLogged += 1;
    }

    const goal = goalForDay(goals, day.date);

    if (goal) {
      daysWithGoal += 1;
      target.calories += goal.dailyCalories;
      target.proteinGrams += goal.proteinGrams;
      target.carbGrams += goal.carbGrams;
      target.fatGrams += goal.fatGrams;
    }
  }

  const percentage = (value: number, of: number) => (of === 0 ? 0 : round((value / of) * 100));

  return {
    range: { from: toDateKey(from), to: toDateKey(to), days },
    daysLogged,
    actual: {
      calories: round(actual.calories),
      proteinGrams: round(actual.proteinGrams),
      carbGrams: round(actual.carbGrams),
      fatGrams: round(actual.fatGrams),
      averageDailyCalories: daysLogged > 0 ? round(actual.calories / daysLogged) : 0,
    },
    target: {
      calories: round(target.calories),
      proteinGrams: round(target.proteinGrams),
      carbGrams: round(target.carbGrams),
      fatGrams: round(target.fatGrams),
      averageDailyCalories: daysWithGoal > 0 ? round(target.calories / daysWithGoal) : 0,
    },
    adherence:
      daysWithGoal === 0
        ? null
        : {
            calories: percentage(actual.calories, target.calories),
            proteinGrams: percentage(actual.proteinGrams, target.proteinGrams),
            carbGrams: percentage(actual.carbGrams, target.carbGrams),
            fatGrams: percentage(actual.fatGrams, target.fatGrams),
          },
    hasGoal: daysWithGoal > 0,
  };
}

export interface MacroBreakdown {
  grams: MacroTotals;

  caloriePercentage: MacroTotals;
}

export async function getMacroBreakdown(
  userId: string,
  query: ReportRangeQuery,
): Promise<MacroBreakdown & { range: { from: string; to: string } }> {
  const { from, to } = resolveRange(query);

  const sums = await prisma.foodEntry.aggregate({
    where: { userId, consumedOn: { gte: from, lte: to } },
    _sum: { proteinGrams: true, carbGrams: true, fatGrams: true },
  });

  const grams: MacroTotals = {
    proteinGrams: round(sums._sum.proteinGrams ?? 0),
    carbGrams: round(sums._sum.carbGrams ?? 0),
    fatGrams: round(sums._sum.fatGrams ?? 0),
  };

  const energy = {
    proteinGrams: grams.proteinGrams * 4,
    carbGrams: grams.carbGrams * 4,
    fatGrams: grams.fatGrams * 9,
  };

  const totalEnergy = MACRO_KEYS.reduce((sum, key) => sum + energy[key], 0);
  const share = (value: number) => (totalEnergy === 0 ? 0 : round((value / totalEnergy) * 100));

  const proteinShare = share(energy.proteinGrams);
  const carbShare = share(energy.carbGrams);

  return {
    grams,
    caloriePercentage: {
      proteinGrams: proteinShare,
      carbGrams: carbShare,

      fatGrams: totalEnergy === 0 ? 0 : round(100 - proteinShare - carbShare),
    },
    range: { from: toDateKey(from), to: toDateKey(to) },
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
