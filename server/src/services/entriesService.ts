import type { Prisma } from '@prisma/client';
import {
  labelForNutrient,
  unitForNutrient,
  type EntrySource,
  type MealType,
} from '../domain/nutrition.js';
import { fromDateKey, startOfUtcDay } from '../lib/dates.js';
import { badRequest, notFound } from '../lib/errors.js';
import { paginate, toSkipTake, type Paginated } from '../lib/pagination.js';
import { prisma } from '../lib/prisma.js';
import type {
  CreateEntryInput,
  ListEntriesQuery,
  MicronutrientInput,
  UpdateEntryInput,
} from '../types/dto.js';

const entryWithNutrients = { micronutrients: { orderBy: { nutrient: 'asc' } } } as const;

type EntryRecord = Prisma.FoodEntryGetPayload<{ include: typeof entryWithNutrients }>;

export interface EntryDto {
  id: string;
  foodName: string;
  mealType: MealType;
  quantity: number;
  unit: string;
  calories: number;
  macros: { proteinGrams: number; carbGrams: number; fatGrams: number };
  micronutrients: { nutrient: string; label: string; amount: number; unit: string }[];
  consumedAt: string;
  consumedOn: string;
  source: EntrySource;
  createdAt: string;
  updatedAt: string;
}

/**
 * Maps a database row to the API shape. Keeping this in one place means the HTTP
 * response, the chat tool results and the report drill-downs all agree.
 */
function toEntryDto(entry: EntryRecord): EntryDto {
  return {
    id: entry.id,
    foodName: entry.foodName,
    mealType: entry.mealType as MealType,
    quantity: entry.quantity,
    unit: entry.unit,
    calories: entry.calories,
    macros: {
      proteinGrams: entry.proteinGrams,
      carbGrams: entry.carbGrams,
      fatGrams: entry.fatGrams,
    },
    micronutrients: entry.micronutrients.map((item) => ({
      nutrient: item.nutrient,
      label: labelForNutrient(item.nutrient),
      amount: item.amount,
      unit: item.unit,
    })),
    consumedAt: entry.consumedAt.toISOString(),
    consumedOn: entry.consumedOn.toISOString().slice(0, 10),
    source: entry.source as EntrySource,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

/**
 * Collapses duplicate nutrient keys (an AI extraction can repeat one) and pins
 * each amount to the canonical unit for that nutrient.
 */
function normaliseMicronutrients(input: MicronutrientInput[] = []) {
  const byKey = new Map<string, { nutrient: string; amount: number; unit: string }>();

  for (const item of input) {
    byKey.set(item.nutrient, {
      nutrient: item.nutrient,
      amount: item.amount,
      unit: unitForNutrient(item.nutrient, item.unit ?? 'mg'),
    });
  }

  return [...byKey.values()];
}

/**
 * Builds the filter for a list query. `userId` is applied here rather than by the
 * caller so no list path can accidentally read across users.
 */
function buildEntryFilter(userId: string, query: ListEntriesQuery): Prisma.FoodEntryWhereInput {
  const where: Prisma.FoodEntryWhereInput = { userId };

  if (query.from || query.to) {
    // Matched against the day the entry was assigned to, not its timestamp, so
    // the rows returned for "15 August" are exactly the rows the list shows
    // under that date. Filtering on the instant instead would drop a late-night
    // entry whose UTC time has already rolled into the next day.
    where.consumedOn = {
      ...(query.from ? { gte: startOfUtcDay(query.from) } : {}),
      ...(query.to ? { lte: startOfUtcDay(query.to) } : {}),
    };
  }

  if (query.mealType) {
    where.mealType = query.mealType;
  }

  if (query.search) {
    where.foodName = { contains: query.search };
  }

  return where;
}

export async function listEntries(
  userId: string,
  query: ListEntriesQuery,
): Promise<Paginated<EntryDto> & { totals: { calories: number; proteinGrams: number; carbGrams: number; fatGrams: number } }> {
  const where = buildEntryFilter(userId, query);
  const { skip, take } = toSkipTake(query);

  // The totals describe the whole filtered range, not just the current page,
  // which is what makes the number useful next to a paginated table.
  const [rows, totalItems, sums] = await Promise.all([
    prisma.foodEntry.findMany({
      where,
      include: entryWithNutrients,
      orderBy: { [query.sort]: query.order },
      skip,
      take,
    }),
    prisma.foodEntry.count({ where }),
    prisma.foodEntry.aggregate({
      where,
      _sum: { calories: true, proteinGrams: true, carbGrams: true, fatGrams: true },
    }),
  ]);

  return {
    ...paginate(rows.map(toEntryDto), totalItems, query),
    totals: {
      calories: sums._sum.calories ?? 0,
      proteinGrams: sums._sum.proteinGrams ?? 0,
      carbGrams: sums._sum.carbGrams ?? 0,
      fatGrams: sums._sum.fatGrams ?? 0,
    },
  };
}

export async function getEntry(userId: string, id: string): Promise<EntryDto> {
  const entry = await prisma.foodEntry.findFirst({
    where: { id, userId },
    include: entryWithNutrients,
  });

  if (!entry) {
    throw notFound('Food entry');
  }

  return toEntryDto(entry);
}

/**
 * Which calendar day an entry counts towards. The client knows the eater's time
 * zone and says so; without that the UTC day of the timestamp is the best guess
 * available, which is right for a UTC client and for anyone logging mid-morning.
 */
function resolveConsumedOn(input: { consumedOn?: string }, consumedAt: Date): Date {
  return input.consumedOn ? fromDateKey(input.consumedOn) : startOfUtcDay(consumedAt);
}

/**
 * Fills in the values the validators leave out. `consumedAt` defaults here rather
 * than in the validation chain because a chain is built once when the module is
 * imported, so a "now" default there would freeze at server start-up.
 */
function buildCreateData(userId: string, input: CreateEntryInput, source: EntrySource) {
  const consumedAt = input.consumedAt ?? new Date();

  return {
    userId,
    foodName: input.foodName,
    mealType: input.mealType,
    quantity: input.quantity,
    unit: input.unit,
    calories: input.calories,
    proteinGrams: input.proteinGrams ?? 0,
    carbGrams: input.carbGrams ?? 0,
    fatGrams: input.fatGrams ?? 0,
    consumedAt,
    consumedOn: resolveConsumedOn(input, consumedAt),
    source,
    micronutrients: { create: normaliseMicronutrients(input.micronutrients) },
  };
}

export async function createEntry(
  userId: string,
  input: CreateEntryInput,
  source: EntrySource = 'manual',
): Promise<EntryDto> {
  const entry = await prisma.foodEntry.create({
    data: buildCreateData(userId, input, source),
    include: entryWithNutrients,
  });

  return toEntryDto(entry);
}

/**
 * Creates many entries in one transaction, used by the PDF import: a partially
 * imported diary is worse than a failed import the user can retry.
 */
export async function createEntries(
  userId: string,
  inputs: CreateEntryInput[],
  source: EntrySource,
): Promise<EntryDto[]> {
  const rows = await prisma.$transaction(
    inputs.map((input) =>
      prisma.foodEntry.create({
        data: buildCreateData(userId, input, source),
        include: entryWithNutrients,
      }),
    ),
  );

  return rows.map(toEntryDto);
}

export async function updateEntry(
  userId: string,
  id: string,
  input: UpdateEntryInput,
): Promise<EntryDto> {
  if (Object.keys(input).length === 0) {
    throw badRequest('Provide at least one field to update.');
  }

  // Verifies ownership before writing: `update` alone matches on primary key and
  // would happily modify another user's row.
  await assertEntryExists(userId, id);

  const { micronutrients, consumedAt, consumedOn, ...rest } = input;

  const entry = await prisma.foodEntry.update({
    where: { id },
    data: {
      ...rest,
      ...(consumedAt ? { consumedAt } : {}),
      // The day moves when either the timestamp or the day itself changes, and
      // an explicit `consumedOn` always wins over one inferred from the instant.
      ...(consumedOn || consumedAt
        ? { consumedOn: resolveConsumedOn({ consumedOn }, consumedAt ?? new Date()) }
        : {}),
      // Micronutrients are replaced wholesale rather than merged, so the payload
      // the client sends is exactly what it gets back.
      ...(micronutrients
        ? {
            micronutrients: {
              deleteMany: {},
              create: normaliseMicronutrients(micronutrients),
            },
          }
        : {}),
    },
    include: entryWithNutrients,
  });

  return toEntryDto(entry);
}

export async function deleteEntry(userId: string, id: string): Promise<void> {
  await assertEntryExists(userId, id);
  await prisma.foodEntry.delete({ where: { id } });
}

async function assertEntryExists(userId: string, id: string): Promise<void> {
  const existing = await prisma.foodEntry.findFirst({ where: { id, userId }, select: { id: true } });

  if (!existing) {
    throw notFound('Food entry');
  }
}
