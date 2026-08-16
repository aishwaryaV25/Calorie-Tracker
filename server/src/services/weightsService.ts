import type { WeightLog } from '@prisma/client';
import { fromDateKey, startOfUtcDay, toDateKey } from '../lib/dates.js';
import { notFound } from '../lib/errors.js';
import { paginate, toSkipTake, type Paginated } from '../lib/pagination.js';
import { prisma } from '../lib/prisma.js';
import type { CreateWeightInput, ListWeightsQuery } from '../types/dto.js';

export interface WeightDto {
  id: string;
  kg: number;
  loggedOn: string;
  note: string | null;
  createdAt: string;
}

export interface WeightSummary {
  latest: WeightDto | null;
  previous: WeightDto | null;
  recent: WeightDto[];
}

const toWeightDto = (row: WeightLog): WeightDto => ({
  id: row.id,
  kg: row.kg,
  loggedOn: toDateKey(row.loggedOn),
  note: row.note,
  createdAt: row.createdAt.toISOString(),
});

export async function logWeight(userId: string, input: CreateWeightInput): Promise<WeightDto> {
  const loggedOn = input.loggedOn ? fromDateKey(input.loggedOn) : startOfUtcDay(new Date());
  const note = input.note?.trim() ? input.note.trim() : null;

  const row = await prisma.weightLog.upsert({
    where: { userId_loggedOn: { userId, loggedOn } },
    create: { userId, kg: input.kg, loggedOn, note },
    update: { kg: input.kg, note },
  });

  return toWeightDto(row);
}

export async function getLatest(userId: string): Promise<WeightDto | null> {
  const row = await prisma.weightLog.findFirst({
    where: { userId },
    orderBy: { loggedOn: 'desc' },
  });

  return row ? toWeightDto(row) : null;
}

export async function summarize(userId: string, recentCount = 8): Promise<WeightSummary> {
  const recent = await prisma.weightLog.findMany({
    where: { userId },
    orderBy: { loggedOn: 'desc' },
    take: Math.max(2, recentCount),
  });

  return {
    latest: recent[0] ? toWeightDto(recent[0]) : null,
    previous: recent[1] ? toWeightDto(recent[1]) : null,
    recent: recent.map(toWeightDto),
  };
}

export async function listWeights(
  userId: string,
  query: ListWeightsQuery,
): Promise<Paginated<WeightDto>> {
  const where = { userId };
  const { skip, take } = toSkipTake(query);

  const [rows, totalItems] = await Promise.all([
    prisma.weightLog.findMany({ where, orderBy: { loggedOn: 'desc' }, skip, take }),
    prisma.weightLog.count({ where }),
  ]);

  return paginate(rows.map(toWeightDto), totalItems, query);
}

export async function deleteWeight(userId: string, id: string): Promise<void> {
  const existing = await prisma.weightLog.findFirst({ where: { id, userId }, select: { id: true } });

  if (!existing) {
    throw notFound('Weight log');
  }

  await prisma.weightLog.delete({ where: { id } });
}
