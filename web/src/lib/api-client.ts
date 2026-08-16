import type {
  AuthResponse,
  ChatReply,
  ChatTurn,
  DietBotReply,
  CreateEntryPayload,
  CreateGoalPayload,
  CreateWeightPayload,
  WeightLog,
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

const CONFIGURED_API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
const TOKEN_STORAGE_KEY = 'calorie-tracker.token';
const NETWORK_ERROR =
  'Could not reach the API. On the live site the server may be waking up — wait a minute and try again.';

function apiBase(): string {
  const configured = CONFIGURED_API_URL;
  const fallback = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:4000/api';
  const raw = configured || fallback;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const onLoopback = host === 'localhost' || host === '127.0.0.1';
    if (!onLoopback && /localhost|127\.0\.0\.1/.test(raw)) {
      return `${window.location.origin}/api`;
    }
    if (raw.startsWith('/')) {
      return `${window.location.origin}${raw}`;
    }
  }

  return raw;
}

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
  const root = apiBase();
  const url = new URL(
    `${root}${path}`,
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  );

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

    throw new ApiError(0, 'NETWORK_ERROR', NETWORK_ERROR);
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

  filename: string;
}

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
    throw new ApiError(0, 'NETWORK_ERROR', NETWORK_ERROR);
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

    batch: (body: { entries: CreateEntryPayload[]; source?: 'manual' | 'image' }) =>
      request<{ data: FoodEntry[] }>('/entries/batch', { method: 'POST', body }),
    update: (id: string, body: Partial<CreateEntryPayload>) =>
      request<FoodEntry>(`/entries/${id}`, { method: 'PATCH', body }),
    remove: (id: string) => request<void>(`/entries/${id}`, { method: 'DELETE' }),
  },

  goals: {

    current: (date: string) => request<{ goal: Goal | null }>('/goals/current', { query: { date } }),
    history: (query: QueryParams = {}) => request<Paginated<Goal>>('/goals', { query }),
    save: (body: CreateGoalPayload) => request<Goal>('/goals', { method: 'POST', body }),
    remove: (id: string) => request<void>(`/goals/${id}`, { method: 'DELETE' }),
  },

  weights: {
    current: () => request<{ weight: WeightLog | null }>('/weights/current'),
    list: (query: QueryParams = {}) => request<Paginated<WeightLog>>('/weights', { query }),
    save: (body: CreateWeightPayload) =>
      request<WeightLog>('/weights', { method: 'POST', body }),
    remove: (id: string) => request<void>(`/weights/${id}`, { method: 'DELETE' }),
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

    pdf: (query: ReportRange) => requestFile('/reports/pdf', query, 'calorie-report.pdf'),
  },

  ai: {
    status: () =>
      request<{
        available: boolean;
        extractAvailable?: boolean;
        chatAvailable?: boolean;
        dietBotAvailable?: boolean;
      }>('/ai/status'),
    extract: (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      return request<ExtractionResult>('/ai/extract', { method: 'POST', formData });
    },

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
    dietBot: (body: {
      messages: ChatTurn[];
      today: string;
      conversationId?: string;
      page?: string;
    }) => request<DietBotReply>('/ai/diet-bot', { method: 'POST', body }),
  },

  imports: {
    status: () => request<{ deepAnalyseAvailable: boolean }>('/imports/status'),

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
