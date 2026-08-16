import {
  CALORIES_PER_GRAM,
  MEAL_TYPES,
  MICRONUTRIENT_KEYS,
  isKnownMicronutrient,
  type MealType,
} from '../domain/nutrition.js';
import type { ToolDefinition } from '../lib/ai-client.js';
import { addDays, fromDateKey, toDateKey } from '../lib/dates.js';
import { resolveReportWindow } from './chatDates.js';
import * as reportPdfService from './reportPdfService.js';
import { AppError, badRequest } from '../lib/errors.js';
import type { CreateEntryInput, UpdateEntryInput } from '../types/dto.js';
import { createPending, describePending, type PendingAction } from './chatPending.js';
import { getRemainingNutrition, recommendFoods } from './chatRecommend.js';
import { loadEntries, resolveAmong, type EntryRef } from './chatResolve.js';
import type { ChatAction } from './chatTypes.js';
import * as entriesService from './entriesService.js';
import * as goalsService from './goalsService.js';
import * as reportsService from './reportsService.js';
import * as weightsService from './weightsService.js';

/**
 * The actions the assistant can take on the user's behalf.
 *
 * Every tool is a thin adapter over the same service a route calls, so a meal
 * logged by chat goes through identical ownership checks and day-bucketing rules
 * as one logged through the form. Two things are deliberately not negotiable by
 * the model: `userId`, which comes from the authenticated request, and the
 * numeric bounds below, since arguments arrive as free-form JSON and never pass
 * through the express-validator chains that guard the HTTP surface.
 */

export type { ChatAction } from './chatTypes.js';

export interface ToolContext {
  userId: string;
  /** The user's own calendar day, which anchors "today" and "yesterday". */
  today: string;
}

export interface ToolOutcome {
  /** Serialised straight back to the model as the tool's result. */
  result: unknown;
  /** Set only when the database changed, which is what the client refreshes on. */
  action?: ChatAction;
  /** Set when the user must pick a row or confirm a bulk delete. */
  pending?: PendingAction;
  /** Bulk writes that produced more than one action. */
  actions?: ChatAction[];
  /** A file the client should save. Never sent back to the model. */
  download?: { filename: string; buffer: Buffer };
}

interface ChatTool {
  definition: ToolDefinition;
  handle: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolOutcome>;
}

/**
 * The bounds the express-validator chains enforce on the HTTP surface.
 *
 * Repeated here because tool arguments never pass through those chains: they
 * arrive as free-form JSON from the model. Holding them to the same range keeps a
 * meal logged by chat exactly as trustworthy as one logged through the form.
 */
const LIMITS = {
  /** Calories and macro grams on an entry. */
  amount: 100_000,
  quantity: 10_000,
  dailyCalories: 20_000,
  macroTarget: 2_000,
  targetWeightKg: 500,
} as const;

const MAX_MICRONUTRIENTS = 8;
const DEFAULT_ENTRY_RESULTS = 10;
const MAX_ENTRY_RESULTS = 20;
/** A month of daily rows is enough context for any question worth asking. */
const MAX_DAILY_ROWS = 31;
const MAX_WEEKLY_ROWS = 8;
const MAX_MICRONUTRIENT_ROWS = 30;
const SUMMARY_DEFAULT_DAYS = 7;

const logMealTool: ChatTool = {
  definition: {
    type: 'function',
    function: {
      name: 'log_meal',
      description:
        'Add one food to the diary. Estimate the nutrition yourself when the user does not give numbers. Call once per distinct food.',
      parameters: {
        type: 'object',
        required: ['foodName', 'mealType', 'calories'],
        properties: {
          foodName: { type: 'string', description: 'What was eaten, e.g. "Grilled chicken salad".' },
          mealType: { type: 'string', enum: MEAL_TYPES },
          calories: { type: 'number', description: 'Total kcal for the portion described.' },
          quantity: { type: 'number', description: 'Portion amount. Defaults to 1.' },
          unit: { type: 'string', description: 'g, ml, cup, bowl, piece, serving.' },
          proteinGrams: { type: 'number' },
          carbGrams: { type: 'number' },
          fatGrams: { type: 'number' },
          consumedOn: {
            type: 'string',
            description: 'Calendar day as YYYY-MM-DD. Defaults to today.',
          },
          micronutrients: {
            type: 'array',
            description: 'Only when notable or stated. At most 8.',
            items: {
              type: 'object',
              required: ['nutrient', 'amount'],
              properties: {
                nutrient: { type: 'string', enum: MICRONUTRIENT_KEYS },
                amount: { type: 'number' },
              },
            },
          },
        },
      },
    },
  },
  async handle(args, context) {
    const foodName = readString(args, 'foodName');
    const mealType = readMealType(args, 'mealType');
    const calories = readNumber(args, 'calories');

    if (!foodName) {
      throw badRequest('foodName is required.');
    }

    if (!mealType) {
      throw badRequest(`mealType must be one of: ${MEAL_TYPES.join(', ')}.`);
    }

    if (calories === undefined) {
      throw badRequest('calories is required. Estimate it from the food and portion.');
    }

    const consumedOn = readDateKey(args, 'consumedOn') ?? context.today;

    const input: CreateEntryInput = {
      foodName: foodName.slice(0, 160),
      mealType,
      // Zero is not a portion, so an absent or nonsensical quantity becomes one.
      quantity: clamp(readNumber(args, 'quantity'), 1, LIMITS.quantity) || 1,
      unit: (readString(args, 'unit') ?? 'serving').slice(0, 24),
      calories: clampAmount(calories, 0),
      proteinGrams: clampAmount(readNumber(args, 'proteinGrams'), 0),
      carbGrams: clampAmount(readNumber(args, 'carbGrams'), 0),
      fatGrams: clampAmount(readNumber(args, 'fatGrams'), 0),
      consumedAt: timestampFor(consumedOn, context.today),
      consumedOn,
      micronutrients: readMicronutrients(args),
    };

    const entry = await entriesService.createEntry(context.userId, input, 'chat');

    return {
      result: {
        entryId: entry.id,
        foodName: entry.foodName,
        mealType: entry.mealType,
        calories: entry.calories,
        consumedOn: entry.consumedOn,
      },
      action: {
        tool: 'log_meal',
        type: 'meal_created',
        label: `Logged ${entry.foodName} — ${Math.round(entry.calories)} kcal, ${entry.mealType} on ${entry.consumedOn}`,
        entryId: entry.id,
      },
    };
  },
};

const findEntriesTool: ChatTool = {
  definition: {
    type: 'function',
    function: {
      name: 'find_entries',
      description:
        'Read entries already in the diary, with totals for the range. Use this before answering anything about what the user ate, and to get an id before changing or deleting an entry.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'First day, YYYY-MM-DD. Defaults to today.' },
          to: { type: 'string', description: 'Last day, YYYY-MM-DD. Defaults to today.' },
          mealType: { type: 'string', enum: MEAL_TYPES },
          search: { type: 'string', description: 'Match on food name.' },
          limit: { type: 'number', description: `1 to ${MAX_ENTRY_RESULTS}. Defaults to ${DEFAULT_ENTRY_RESULTS}.` },
        },
      },
    },
  },
  async handle(args, context) {
    const to = readDateKey(args, 'to') ?? context.today;
    const from = readDateKey(args, 'from') ?? to;
    const limit = Math.min(Math.max(Math.round(readNumber(args, 'limit') ?? DEFAULT_ENTRY_RESULTS), 1), MAX_ENTRY_RESULTS);

    const { data, meta, totals } = await entriesService.listEntries(context.userId, {
      from: fromDateKey(from),
      to: fromDateKey(to),
      mealType: readMealType(args, 'mealType'),
      search: readString(args, 'search'),
      sort: 'consumedAt',
      order: 'desc',
      page: 1,
      pageSize: limit,
    });

    return {
      // Trimmed to the fields an answer needs: the full DTO would spend tokens
      // on timestamps and micronutrients that no reply ever quotes.
      result: {
        range: { from, to },
        matched: meta.totalItems,
        showing: data.length,
        totals,
        entries: data.map((entry) => ({
          entryId: entry.id,
          foodName: entry.foodName,
          mealType: entry.mealType,
          quantity: entry.quantity,
          unit: entry.unit,
          calories: entry.calories,
          consumedOn: entry.consumedOn,
        })),
      },
    };
  },
};

const updateEntryTool: ChatTool = {
  definition: {
    type: 'function',
    function: {
      name: 'update_entry',
      description:
        'Correct an entry that already exists. Prefer entryId from find_entries. If the user pointed at a meal by day or name instead, pass those filters and omit entryId — do not guess an id.',
      parameters: {
        type: 'object',
        properties: {
          entryId: { type: 'string' },
          from: { type: 'string', description: 'First day to search, YYYY-MM-DD.' },
          to: { type: 'string', description: 'Last day to search, YYYY-MM-DD.' },
          search: { type: 'string', description: 'Food name to match when entryId is unknown.' },
          foodName: { type: 'string' },
          mealType: { type: 'string', enum: MEAL_TYPES },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          calories: { type: 'number' },
          proteinGrams: { type: 'number' },
          carbGrams: { type: 'number' },
          fatGrams: { type: 'number' },
          consumedOn: { type: 'string', description: 'Move the entry to this day, YYYY-MM-DD.' },
        },
      },
    },
  },
  async handle(args, context) {
    const resolved = await resolveTarget(args, context, 'change');

    if (resolved.pending) {
      return { result: resolved.result, pending: resolved.pending };
    }

    const entryId = resolved.entryId;
    const consumedOn = readDateKey(args, 'consumedOn');

    const changes: UpdateEntryInput = {
      ...optional('foodName', readString(args, 'foodName')?.slice(0, 160)),
      ...optional('mealType', readMealType(args, 'mealType')),
      ...optional('quantity', amountOrUndefined(readNumber(args, 'quantity'), LIMITS.quantity)),
      ...optional('unit', readString(args, 'unit')?.slice(0, 24)),
      ...optional('calories', amountOrUndefined(readNumber(args, 'calories'))),
      ...optional('proteinGrams', amountOrUndefined(readNumber(args, 'proteinGrams'))),
      ...optional('carbGrams', amountOrUndefined(readNumber(args, 'carbGrams'))),
      ...optional('fatGrams', amountOrUndefined(readNumber(args, 'fatGrams'))),
      ...optional('consumedOn', consumedOn),
      // Moving an entry to another day moves its timestamp too, so it keeps its
      // place in a list ordered by when it was eaten.
      ...optional('consumedAt', consumedOn ? timestampFor(consumedOn, context.today) : undefined),
    };

    if (Object.keys(changes).length === 0) {
      throw badRequest('Provide at least one field to change.');
    }

    if (!entryId) {
      throw badRequest('entryId is required. Use find_entries to look it up.');
    }

    const entry = await entriesService.updateEntry(context.userId, entryId, changes);

    return {
      result: {
        entryId: entry.id,
        foodName: entry.foodName,
        mealType: entry.mealType,
        calories: entry.calories,
        consumedOn: entry.consumedOn,
      },
      action: {
        tool: 'update_entry',
        type: 'meal_updated',
        label: `Updated ${entry.foodName} — ${Math.round(entry.calories)} kcal, ${entry.mealType} on ${entry.consumedOn}`,
        entryId: entry.id,
      },
    };
  },
};

const deleteEntryTool: ChatTool = {
  definition: {
    type: 'function',
    function: {
      name: 'delete_entry',
      description:
        'Remove one entry, or several when deleteAll is true. Prefer filters over guessing an id. If several meals match and deleteAll is false, the app will ask the user which one. deleteAll requires confirmAll on a later turn.',
      parameters: {
        type: 'object',
        properties: {
          entryId: { type: 'string' },
          from: { type: 'string', description: 'First day, YYYY-MM-DD.' },
          to: { type: 'string', description: 'Last day, YYYY-MM-DD.' },
          mealType: { type: 'string', enum: MEAL_TYPES },
          search: { type: 'string' },
          deleteAll: {
            type: 'boolean',
            description: 'True only when the user asked to delete every matching meal.',
          },
          confirmAll: {
            type: 'boolean',
            description: 'True only after the user confirmed a bulk delete.',
          },
        },
      },
    },
  },
  async handle(args, context) {
    const deleteAll = args.deleteAll === true;
    const confirmAll = args.confirmAll === true;
    const resolved = await resolveTarget(args, context, deleteAll ? 'delete_all' : 'remove');

    if (resolved.pending) {
      return { result: resolved.result, pending: resolved.pending };
    }

    if (resolved.entries && deleteAll) {
      if (!confirmAll) {
        const pending = createPending('confirm_bulk_delete', 'bulk delete', resolved.entries);
        return {
          result: { needsConfirmation: true, count: resolved.entries.length, candidates: resolved.entries },
          pending,
        };
      }

      const actions: ChatAction[] = [];
      for (const row of resolved.entries) {
        await entriesService.deleteEntry(context.userId, row.entryId);
        actions.push({
          tool: 'delete_entry',
          type: 'meal_deleted',
          label: `Deleted ${row.foodName} from ${row.consumedOn}`,
          entryId: row.entryId,
        });
      }

      return {
        result: { deleted: actions.length },
        action: actions[0],
        actions,
      };
    }

    const entryId = resolved.entryId;

    if (!entryId) {
      throw badRequest('entryId is required. Use find_entries to look it up.');
    }

    const entry = await entriesService.getEntry(context.userId, entryId);
    await entriesService.deleteEntry(context.userId, entryId);

    return {
      result: { deleted: true, foodName: entry.foodName, consumedOn: entry.consumedOn },
      action: {
        tool: 'delete_entry',
        type: 'meal_deleted',
        label: `Deleted ${entry.foodName} from ${entry.consumedOn}`,
        entryId: entry.id,
      },
    };
  },
};

const getGoalTool: ChatTool = {
  definition: {
    type: 'function',
    function: {
      name: 'get_goal',
      description: 'The targets in force on a day. Use before answering anything about goals.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
        },
      },
    },
  },
  async handle(args, context) {
    const date = readDateKey(args, 'date') ?? context.today;
    const goal = await goalsService.getGoalForDate(context.userId, fromDateKey(date));

    return { result: goal ? { date, goal } : { date, goal: null, message: 'No goal has been set.' } };
  },
};

/**
 * Energy split used when a goal is set by calories alone and there is no earlier
 * goal to borrow macros from: 30% protein, 40% carbohydrate, 30% fat. A common
 * balanced starting point, and better than refusing to act or inventing a
 * lopsided split per request.
 */
const DEFAULT_MACRO_SPLIT = { protein: 0.3, carbs: 0.4, fat: 0.3 } as const;

const setGoalTool: ChatTool = {
  definition: {
    type: 'function',
    function: {
      name: 'set_goal',
      description:
        'Set or change the daily targets. Send only the fields that change. Missing macros are carried over from the current goal, or derived from the calorie target.',
      parameters: {
        type: 'object',
        properties: {
          dailyCalories: { type: 'number' },
          proteinGrams: { type: 'number' },
          carbGrams: { type: 'number' },
          fatGrams: { type: 'number' },
          targetWeightKg: { type: 'number' },
          effectiveFrom: {
            type: 'string',
            description: 'YYYY-MM-DD, the day the targets start applying. Defaults to today.',
          },
        },
      },
    },
  },
  async handle(args, context) {
    const dailyCalories = readNumber(args, 'dailyCalories');
    const current = await goalsService.getGoalForDate(context.userId, fromDateKey(context.today));
    const effectiveFrom = readDateKey(args, 'effectiveFrom') ?? context.today;

    if (
      dailyCalories === undefined &&
      readNumber(args, 'proteinGrams') === undefined &&
      readNumber(args, 'carbGrams') === undefined &&
      readNumber(args, 'fatGrams') === undefined &&
      readNumber(args, 'targetWeightKg') === undefined
    ) {
      throw badRequest('Provide at least one target to change.');
    }

    if ((dailyCalories === undefined || dailyCalories <= 0) && !current) {
      throw badRequest('dailyCalories is required when no goal exists yet.');
    }

    const calories = clamp(dailyCalories ?? current?.dailyCalories ?? 0, 0, LIMITS.dailyCalories);

    const goal = await goalsService.setGoal(context.userId, {
      dailyCalories: calories,
      proteinGrams: macroTarget(args, 'proteinGrams', current?.proteinGrams, calories, 'protein'),
      carbGrams: macroTarget(args, 'carbGrams', current?.carbGrams, calories, 'carbs'),
      fatGrams: macroTarget(args, 'fatGrams', current?.fatGrams, calories, 'fat'),
      ...optional(
        'targetWeightKg',
        amountOrUndefined(readNumber(args, 'targetWeightKg'), LIMITS.targetWeightKg),
      ),
      effectiveFrom: fromDateKey(effectiveFrom),
    });

    return {
      result: { goal },
      action: {
        tool: 'set_goal',
        type: 'goals_updated',
        label: `Goal set from ${goal.effectiveFrom} — ${Math.round(goal.dailyCalories)} kcal, ${Math.round(goal.proteinGrams)}g protein, ${Math.round(goal.carbGrams)}g carbs, ${Math.round(goal.fatGrams)}g fat`,
      },
    };
  },
};

const BREAKDOWNS = ['daily', 'weekly', 'macros', 'micronutrients', 'goal_vs_actual'] as const;
type Breakdown = (typeof BREAKDOWNS)[number];

const getSummaryTool: ChatTool = {
  definition: {
    type: 'function',
    function: {
      name: 'get_summary',
      description:
        'Totals over a range, already aggregated. Use "daily" for per-day calories against the goal, "weekly" for week rollups, "macros" for the protein/carb/fat split, "micronutrients" for vitamins and minerals, "goal_vs_actual" for adherence.',
      parameters: {
        type: 'object',
        required: ['breakdown'],
        properties: {
          breakdown: { type: 'string', enum: BREAKDOWNS },
          from: {
            type: 'string',
            description: `First day, YYYY-MM-DD. Defaults to today for "daily", otherwise ${SUMMARY_DEFAULT_DAYS} days back.`,
          },
          to: { type: 'string', description: 'Last day, YYYY-MM-DD. Defaults to today.' },
        },
      },
    },
  },
  async handle(args, context) {
    const breakdown = readBreakdown(args);
    const to = readDateKey(args, 'to') ?? context.today;
    const from =
      readDateKey(args, 'from') ??
      (breakdown === 'daily' ? to : toDateKey(addDays(fromDateKey(to), -(SUMMARY_DEFAULT_DAYS - 1))));

    const range = { from: fromDateKey(from), to: fromDateKey(to) };
    const userId = context.userId;

    if (breakdown === 'macros') {
      // The service already reports the range it resolved, so it is not repeated.
      return { result: await reportsService.getMacroBreakdown(userId, { ...range, page: 1, pageSize: 1 }) };
    }

    if (breakdown === 'goal_vs_actual') {
      return { result: await reportsService.getGoalComparison(userId, { ...range, page: 1, pageSize: 1 }) };
    }

    if (breakdown === 'micronutrients') {
      const report = await reportsService.getMicronutrientReport(userId, {
        ...range,
        page: 1,
        pageSize: MAX_MICRONUTRIENT_ROWS,
      });

      return {
        result: {
          range: { from, to },
          days: report.days,
          nutrients: report.data.map((row) => ({
            label: row.label,
            total: row.total,
            averagePerDay: row.averagePerDay,
            unit: row.unit,
          })),
        },
      };
    }

    if (breakdown === 'weekly') {
      const report = await reportsService.getWeeklyReport(userId, {
        ...range,
        page: 1,
        pageSize: MAX_WEEKLY_ROWS,
      });

      return {
        result: {
          range: { from, to },
          weeks: report.data.map((row) => ({
            weekStart: row.weekStart,
            weekEnd: row.weekEnd,
            calories: row.calories,
            averageDailyCalories: row.averageDailyCalories,
            proteinGrams: row.proteinGrams,
            carbGrams: row.carbGrams,
            fatGrams: row.fatGrams,
            daysLogged: row.daysLogged,
          })),
        },
      };
    }

    const report = await reportsService.getDailyReport(userId, {
      ...range,
      page: 1,
      pageSize: MAX_DAILY_ROWS,
    });

    return {
      result: {
        range: { from, to },
        // Days beyond the cap are dropped rather than paged through, and the model
        // is told so it can say the answer covers part of the range.
        truncatedTo: report.meta.totalItems > MAX_DAILY_ROWS ? MAX_DAILY_ROWS : undefined,
        days: report.data.map((row) => ({
          date: row.date,
          calories: row.calories,
          proteinGrams: row.proteinGrams,
          carbGrams: row.carbGrams,
          fatGrams: row.fatGrams,
          entryCount: row.entryCount,
          goalCalories: row.goal?.dailyCalories ?? null,
          caloriesRemaining: row.caloriesRemaining,
        })),
      },
    };
  },
};

const getRemainingTool: ChatTool = {
  definition: {
    type: 'function',
    function: {
      name: 'get_remaining',
      description:
        'Calories and macros eaten today (or another day) against the goal, plus what is left. Use before saying whether the user is on track or what they should eat next.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
        },
      },
    },
  },
  async handle(args, context) {
    const date = readDateKey(args, 'date') ?? context.today;
    return { result: await getRemainingNutrition(context.userId, date) };
  },
};

const getWeightTool: ChatTool = {
  definition: {
    type: 'function',
    function: {
      name: 'get_weight',
      description:
        'Latest weigh-in, the one before it, and the last few readings. Use before talking about weight, a cut, or a gym plan.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  async handle(_args, context) {
    const [summary, goal] = await Promise.all([
      weightsService.summarize(context.userId, 8),
      goalsService.getGoalForDate(context.userId, fromDateKey(context.today)),
    ]);

    return {
      result: {
        latest: summary.latest,
        previous: summary.previous,
        recent: summary.recent,
        targetWeightKg: goal?.targetWeightKg ?? null,
      },
    };
  },
};

const generateReportPdfTool: ChatTool = {
  definition: {
    type: 'function',
    function: {
      name: 'generate_report_pdf',
      description:
        'Build the downloadable nutrition PDF for a date range. Use this when they ask for a report, a PDF, last week, this month, or any custom window. If they name no dates, omit from/to and period so the previous ISO week is used.',
      parameters: {
        type: 'object',
        properties: {
          from: {
            type: 'string',
            description: 'First day YYYY-MM-DD. Wins over period when both are set.',
          },
          to: {
            type: 'string',
            description: 'Last day YYYY-MM-DD. Wins over period when both are set.',
          },
          period: {
            type: 'string',
            enum: ['last_week', 'this_week', 'last_7_days', 'this_month', 'last_month'],
            description:
              'Used when from/to are omitted. last_week is the previous Monday–Sunday. last_7_days is today and the six days before.',
          },
        },
      },
    },
  },
  async handle(args, context) {
    const window = resolveReportWindow({
      today: context.today,
      from: readDateKey(args, 'from'),
      to: readDateKey(args, 'to'),
      period: readString(args, 'period'),
    });

    const { buffer, filename } = await reportPdfService.buildReportPdf(context.userId, {
      from: fromDateKey(window.from),
      to: fromDateKey(window.to),
      page: 1,
      pageSize: 100,
    });

    return {
      result: {
        ready: true,
        from: window.from,
        to: window.to,
        filename,
        bytes: buffer.length,
      },
      action: {
        tool: 'generate_report_pdf',
        type: 'report_ready',
        label: `PDF ready — ${window.from} to ${window.to}`,
        from: window.from,
        to: window.to,
        filename,
      },
      download: { filename, buffer },
    };
  },
};

const recommendMealTool: ChatTool = {
  definition: {
    type: 'function',
    function: {
      name: 'recommend_meal',
      description:
        'Suggest foods that fit the remaining calorie and protein budget. Always call get_remaining first, or this tool will compute remaining itself.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD. Defaults to today.' },
        },
      },
    },
  },
  async handle(args, context) {
    const date = readDateKey(args, 'date') ?? context.today;
    return { result: await recommendFoods(context.userId, date) };
  },
};

const CHAT_TOOLS: Record<string, ChatTool> = {
  log_meal: logMealTool,
  find_entries: findEntriesTool,
  update_entry: updateEntryTool,
  delete_entry: deleteEntryTool,
  get_goal: getGoalTool,
  set_goal: setGoalTool,
  get_summary: getSummaryTool,
  get_remaining: getRemainingTool,
  get_weight: getWeightTool,
  generate_report_pdf: generateReportPdfTool,
  recommend_meal: recommendMealTool,
};

async function resolveTarget(
  args: Record<string, unknown>,
  context: ToolContext,
  verb: 'change' | 'remove' | 'delete_all',
): Promise<{ entryId?: string; entries?: EntryRef[]; pending?: PendingAction; result?: unknown }> {
  const entryId = readString(args, 'entryId');

  if (entryId) {
    return { entryId };
  }

  const from = readDateKey(args, 'from') ?? context.today;
  const to = readDateKey(args, 'to') ?? from;
  const entries = await loadEntries(context.userId, {
    from,
    to,
    mealType: readMealType(args, 'mealType'),
    search: readString(args, 'search'),
    calories: readNumber(args, 'calories'),
  });

  if (verb === 'delete_all') {
    if (entries.length === 0) {
      throw badRequest('No meals in that range to delete.');
    }

    return { entries };
  }

  const resolved = resolveAmong(entries, {
    mealType: readMealType(args, 'mealType'),
    search: readString(args, 'search'),
    calories: readNumber(args, 'calories'),
  });

  if (resolved.status === 'none') {
    throw badRequest('No matching meal was found.');
  }

  if (resolved.status === 'one') {
    return { entryId: resolved.entry.entryId };
  }

  const pending = createPending(
    verb === 'change' ? 'choose_update' : 'choose_delete',
    verb,
    resolved.entries,
    verb === 'change'
      ? {
          foodName: readString(args, 'foodName'),
          mealType: readMealType(args, 'mealType'),
          quantity: readNumber(args, 'quantity'),
          unit: readString(args, 'unit'),
          calories: readNumber(args, 'calories'),
          proteinGrams: readNumber(args, 'proteinGrams'),
          carbGrams: readNumber(args, 'carbGrams'),
          fatGrams: readNumber(args, 'fatGrams'),
        }
      : undefined,
  );

  return {
    pending,
    result: { needsChoice: true, candidates: resolved.entries, prompt: describePending(pending) },
  };
}

/** Derived from the same table the handlers live in, so the two cannot drift apart. */
export const CHAT_TOOL_DEFINITIONS: ToolDefinition[] = Object.values(CHAT_TOOLS).map(
  (tool) => tool.definition,
);

/**
 * Runs one tool call and always produces a result the conversation can continue
 * from. A failure is reported back to the model as data rather than thrown,
 * because the model is the only party that can recover: told the entry id was
 * wrong, it looks the entry up and tries again, where an exception would end the
 * turn with a blank reply.
 */
export async function runTool(
  name: string,
  rawArguments: string,
  context: ToolContext,
): Promise<ToolOutcome> {
  const tool = CHAT_TOOLS[name];

  if (!tool) {
    return { result: { error: `Unknown tool "${name}".` } };
  }

  try {
    return await tool.handle(parseArguments(rawArguments), context);
  } catch (error) {
    if (error instanceof AppError) {
      return { result: { error: error.message } };
    }

    console.error(`Chat tool ${name} failed:`, error);
    return { result: { error: 'That action could not be completed.' } };
  }
}

function parseArguments(raw: string): Record<string, unknown> {
  if (!raw) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    // A malformed argument string reads as "no arguments given", and the required
    // -field checks in each handler turn that into a message the model can act on.
    return {};
  }
}

/**
 * Noon on the day itself for a backdated entry, and the current instant for
 * today. Noon is far enough from either midnight that the stored timestamp
 * cannot read as the neighbouring day in any time zone.
 */
function timestampFor(consumedOn: string, today: string): Date {
  return consumedOn === today ? new Date() : new Date(`${consumedOn}T12:00:00.000Z`);
}

function macroTarget(
  args: Record<string, unknown>,
  key: string,
  carriedOver: number | undefined,
  calories: number,
  macro: keyof typeof DEFAULT_MACRO_SPLIT,
): number {
  const given = amountOrUndefined(readNumber(args, key), LIMITS.macroTarget);

  if (given !== undefined) {
    return given;
  }

  if (carriedOver !== undefined) {
    return carriedOver;
  }

  return Math.min(
    Math.round((calories * DEFAULT_MACRO_SPLIT[macro]) / CALORIES_PER_GRAM[macro]),
    LIMITS.macroTarget,
  );
}

function readMicronutrients(args: Record<string, unknown>): CreateEntryInput['micronutrients'] {
  const raw = args.micronutrients;

  if (!Array.isArray(raw)) {
    return [];
  }

  const byKey = new Map<string, { nutrient: string; amount: number }>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const entry = item as Record<string, unknown>;
    const nutrient = readString(entry, 'nutrient')?.toLowerCase();

    // Unknown keys are dropped: the schema pins the model to a known list, so
    // anything else is invented and would pollute the micronutrient report.
    if (!nutrient || !isKnownMicronutrient(nutrient)) {
      continue;
    }

    byKey.set(nutrient, { nutrient, amount: clampAmount(readNumber(entry, 'amount'), 0) });
  }

  return [...byKey.values()].slice(0, MAX_MICRONUTRIENTS);
}

/** Spreads into an object only when the value is present, keeping patches sparse. */
function optional<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Partial<Record<K, V>>);
}

const clamp = (value: number | undefined, fallback: number, max: number): number =>
  Math.min(Math.max(value ?? fallback, 0), max);

const clampAmount = (value: number | undefined, fallback: number): number =>
  clamp(value, fallback, LIMITS.amount);

/** For patch fields, where absent and zero mean different things. */
const amountOrUndefined = (
  value: number | undefined,
  max: number = LIMITS.amount,
): number | undefined => (value === undefined ? undefined : clamp(value, 0, max));

function readString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];

  // Numbers are accepted because a model will happily answer a string field with
  // one, and rejecting that would fail a call that is otherwise fine.
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function readMealType(args: Record<string, unknown>, key: string): MealType | undefined {
  const value = readString(args, key)?.toLowerCase();

  return value && (MEAL_TYPES as readonly string[]).includes(value) ? (value as MealType) : undefined;
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Accepts a date key, and tolerates a full ISO timestamp by taking its date. */
function readDateKey(args: Record<string, unknown>, key: string): string | undefined {
  const candidate = readString(args, key)?.slice(0, 10);

  if (!candidate || !DATE_KEY_PATTERN.test(candidate)) {
    return undefined;
  }

  return Number.isNaN(Date.parse(candidate)) ? undefined : candidate;
}

function readBreakdown(args: Record<string, unknown>): Breakdown {
  const value = readString(args, 'breakdown')?.toLowerCase();

  if (!value || !(BREAKDOWNS as readonly string[]).includes(value)) {
    throw badRequest(`breakdown must be one of: ${BREAKDOWNS.join(', ')}.`);
  }

  return value as Breakdown;
}
