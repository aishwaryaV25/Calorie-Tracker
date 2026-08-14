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

/** Guards against a request that would aggregate an unbounded amount of data. */
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
  /** Targets that were in force on this specific day, if any were set. */
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

/**
 * Applies the default window and rejects ranges too large to aggregate. Dates are
 * normalised to whole UTC days so a caller passing a timestamp still gets a
 * sensible bucket.
 */
export function resolveRange(query: ReportRangeQuery): ResolvedRange {
  const to = startOfUtcDay(query.to ?? new Date());
  const from = startOfUtcDay(query.from ?? addDays(to, -(DEFAULT_RANGE_DAYS - 1)));

  if (from > to) {
    throw badRequest('"from" must be on or before "to".');
  }

  const days = differenceInDays(to, from) + 1;

  if (days > MAX_RANGE_DAYS) {
    throw badRequest(`Date range must be ${MAX_RANGE_DAYS} days or fewer (received ${days}).`);
  }

  return { from, to, days };
}

/**
 * Per-day totals straight from the database.
 *
 * Grouping on the denormalised `consumedOn` column means the database does the
 * aggregation with an index, and the query contains no dialect-specific date
 * functions. Days with no entries are absent here and filled in by the caller.
 */
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

/** Zero-filled totals for every day in the range, oldest first. */
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

/**
 * Picks the goal version in force on a given day from a list ordered newest
 * first, so a whole range can be attributed without a query per day.
 */
function goalForDay(goals: GoalDto[], dateKey: string): GoalDto | null {
  return goals.find((goal) => goal.effectiveFrom <= dateKey) ?? null;
}

/**
 * Daily calorie and macro totals with the goal that applied on each day.
 * Drives the calorie trend line and the macro-by-day chart.
 */
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

  // Newest first: a user opening a report cares about recent days.
  const ordered = [...rows].reverse();
  const start = (query.page - 1) * query.pageSize;

  return {
    ...paginate(ordered.slice(start, start + query.pageSize), ordered.length, query),
    range: { from: toDateKey(from), to: toDateKey(to) },
  };
}

/**
 * Weekly rollups. Buckets are built in application code from the daily totals
 * because ISO week numbering differs between database engines, and the number of
 * days involved is small and already bounded.
 */
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
      // Averaged over days actually logged, so a partial week is not misread as
      // a week of under-eating.
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

/**
 * Totals for each vitamin and mineral over the range. Grouping happens in the
 * database against the nutrient rows, filtered through the relation so the scope
 * stays tied to the user.
 */
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
  /** Actual as a percentage of target; null when no goal covers the range. */
  adherence: { calories: number; proteinGrams: number; carbGrams: number; fatGrams: number } | null;
  hasGoal: boolean;
}

/**
 * Goal versus actual across the range. Targets are accumulated per day using the
 * goal in force on that day, so a mid-range change in targets is reflected
 * correctly rather than applying today's numbers retroactively.
 */
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
  /** Share of total energy from each macro, which is what a pie chart needs. */
  caloriePercentage: MacroTotals;
}

/**
 * Macro split for the range, expressed both in grams and as a share of energy.
 * Percentages use the 4/4/9 kcal-per-gram convention rather than logged calories
 * so the three slices always add up to 100.
 */
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
      // Derived from the other two rather than rounded independently, otherwise
      // three rounded values can total 100.01 and a pie chart shows a sliver of
      // overflow.
      fatGrams: totalEnergy === 0 ? 0 : round(100 - proteinShare - carbShare),
    },
    range: { from: toDateKey(from), to: toDateKey(to) },
  };
}

/** Nutrition values are noisy enough that two decimals is plenty. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
