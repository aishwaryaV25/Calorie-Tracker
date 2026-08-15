import { config } from '../config.js';
import { MEAL_TYPES } from '../domain/nutrition.js';
import { createCompletion, type ChatMessage } from '../lib/ai-client.js';
import { toDateKey } from '../lib/dates.js';
import type { ChatRequestInput } from '../types/dto.js';
import {
  CHAT_TOOL_DEFINITIONS,
  runTool,
  type ChatAction,
  type ToolContext,
  type ToolOutcome,
} from './chatTools.js';

/**
 * The conversational interface. Anything the app can do through its pages can be
 * done here in words, because the tools in `chatTools` are adapters over the very
 * same services the routes use.
 *
 * The transcript is not persisted. The client holds it and sends it back each
 * turn, which keeps the endpoint stateless and adds no schema; the trade-off,
 * documented in the README, is that a page reload starts a new conversation.
 */

export interface ChatReply {
  reply: string;
  /** Writes made during the turn, so the UI can show them and refresh its data. */
  actions: ChatAction[];
}

/**
 * How many times the model may call tools before it has to answer.
 *
 * Three covers the longest sensible chain — find an entry, change it, read the
 * day back — while keeping the worst case to a handful of provider round trips.
 */
const MAX_TOOL_ROUNDS = 3;

/** A runaway model cannot write more than this many rows in a single turn. */
const MAX_TOOL_CALLS = 8;

/**
 * Generous for a three-sentence answer because a reasoning model spends this
 * budget thinking before it writes. Set to 600 the model could exhaust the cap
 * deliberating over a two-item meal and return nothing at all — no reply and no
 * tool call — which looked exactly like a broken feature.
 */
const MAX_REPLY_TOKENS = 1_500;

/**
 * Warmer than the extraction prompt, which wants the same numbers every time, but
 * still low: this assistant reports figures rather than writing prose.
 */
const TEMPERATURE = 0.3;

function systemPrompt(today: string): string {
  return `You are the assistant inside a personal calorie tracker, working on the signed-in user's own food diary through the tools provided. Today is ${today}.

Only a tool call changes anything. Never say you logged, changed, deleted or set something unless a tool returned it.

LOGGING
- Estimate the calories and macros yourself from the food and portion described. Never ask the user for numbers; ask only when you cannot tell what was eaten or roughly how much.
- One log_meal call per food: "toast and coffee" is two calls.
- mealType is one of ${MEAL_TYPES.join(', ')}; infer it from the food or the time when unsaid. Work out dates against today and pass consumedOn as YYYY-MM-DD.

CHANGING
- Call find_entries first for the entryId, and never invent one. If several entries match, ask which one.

ANSWERING
- About this user's food, goals or progress: read the real numbers with a tool first, never from memory. General nutrition questions need no tool.
- If a tool returns an error, say what went wrong in plain words and do not repeat the same call.

STYLE: plain prose, three sentences at most, no markdown or tables. Round to whole kcal and grams. After a write, say what was saved.`;
}

/**
 * Runs one turn of the conversation to completion, including any tool calls the
 * model makes along the way.
 */
export async function respond(userId: string, input: ChatRequestInput): Promise<ChatReply> {
  // Collected here rather than inside the loop so that a provider failure part of
  // the way through a turn can still report what was already written.
  const actions: ChatAction[] = [];

  try {
    return await runTurn(userId, input, actions);
  } catch (error) {
    if (actions.length === 0) {
      throw error;
    }

    // The writes are committed and the user has to be told, even though the
    // sentence describing them never arrived.
    return { reply: describeActions(actions), actions };
  }
}

async function runTurn(
  userId: string,
  input: ChatRequestInput,
  actions: ChatAction[],
): Promise<ChatReply> {
  const context: ToolContext = { userId, today: input.today ?? toDateKey(new Date()) };

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(context.today) },
    ...input.messages.map((turn) => ({ role: turn.role, content: turn.content })),
  ];

  let callsMade = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const completion = await createCompletion({
      messages,
      model: config.ai.chatModel,
      tools: CHAT_TOOL_DEFINITIONS,
      temperature: TEMPERATURE,
      maxTokens: MAX_REPLY_TOKENS,
      rejectionMessage: REJECTION_MESSAGE,
    });

    if (completion.toolCalls.length === 0) {
      return { reply: orFallback(completion.content), actions };
    }

    // The assistant's own turn has to go back verbatim, tool calls included: a
    // tool result with no matching call is rejected by the provider.
    messages.push({
      role: 'assistant',
      content: completion.content,
      tool_calls: completion.toolCalls,
    });

    for (const call of completion.toolCalls) {
      const outcome: ToolOutcome =
        callsMade >= MAX_TOOL_CALLS
          ? { result: { error: 'Too many actions in one turn. Answer with what you have.' } }
          : await runTool(call.function.name, call.function.arguments, context);

      callsMade += 1;

      if (outcome.action) {
        actions.push(outcome.action);
      }

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(outcome.result),
      });
    }
  }

  return { reply: await forceAnswer(messages), actions };
}

/**
 * Asked for a reply once the tool rounds are used up. Tools are withheld from this
 * call, so the model has to answer from what it already gathered rather than
 * looping further.
 */
async function forceAnswer(messages: ChatMessage[]): Promise<string> {
  const completion = await createCompletion({
    messages: [
      ...messages,
      {
        role: 'system',
        content: 'Answer the user now, in plain prose, using only what the tools have already returned.',
      },
    ],
    model: config.ai.chatModel,
    temperature: TEMPERATURE,
    maxTokens: MAX_REPLY_TOKENS,
    rejectionMessage: REJECTION_MESSAGE,
  });

  return orFallback(completion.content);
}

/**
 * Never lets an empty reply out.
 *
 * Beyond the blank bubble it would put on screen, the client keeps the transcript
 * and sends it back next turn, where a message with no content is rejected — so
 * one empty reply would otherwise break the rest of the conversation.
 */
const orFallback = (content: string | null): string => content?.trim() || FALLBACK_REPLY;

/** Stands in for the model's own words when it never got to write them. */
function describeActions(actions: ChatAction[]): string {
  const done = actions.map((action) => action.label).join('. ');

  return `${done}. The assistant could not finish its reply because the AI service is busy, but those changes were saved.`;
}

/** Shown when the model returns an empty message, which a reasoning model can do. */
const FALLBACK_REPLY = "I couldn't put together an answer for that. Try rephrasing it.";

/**
 * Shown when the provider refuses the request. On this path that means the model
 * produced something invalid — a tool call it could not express as JSON — and one
 * retry has already been spent, so the user's best move is to say it differently.
 */
const REJECTION_MESSAGE = "I couldn't act on that. Try rephrasing it, or say it in smaller steps.";
