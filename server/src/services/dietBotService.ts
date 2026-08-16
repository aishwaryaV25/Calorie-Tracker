import type { ChatMessage } from '../lib/ai-client.js';
import { createChatCompletion } from '../lib/gemini-client.js';
import { fromDateKey, toDateKey } from '../lib/dates.js';
import { prisma } from '../lib/prisma.js';
import type { DietBotRequestInput } from '../types/dto.js';
import { getRemainingNutrition } from './chatRecommend.js';
import {
  CHAT_TOOL_DEFINITIONS,
  runTool,
  type ToolContext,
} from './chatTools.js';
import * as entriesService from './entriesService.js';

/**
 * The floating companion. It talks; it does not write the diary. Chat Support
 * on /chat is the agent that logs and edits. This one is for diet ideas, "how
 * do I use this page?", and ordinary conversation.
 */

export interface DietBotReply {
  reply: string;
  conversationId: string;
}

/** Read-only tools. A write name is rejected by `runTool` as unknown. */
export const DIET_BOT_TOOL_NAMES = [
  'get_remaining',
  'get_goal',
  'get_summary',
  'recommend_meal',
  'find_entries',
] as const;

export const DIET_BOT_TOOL_DEFINITIONS = CHAT_TOOL_DEFINITIONS.filter((tool) =>
  (DIET_BOT_TOOL_NAMES as readonly string[]).includes(tool.function.name),
);

const MAX_TOOL_ROUNDS = 2;
const MAX_REPLY_TOKENS = 900;
const TEMPERATURE = 0.75;
const HISTORY_LIMIT = 16;

const PAGE_HELP: Record<string, string> = {
  '/dashboard':
    'Today — the home screen. Totals for the day against the current goal, and a quick look at what has been logged.',
  '/log':
    'Log Meal — add one meal at a time. They can type it, or attach a photo of a plate or label. One diary row per meal; plate items the AI spots are a draft until they save.',
  '/goals':
    'Goals — daily calorie and macro targets. Saving for today replaces that version; a new date starts a new version so history stays honest.',
  '/entries':
    'Entries — the full diary table. Filter by day or meal, edit a row, or delete it. This is the place to fix a number.',
  '/reports':
    'Reports — trends, macros, micronutrients, and a PDF they can download. Pick a date range first.',
  '/chat':
    'Chat Support — the diary agent. It can log meals, change or delete entries, and read a photo or PDF. Bite cannot do those writes; send them there (or to Log Meal) when they want something saved.',
  '/import':
    'Bulk import — upload a PDF food diary. The first pass is a script parse; Deep Analyse uses Gemini. They review the table, then commit.',
};

export function describeAppPage(page?: string): string {
  if (!page) {
    return 'Page unknown — answer generally, or ask which screen they are on.';
  }

  const path = page.split('?')[0]?.replace(/\/+$/, '') || '/';
  return PAGE_HELP[path] ?? `They are on ${path}. If you are unsure what that screen does, say so and point them to Today, Log Meal, Goals, Entries, Reports, Chat Support or Bulk import.`;
}

export function buildDietBotPrompt(input: {
  today: string;
  firstName: string;
  page?: string;
  snapshot: string;
}): string {
  const who = input.firstName
    ? `The person you are talking to is ${input.firstName}. You already know that — if they ask, say it. Use the name the way a friend would: now and then, not every sentence.`
    : `They have not set a display name. Do not invent one.`;

  return `You are Bite, the diet buddy inside this calorie tracker. You live in a small floating chat on every page. ${who} Today is ${input.today}.

They are currently on: ${describeAppPage(input.page)}

WHAT YOU ARE
A sharp, warm person who happens to know food. You talk the way a good friend talks — contractions, plain words, the odd bit of humour, never a lecture. You notice how they feel, not just what they ate. You can shoot the breeze: a rough day, a craving, a recipe they miss from home. Then you can steer back to food if it helps.

WHAT YOU ARE NOT
- A doctor, dietitian, or therapist. No diagnoses, no "you should cut X for your condition" unless they already said a clinician told them that. For medical questions, say you are not qualified and keep the advice general.
- The diary agent. You cannot log, edit, delete or set goals. If they want that, send them to Log Meal, Entries, Goals, or Chat Support. Never pretend you saved something.

DIET
Use the live snapshot below as the source of truth. Do not invent today's numbers. Suggest the next meal from what is left, their taste, and what they already ate. Portions in kitchen language (a palm of chicken, a bowl of dal). If they have no goal yet, help them pick a sensible starting target and point them to Goals.

HOW THE APP WORKS
- Today: daily totals vs the goal.
- Log Meal: one meal at a time; photo optional.
- Goals: versioned by date; same-day save replaces that version.
- Entries: the table — edit and delete live here.
- Reports: charts and a downloadable PDF.
- Chat Support: the agent that can change the diary.
- Bulk import: PDF diary in, review, commit.

VOICE
Write like a person in a chat bubble, not a brochure. One short beat, then the useful bit. A question at the end only when you actually want an answer. No markdown tables. No bullet walls unless they asked for a list. Round kcal and grams to whole numbers.

LIVE DIARY
${input.snapshot}`;
}

export function formatDietSnapshot(input: {
  remaining: Awaited<ReturnType<typeof getRemainingNutrition>>;
  meals: { foodName: string; mealType: string; calories: number }[];
}): string {
  const { remaining, meals } = input;
  const mealLines =
    meals.length === 0
      ? 'Nothing logged today yet.'
      : meals
          .map((meal) => `- ${meal.mealType}: ${meal.foodName} (${Math.round(meal.calories)} kcal)`)
          .join('\n');

  if (!remaining.hasGoal || !remaining.target) {
    return `No daily goal is set.\nEaten today: ${Math.round(remaining.eaten.calories)} kcal.\nMeals:\n${mealLines}`;
  }

  return [
    `Goal: ${Math.round(remaining.target.calories)} kcal · ${Math.round(remaining.target.proteinGrams)}g protein · ${Math.round(remaining.target.carbGrams)}g carbs · ${Math.round(remaining.target.fatGrams)}g fat.`,
    `Eaten: ${Math.round(remaining.eaten.calories)} kcal · ${Math.round(remaining.eaten.proteinGrams)}g P · ${Math.round(remaining.eaten.carbGrams)}g C · ${Math.round(remaining.eaten.fatGrams)}g F.`,
    `Left: ${Math.round(remaining.remaining.calories)} kcal · ${Math.round(remaining.remaining.proteinGrams)}g P · ${Math.round(remaining.remaining.carbGrams)}g C · ${Math.round(remaining.remaining.fatGrams)}g F.`,
    `Meals:\n${mealLines}`,
  ].join('\n');
}

export async function respond(userId: string, input: DietBotRequestInput): Promise<DietBotReply> {
  const conversationId = input.conversationId?.trim() || crypto.randomUUID();
  const today = input.today ?? toDateKey(new Date());
  const started = Date.now();

  const [profile, remaining, day] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } }),
    getRemainingNutrition(userId, today),
    entriesService.listEntries(userId, {
      from: fromDateKey(today),
      to: fromDateKey(today),
      sort: 'consumedAt',
      order: 'asc',
      page: 1,
      pageSize: 20,
    }),
  ]);

  const firstName = firstNameOf(profile?.displayName ?? '');
  const snapshot = formatDietSnapshot({
    remaining,
    meals: day.data.map((entry) => ({
      foodName: entry.foodName,
      mealType: entry.mealType,
      calories: entry.calories,
    })),
  });

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: buildDietBotPrompt({ today, firstName, page: input.page, snapshot }),
    },
    ...input.messages.slice(-HISTORY_LIMIT).map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
  ];

  const context: ToolContext = { userId, today };
  let reply = FALLBACK_REPLY;

  try {
    reply = await runTurn(messages, context);
  } catch (error) {
    console.error('Diet bot turn failed:', error);
    throw error;
  } finally {
    console.info(
      JSON.stringify({
        event: 'dietbot.turn',
        conversationId,
        page: input.page ?? null,
        ms: Date.now() - started,
      }),
    );
  }

  return { reply, conversationId };
}

async function runTurn(messages: ChatMessage[], context: ToolContext): Promise<string> {
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const completion = await createChatCompletion({
      messages,
      tools: DIET_BOT_TOOL_DEFINITIONS,
      temperature: TEMPERATURE,
      maxTokens: MAX_REPLY_TOKENS,
      rejectionMessage: REJECTION_MESSAGE,
    });

    if (completion.toolCalls.length === 0) {
      return orFallback(completion.content);
    }

    messages.push({
      role: 'assistant',
      content: completion.content,
      tool_calls: completion.toolCalls,
    });

    for (const call of completion.toolCalls) {
      const allowed = (DIET_BOT_TOOL_NAMES as readonly string[]).includes(call.function.name);
      const outcome = allowed
        ? await runTool(call.function.name, call.function.arguments, context)
        : { result: { error: 'Bite cannot change the diary. Point them to Log Meal or Chat Support.' } };

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(outcome.result),
      });
    }
  }

  const last = await createChatCompletion({
    messages: [
      ...messages,
      {
        role: 'system',
        content: 'Answer now in plain prose. Do not call tools.',
      },
    ],
    temperature: TEMPERATURE,
    maxTokens: MAX_REPLY_TOKENS,
    rejectionMessage: REJECTION_MESSAGE,
  });

  return orFallback(last.content);
}

function firstNameOf(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? '';
}

const orFallback = (content: string | null): string => content?.trim() || FALLBACK_REPLY;

const FALLBACK_REPLY = "I lost the thread for a second. Say that again?";
const REJECTION_MESSAGE = "I couldn't catch that. Try it in a different way?";
