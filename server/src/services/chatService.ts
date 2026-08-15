import { MEAL_TYPES } from '../domain/nutrition.js';
import type { ChatMessage } from '../lib/ai-client.js';
import { createChatCompletion } from '../lib/gemini-client.js';
import { toDateKey } from '../lib/dates.js';
import { prisma } from '../lib/prisma.js';
import type { ChatRequestInput } from '../types/dto.js';
import {
  applyAttachPending,
  interpretAttachMessage,
  isAttachPending,
  previewAttachment,
} from './chatAttach.js';
import {
  applyPending,
  describePending,
  isPendingExpired,
  looksLikePendingReply,
  type PendingAction,
  type PendingChoice,
} from './chatPending.js';
import {
  CHAT_TOOL_DEFINITIONS,
  runTool,
  type ChatAction,
  type ToolContext,
  type ToolOutcome,
} from './chatTools.js';

export interface ChatAttachment {
  buffer: Buffer;
  mimeType: string;
}

/**
 * The conversational interface. Anything the app can do through its pages can be
 * done here in words, because the tools in `chatTools` are adapters over the very
 * same services the routes use.
 *
 * Pending choices are echoed by the client rather than stored in the database, so
 * a reload still starts a new conversation, but "which lunch?" does not depend
 * on the model remembering the candidate list.
 */

export interface ChatReply {
  reply: string;
  actions: ChatAction[];
  conversationId: string;
  pendingAction: PendingAction | null;
}

/**
 * How many times the model may call tools before it has to answer.
 *
 * Three covers the longest sensible chain — find an entry, change it, read the
 * day back — while keeping the worst case to a handful of provider round trips.
 */
const MAX_TOOL_ROUNDS = 5;

/** A runaway model cannot write more than this many rows in a single turn. */
const MAX_TOOL_CALLS = 8;

/** A short paragraph plus one tool-call payload. Thinking is pinned to minimal. */
const MAX_REPLY_TOKENS = 800;

/**
 * Warmer than the extraction prompt, which wants the same numbers every time, but
 * still low: this assistant reports figures rather than writing prose.
 */
const TEMPERATURE = 0.5;

function firstNameOf(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? '';
}

function systemPrompt(today: string, firstName: string): string {
  const who = firstName
    ? `The person you are helping is ${firstName}. That is the name on their account — you already know it. If they ask whether you know their name, say it plainly.`
    : `The signed-in user did not set a display name. Do not invent one.`;

  return `You are the nutrition assistant in this calorie tracker. ${who} Today is ${today}.

You act through the tools provided. Only a tool call changes the diary. Never say you logged, changed, deleted or set something unless a tool returned it.

LOGGING
- Estimate calories and macros from the food and portion. Do not ask for numbers unless you cannot tell what was eaten or roughly how much.
- One log_meal call per food: "toast and coffee" is two calls.
- mealType is one of ${MEAL_TYPES.join(', ')}; infer it from the food or the time when unsaid. Resolve dates against today and pass consumedOn as YYYY-MM-DD.

CHANGING
- Never invent an entryId. To change or delete a meal they pointed at by day or name, call update_entry or delete_entry with from/to/search/mealType and omit entryId. If several match, the tool asks them — do not pick one yourself.
- deleteAll is only for "delete everything / all meals". The tool will ask for confirmation; do not set confirmAll until they have said yes.

ANSWERING
- About their food, goals or progress: read the real numbers with a tool first. General nutrition questions need no tool.
- If a tool returns an error, say what went wrong in plain words and do not repeat the same call.

VOICE
Write the way a good product assistant writes: warm, clear, and professional. Not stiff, not slangy. Use their name when it is natural — a greeting or a check-in — not in every sentence. A short paragraph is fine. No markdown tables. Round energy and macros to whole numbers. After a write, say what was saved in ordinary language.`;
}

/**
 * Runs one turn of the conversation to completion, including any tool calls the
 * model makes along the way.
 */
export async function respond(
  userId: string,
  input: ChatRequestInput,
  attachment?: ChatAttachment,
): Promise<ChatReply> {
  const conversationId = input.conversationId?.trim() || crypto.randomUUID();
  const started = Date.now();
  const actions: ChatAction[] = [];
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true },
  });
  const firstName = firstNameOf(profile?.displayName ?? '');

  try {
    const reply = await runTurn(userId, input, actions, conversationId, firstName, attachment);
    logTurn(conversationId, actions, reply.pendingAction, Date.now() - started);
    return reply;
  } catch (error) {
    if (actions.length === 0) {
      throw error;
    }

    const reply = {
      reply: describeActions(actions),
      actions,
      conversationId,
      pendingAction: null,
    };
    logTurn(conversationId, actions, null, Date.now() - started, 'partial');
    return reply;
  }
}

async function runTurn(
  userId: string,
  input: ChatRequestInput,
  actions: ChatAction[],
  conversationId: string,
  firstName: string,
  attachment?: ChatAttachment,
): Promise<ChatReply> {
  const context: ToolContext = { userId, today: input.today ?? toDateKey(new Date()) };
  const lastUser = [...input.messages].reverse().find((turn) => turn.role === 'user')?.content ?? '';
  const pending = asPending(input.pendingAction);

  if (attachment) {
    const previewed = await previewAttachment(attachment.buffer, attachment.mimeType, context.today);
    return {
      reply: previewed.reply,
      actions: [],
      conversationId,
      pendingAction: previewed.pendingAction,
    };
  }

  if (pending && !isPendingExpired(pending) && isAttachPending(pending)) {
    const resolved = await applyAttachPending(
      userId,
      pending,
      lastUser,
      context.today,
      input.choice as PendingChoice | undefined,
    );

    if (!resolved.unhandled) {
      actions.push(...resolved.actions);
      return {
        reply: resolved.reply,
        actions: resolved.actions,
        conversationId,
        pendingAction: resolved.pendingAction,
      };
    }

    const interpreted = await interpretAttachMessage(pending, lastUser, context.today, userId);
    if (!interpreted.unhandled) {
      actions.push(...interpreted.actions);
      return {
        reply: interpreted.reply,
        actions: interpreted.actions,
        conversationId,
        pendingAction: interpreted.pendingAction,
      };
    }

    const aside = await answerAside(input.messages, firstName, context.today);
    return {
      reply: `${aside}\n\nThe draft is still open — say what to change, or tell me to log it.`,
      actions: [],
      conversationId,
      pendingAction: pending,
    };
  }

  if (pending && !isPendingExpired(pending) && (input.choice || looksLikePendingReply(lastUser, pending))) {
    const resolved = await applyPending(userId, pending, lastUser, input.choice as PendingChoice | undefined);
    actions.push(...resolved.actions);
    return {
      reply: resolved.reply,
      actions: resolved.actions,
      conversationId,
      pendingAction: resolved.pendingAction,
    };
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(context.today, firstName) },
    ...input.messages.map((turn) => ({ role: turn.role, content: turn.content })),
  ];

  let callsMade = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const completion = await createChatCompletion({
      messages,
      tools: CHAT_TOOL_DEFINITIONS,
      temperature: TEMPERATURE,
      maxTokens: MAX_REPLY_TOKENS,
      rejectionMessage: REJECTION_MESSAGE,
    });

    if (completion.toolCalls.length === 0) {
      return { reply: orFallback(completion.content), actions, conversationId, pendingAction: null };
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

      if (outcome.actions?.length) {
        actions.push(...outcome.actions);
      } else if (outcome.action) {
        actions.push(outcome.action);
      }

      if (outcome.pending) {
        return {
          reply: describePending(outcome.pending),
          actions,
          conversationId,
          pendingAction: outcome.pending,
        };
      }

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(outcome.result),
      });
    }
  }

  return { reply: await forceAnswer(messages), actions, conversationId, pendingAction: null };
}

/**
 * Asked for a reply once the tool rounds are used up. Tools are withheld from this
 * call, so the model has to answer from what it already gathered rather than
 * looping further.
 */
async function forceAnswer(messages: ChatMessage[]): Promise<string> {
  const completion = await createChatCompletion({
    messages: [
      ...messages,
      {
        role: 'system',
        content: 'Answer the user now, in plain prose, using only what the tools have already returned.',
      },
    ],
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

async function answerAside(messages: ChatRequestInput['messages'], firstName: string, today: string): Promise<string> {
  const completion = await createChatCompletion({
    messages: [
      {
        role: 'system',
        content: `${systemPrompt(today, firstName)}\n\nA photo or PDF draft is open. Answer this side question only. Do not say you logged, changed or imported anything.`,
      },
      ...messages.map((turn) => ({ role: turn.role, content: turn.content })),
    ],
    temperature: TEMPERATURE,
    maxTokens: MAX_REPLY_TOKENS,
    rejectionMessage: REJECTION_MESSAGE,
  });

  return orFallback(completion.content);
}

function asPending(value: unknown): PendingAction | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const pending = value as PendingAction;
  if (!pending.kind || !pending.expiresAt) {
    return null;
  }

  if (!Array.isArray(pending.candidates)) {
    pending.candidates = [];
  }

  return pending;
}

function logTurn(
  conversationId: string,
  actions: ChatAction[],
  pending: PendingAction | null,
  ms: number,
  status = 'ok',
) {
  console.info(
    JSON.stringify({
      event: 'chat.turn',
      conversationId,
      status,
      tools: actions.map((action) => action.tool),
      pending: pending?.kind ?? null,
      ms,
    }),
  );
}
