import type {
  AuthResponse,
  ChatReply,
  ChatTurn,
  CreateEntryPayload,
  CreateGoalPayload,
  DailyReportRow,
  EntriesResponse,
  ExtractionResult,
  FieldError,
  FoodEntry,
  ImportCommitResult,
  ImportDraftRow,
  ImportPreview,
  Goal,
  GoalComparison,
  MacroBreakdown,
  MealType,
  MicronutrientRow,
  Paginated,
  User,
  WeeklyReportRow,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const TOKEN_STORAGE_KEY = 'calorie-tracker.token';

/**
 * Error carrying the API's structured response, so forms can show messages next
 * to the offending field instead of one generic banner.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: FieldError[];

  constructor(status: number, code: string, message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  /** Message for a specific field, if the API rejected that field. */
  fieldError(field: string): string | undefined {
    return this.fieldErrors.find((error) => error.field === field)?.message;
  }
}

export const tokenStorage = {
  get(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  },
  set(token: string): void {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  },
  clear(): void {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  },
};

type QueryValue = string | number | boolean | undefined | null;
type QueryParams = Record<string, QueryValue>;

function buildUrl(path: string, query?: QueryParams): string {
  const url = new URL(`${API_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: QueryParams;
  /** Sent as-is for file uploads; the browser sets the multipart boundary. */
  formData?: FormData;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = tokenStorage.get();
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;

  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : null),
    });
  } catch {
    // A network-level failure has no HTTP status; the most likely cause in
    // development is the API not running, so say that rather than "failed to fetch".
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Is the API running?');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: unknown } })
      ?.error;

    const fieldErrors = Array.isArray(error?.details) ? (error.details as FieldError[]) : [];

    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? 'Something went wrong.',
      fieldErrors,
    );
  }

  return payload as T;
}

export interface DownloadedFile {
  blob: Blob;
  /** The name the API suggested, so the saved file matches what it contains. */
  filename: string;
}

/**
 * A binary response, such as the PDF report.
 *
 * Separate from `request` because a download differs at every step: the body is
 * never JSON, the filename is in a header, and a failure still arrives as JSON
 * and has to be unpicked before it can be reported.
 */
async function requestFile(
  path: string,
  query: QueryParams,
  fallbackName: string,
): Promise<DownloadedFile> {
  const token = tokenStorage.get();
  let response: Response;

  try {
    response = await fetch(buildUrl(path, query), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Is the API running?');
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string; details?: unknown };
    } | null;
    const error = payload?.error;

    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? 'The file could not be generated.',
      Array.isArray(error?.details) ? (error.details as FieldError[]) : [],
    );
  }

  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(disposition);

  return { blob: await response.blob(), filename: match?.[1] ?? fallbackName };
}

/**
 * Filter types carry an index signature so they satisfy the query-string
 * builder, which accepts any bag of scalar values.
 */
export interface EntryFilters extends QueryParams {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  mealType?: MealType | '';
  search?: string;
  sort?: 'consumedAt' | 'calories' | 'createdAt';
  order?: 'asc' | 'desc';
}

export interface ReportRange extends QueryParams {
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export const api = {
  auth: {
    signup: (body: { email: string; password: string; displayName: string }) =>
      request<AuthResponse>('/auth/signup', { method: 'POST', body }),
    login: (body: { email: string; password: string }) =>
      request<AuthResponse>('/auth/login', { method: 'POST', body }),
    me: () => request<{ user: User }>('/auth/me'),
  },

  entries: {
    list: (filters: EntryFilters = {}) => request<EntriesResponse>('/entries', { query: filters }),
    get: (id: string) => request<FoodEntry>(`/entries/${id}`),
    create: (body: CreateEntryPayload) =>
      request<FoodEntry>('/entries', { method: 'POST', body }),
    /**
     * Several foods from one plate. All rows succeed or none do.
     */
    batch: (body: { entries: CreateEntryPayload[]; source?: 'manual' | 'image' }) =>
      request<{ data: FoodEntry[] }>('/entries/batch', { method: 'POST', body }),
    update: (id: string, body: Partial<CreateEntryPayload>) =>
      request<FoodEntry>(`/entries/${id}`, { method: 'PATCH', body }),
    remove: (id: string) => request<void>(`/entries/${id}`, { method: 'DELETE' }),
  },

  goals: {
    /**
     * `date` is the caller's own calendar day. Sent explicitly because the server
     * would otherwise use its UTC day, which is not the day the user is having.
     */
    current: (date: string) => request<{ goal: Goal | null }>('/goals/current', { query: { date } }),
    history: (query: QueryParams = {}) => request<Paginated<Goal>>('/goals', { query }),
    save: (body: CreateGoalPayload) => request<Goal>('/goals', { method: 'POST', body }),
    remove: (id: string) => request<void>(`/goals/${id}`, { method: 'DELETE' }),
  },

  reports: {
    daily: (query: ReportRange) =>
      request<Paginated<DailyReportRow> & { range: { from: string; to: string } }>(
        '/reports/daily',
        { query },
      ),
    weekly: (query: ReportRange) =>
      request<Paginated<WeeklyReportRow> & { range: { from: string; to: string } }>(
        '/reports/weekly',
        { query },
      ),
    macros: (query: ReportRange) => request<MacroBreakdown>('/reports/macros', { query }),
    micronutrients: (query: ReportRange) =>
      request<Paginated<MicronutrientRow> & { days: number }>('/reports/micronutrients', { query }),
    goalComparison: (query: ReportRange) =>
      request<GoalComparison>('/reports/goal-comparison', { query }),
    /** The whole report as a PDF, laid out and named by the server. */
    pdf: (query: ReportRange) => requestFile('/reports/pdf', query, 'calorie-report.pdf'),
  },

  ai: {
    status: () => request<{ available: boolean }>('/ai/status'),
    extract: (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      return request<ExtractionResult>('/ai/extract', { method: 'POST', formData });
    },
    /**
     * One turn of conversation. The whole transcript goes up each time because the
     * API keeps no session, and `today` tells the assistant which day it is where
     * the user is rather than where the server is.
     */
    chat: ({
      attachment,
      ...body
    }: {
      messages: ChatTurn[];
      today: string;
      conversationId?: string;
      pendingAction?: ChatReply['pendingAction'];
      choice?: { entryId?: string; index?: number; confirm?: boolean };
      attachment?: File;
    }) => {
      if (!attachment) {
        return request<ChatReply>('/ai/chat', { method: 'POST', body });
      }

      const formData = new FormData();
      formData.append('messages', JSON.stringify(body.messages));
      formData.append('today', body.today);
      if (body.conversationId) {
        formData.append('conversationId', body.conversationId);
      }
      if (body.pendingAction) {
        formData.append('pendingAction', JSON.stringify(body.pendingAction));
      }
      if (body.choice) {
        formData.append('choice', JSON.stringify(body.choice));
      }
      formData.append('attachment', attachment);
      return request<ChatReply>('/ai/chat', { method: 'POST', formData });
    },
  },

  imports: {
    status: () => request<{ deepAnalyseAvailable: boolean }>('/imports/status'),
    /**
     * Reads a PDF into a draft table. `mode` is "script" on the first pass and
     * "gemini" when the user asks for a deep analyse. The file goes up each
     * time because the API keeps no copy of it.
     */
    parse: (file: File, today: string, mode: 'script' | 'gemini' = 'script') => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('today', today);
      formData.append('mode', mode);
      return request<ImportPreview>('/imports/parse', { method: 'POST', formData });
    },
    commit: (body: { today: string; rows: ImportDraftRow[] }) =>
      request<ImportCommitResult>('/imports/commit', { method: 'POST', body }),
  },
};
