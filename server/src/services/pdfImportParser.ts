import { MEAL_TYPES, type MealType } from '../domain/nutrition.js';

export const MAX_IMPORT_ROWS = 200;

export type ImportField =
  | 'mealType'
  | 'foodName'
  | 'calories'
  | 'proteinGrams'
  | 'carbGrams'
  | 'fatGrams'
  | 'date'
  | 'time'
  | 'quantity'
  | 'unit';

export interface ImportDraftRow {
  foodName: string;
  mealType: MealType;
  quantity: number;
  unit: string;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  consumedOn: string;
  consumedAt?: string;
}

export interface ParseAttempt {
  schema: string;
  rows: ImportDraftRow[];
  warnings: string[];
  headerGuess: string[] | null;
  score: number;
}

export interface ScriptParseResult {
  rows: ImportDraftRow[];
  warnings: string[];
  notes: string | null;
  headerGuess: string[] | null;
  schema: string | null;
}

const FIELD_ALIASES: Record<ImportField, string[]> = {
  mealType: ['meal', 'meal type', 'type of meal', 'type', 'mealtime', 'occasion', 'sitting'],
  foodName: [
    'name',
    'food',
    'food name',
    'item',
    'meal name',
    'name of meal',
    'dish',
    'description',
    'food item',
    'entry',
  ],
  calories: ['calories', 'calorie', 'kcal', 'cal', 'cals', 'energy', 'energy kcal', 'kcals'],
  proteinGrams: ['protein', 'proteins', 'prot', 'protein g', 'protein grams', 'protein (g)'],
  carbGrams: [
    'carbs',
    'carb',
    'carbohydrate',
    'carbohydrates',
    'cho',
    'carb g',
    'carbs (g)',
  ],
  fatGrams: ['fat', 'fats', 'lipid', 'lipids', 'fat g', 'fat (g)'],
  date: ['date', 'day', 'consumed', 'eaten', 'when', 'consumed on', 'logged'],
  time: ['time', 'at', 'clock'],
  quantity: ['qty', 'quantity', 'amount', 'serving', 'servings', 'portion'],
  unit: ['unit', 'measure', 'uom'],
};

const SHORT_ALIASES: Record<string, ImportField> = {
  p: 'proteinGrams',
  c: 'carbGrams',
  f: 'fatGrams',
};

const MEAL_ALIASES: Record<string, MealType> = {
  breakfast: 'breakfast',
  bf: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  supper: 'dinner',
  snack: 'snack',
  snacks: 'snack',
};

const BREAKFAST_WORDS = [
  'breakfast',
  'cereal',
  'porridge',
  'oatmeal',
  'toast',
  'eggs',
  'idli',
  'dosa',
  'pancake',
  'coffee',
  'omelette',
];
const LUNCH_WORDS = ['lunch', 'salad', 'sandwich', 'biryani', 'thali', 'wrap'];
const DINNER_WORDS = ['dinner', 'curry', 'pasta', 'pizza', 'supper', 'stew'];
const SNACK_WORDS = ['snack', 'biscuit', 'cookie', 'chips', 'tea', 'fruit', 'bar', 'nuts'];

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

type ColumnMap = Partial<Record<ImportField, number>>;

interface TokenLine {
  raw: string;
  cells: string[];
}

export function parseDiaryText(text: string, today: string): ScriptParseResult {
  const lines = tokenise(text);
  const attempts: ParseAttempt[] = [];

  const headerAttempt = tryHeaderTable(lines, today);
  if (headerAttempt) {
    attempts.push(headerAttempt);
  }

  for (const schema of POSITIONAL_SCHEMAS) {
    attempts.push(tryPositional(lines, schema, today));
  }

  attempts.push(tryTrailingNumbers(lines, today));

  const ranked = attempts
    .filter((attempt) => attempt.rows.length > 0)
    .sort((a, b) => b.score - a.score);

  const winner = ranked[0];

  if (!winner || winner.score < 3) {
    return {
      rows: [],
      warnings: [
        'The script could not find a food table in this PDF. Column names may be unusual, or the file may be a scan. Deep Analyse can read layouts the script cannot.',
      ],
      notes: null,
      headerGuess: null,
      schema: null,
    };
  }

  const rows = winner.rows.slice(0, MAX_IMPORT_ROWS);
  const warnings = [...winner.warnings];

  if (winner.rows.length > MAX_IMPORT_ROWS) {
    warnings.push(`Only the first ${MAX_IMPORT_ROWS} rows were kept.`);
  }

  if (ranked[1] && ranked[1].score >= winner.score * 0.8 && ranked[1].schema !== winner.schema) {
    warnings.push(
      `Mapped as "${winner.schema}". Another reading ("${ranked[1].schema}") was close — check a couple of rows before saving.`,
    );
  }

  return {
    rows,
    warnings,
    notes: `Read ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} using ${winner.schema}.`,
    headerGuess: winner.headerGuess,
    schema: winner.schema,
  };
}

function tokenise(text: string): TokenLine[] {
  return text
    .split(/\r?\n/)
    .map((raw) => raw.replace(/\u00a0/g, ' ').trim())
    .filter((raw) => raw.length > 0)
    .map((raw) => ({ raw, cells: splitCells(raw) }))
    .filter((line) => line.cells.length > 0 && !isNoise(line.raw));
}

function splitCells(line: string): string[] {
  if (line.includes('|')) {
    return line.split('|').map(cleanCell).filter(Boolean);
  }

  if (line.includes('\t')) {
    return line.split('\t').map(cleanCell).filter(Boolean);
  }

  const commas = line.split(',').map(cleanCell);
  if (commas.length >= 3) {
    return commas.filter(Boolean);
  }

  const spaced = line.split(/\s{2,}/).map(cleanCell).filter(Boolean);
  if (spaced.length >= 2) {
    return spaced;
  }

  return [cleanCell(line)].filter(Boolean);
}

const cleanCell = (value: string) => value.replace(/^["'\s]+|["'\s]+$/g, '').trim();

function isNoise(line: string): boolean {
  const folded = fold(line);
  if (folded.length === 0) return true;
  if (/^page\s+\d+(\s+of\s+\d+)?$/.test(folded)) return true;
  if (/^calorie tracker/.test(folded)) return true;
  if (folded.length < 2) return true;
  return false;
}

function tryHeaderTable(lines: TokenLine[], today: string): ParseAttempt | null {
  let best: { index: number; map: ColumnMap; headers: string[]; hits: number } | null = null;

  for (let index = 0; index < Math.min(lines.length, 40); index += 1) {
    const headers = lines[index]!.cells;
    const map = mapHeaders(headers);
    const hits = Object.keys(map).length;

    if (hits < 2 || map.foodName === undefined) {
      continue;
    }

    if (!best || hits > best.hits) {
      best = { index, map, headers, hits };
    }
  }

  if (!best) {
    return null;
  }

  const rows: ImportDraftRow[] = [];
  const warnings: string[] = [];

  for (const line of lines.slice(best.index + 1)) {
    if (mapHeaders(line.cells).foodName !== undefined && Object.keys(mapHeaders(line.cells)).length >= 2) {
      continue;
    }

    const row = rowFromCells(line.cells, best.map, today);
    if (row) {
      rows.push(row);
    }
  }

  return {
    schema: `header:${best.headers.join(' | ')}`,
    rows,
    warnings,
    headerGuess: best.headers,
    score: scoreRows(rows, today) + best.hits * 2,
  };
}

function mapHeaders(cells: string[]): ColumnMap {
  const map: ColumnMap = {};

  cells.forEach((cell, index) => {
    const field = matchHeader(cell);
    if (field && map[field] === undefined) {
      map[field] = index;
    }
  });

  return map;
}

function matchHeader(cell: string): ImportField | null {
  const folded = fold(cell);
  if (!folded) return null;

  if (SHORT_ALIASES[folded]) {
    return SHORT_ALIASES[folded];
  }

  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [ImportField, string[]][]) {
    if (aliases.some((alias) => folded === alias || folded.startsWith(`${alias} `))) {
      return field;
    }
  }

  return null;
}

interface PositionalSchema {
  name: string;
  fields: ImportField[];
}

const POSITIONAL_SCHEMAS: PositionalSchema[] = [
  {
    name: 'meal | name | calories | protein | carbs | fat',
    fields: ['mealType', 'foodName', 'calories', 'proteinGrams', 'carbGrams', 'fatGrams'],
  },
  {
    name: 'date | meal | name | calories | protein | carbs | fat',
    fields: ['date', 'mealType', 'foodName', 'calories', 'proteinGrams', 'carbGrams', 'fatGrams'],
  },
  {
    name: 'date | name | calories | protein | carbs | fat',
    fields: ['date', 'foodName', 'calories', 'proteinGrams', 'carbGrams', 'fatGrams'],
  },
  {
    name: 'name | calories | protein | carbs | fat',
    fields: ['foodName', 'calories', 'proteinGrams', 'carbGrams', 'fatGrams'],
  },
  {
    name: 'date | meal | name | calories',
    fields: ['date', 'mealType', 'foodName', 'calories'],
  },
  {
    name: 'meal | name | calories',
    fields: ['mealType', 'foodName', 'calories'],
  },
  {
    name: 'name | calories',
    fields: ['foodName', 'calories'],
  },
];

function tryPositional(lines: TokenLine[], schema: PositionalSchema, today: string): ParseAttempt {
  const map: ColumnMap = {};
  schema.fields.forEach((field, index) => {
    map[field] = index;
  });

  const rows: ImportDraftRow[] = [];

  for (const line of lines) {
    if (line.cells.length < schema.fields.length) {
      continue;
    }

    if (mapHeaders(line.cells).foodName !== undefined && Object.keys(mapHeaders(line.cells)).length >= 2) {
      continue;
    }

    const row = rowFromCells(line.cells, map, today);
    if (row) {
      rows.push(row);
    }
  }

  return {
    schema: schema.name,
    rows,
    warnings: [],
    headerGuess: schema.fields,
    score: scoreRows(rows, today),
  };
}

function tryTrailingNumbers(lines: TokenLine[], today: string): ParseAttempt {
  const rows: ImportDraftRow[] = [];

  for (const line of lines) {
    const tokens = line.raw.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) continue;

    const numbers: number[] = [];
    while (tokens.length > 0 && looksNumeric(tokens[tokens.length - 1]!)) {
      numbers.unshift(parseAmount(tokens.pop()!) ?? 0);
    }

    if (numbers.length === 0 || tokens.length === 0) {
      continue;
    }

    let mealType: MealType | undefined;
    if (parseMealType(tokens[0]!)) {
      mealType = parseMealType(tokens.shift()!);
    }

    let date: string | undefined;
    const maybeDate = parseDate(tokens[0] ?? '', today);
    if (maybeDate && tokens.length > 1) {
      date = maybeDate;
      tokens.shift();
    }

    const foodName = tokens.join(' ').trim();
    if (!foodName || looksNumeric(foodName)) {
      continue;
    }

    const [calories, proteinGrams, carbGrams, fatGrams] = assignTrailing(numbers);
    if (calories === undefined) {
      continue;
    }

    rows.push(
      finaliseRow(
        {
          foodName,
          mealType,
          calories,
          proteinGrams,
          carbGrams,
          fatGrams,
          consumedOn: date,
        },
        today,
      ),
    );
  }

  return {
    schema: 'trailing numbers after the name',
    rows,
    warnings: [],
    headerGuess: null,
    score: scoreRows(rows, today),
  };
}

function assignTrailing(numbers: number[]): [number | undefined, number, number, number] {
  if (numbers.length === 1) {
    return [numbers[0], 0, 0, 0];
  }

  if (numbers.length === 4) {
    return [numbers[0], numbers[1] ?? 0, numbers[2] ?? 0, numbers[3] ?? 0];
  }

  if (numbers.length >= 5) {
    return [numbers[1], numbers[2] ?? 0, numbers[3] ?? 0, numbers[4] ?? 0];
  }

  return [numbers[0], 0, 0, 0];
}

function rowFromCells(cells: string[], map: ColumnMap, today: string): ImportDraftRow | null {
  const foodName = map.foodName !== undefined ? cells[map.foodName]?.trim() ?? '' : '';
  if (!foodName || looksNumeric(foodName) || matchHeader(foodName)) {
    return null;
  }

  const calories = map.calories !== undefined ? parseAmount(cells[map.calories] ?? '') : undefined;
  if (calories === undefined) {
    return null;
  }

  return finaliseRow(
    {
      foodName,
      mealType: map.mealType !== undefined ? parseMealType(cells[map.mealType] ?? '') : undefined,
      calories,
      proteinGrams: readAmount(cells, map.proteinGrams),
      carbGrams: readAmount(cells, map.carbGrams),
      fatGrams: readAmount(cells, map.fatGrams),
      quantity: readAmount(cells, map.quantity),
      unit: map.unit !== undefined ? cells[map.unit]?.trim() : undefined,
      consumedOn: map.date !== undefined ? parseDate(cells[map.date] ?? '', today) : undefined,
      time: map.time !== undefined ? parseTime(cells[map.time] ?? '') : undefined,
    },
    today,
  );
}

interface LooseRow {
  foodName: string;
  mealType?: MealType;
  calories: number;
  proteinGrams?: number;
  carbGrams?: number;
  fatGrams?: number;
  quantity?: number;
  unit?: string;
  consumedOn?: string;
  time?: string;
}

function finaliseRow(row: LooseRow, today: string): ImportDraftRow {
  const consumedOn = row.consumedOn ?? today;
  const mealType = row.mealType ?? inferMealType(row.foodName, row.time);
  const quantity = clamp(row.quantity && row.quantity > 0 ? row.quantity : 1, 0.01, 10_000);

  const draft: ImportDraftRow = {
    foodName: row.foodName.slice(0, 160),
    mealType,
    quantity,
    unit: (row.unit && row.unit.slice(0, 24)) || 'serving',
    calories: clamp(row.calories, 0, 100_000),
    proteinGrams: clamp(row.proteinGrams ?? 0, 0, 100_000),
    carbGrams: clamp(row.carbGrams ?? 0, 0, 100_000),
    fatGrams: clamp(row.fatGrams ?? 0, 0, 100_000),
    consumedOn,
  };

  if (row.time) {
    draft.consumedAt = `${consumedOn}T${row.time}:00.000Z`;
  }

  return draft;
}

function inferMealType(foodName: string, time?: string): MealType {
  const folded = fold(foodName);

  if (BREAKFAST_WORDS.some((word) => folded.includes(word))) return 'breakfast';
  if (LUNCH_WORDS.some((word) => folded.includes(word))) return 'lunch';
  if (DINNER_WORDS.some((word) => folded.includes(word))) return 'dinner';
  if (SNACK_WORDS.some((word) => folded.includes(word))) return 'snack';

  if (time) {
    const hour = Number(time.slice(0, 2));
    if (hour < 11) return 'breakfast';
    if (hour < 16) return 'lunch';
    if (hour < 21) return 'dinner';
    return 'snack';
  }

  return 'snack';
}

function scoreRows(rows: ImportDraftRow[], today?: string): number {
  return rows.reduce((score, row) => {
    let points = 0;
    if (row.foodName.length >= 2 && !looksNumeric(row.foodName)) points += 3;
    if (row.calories > 0 && row.calories < 20_000) points += 3;
    if (row.proteinGrams + row.carbGrams + row.fatGrams > 0) points += 2;
    if (row.mealType) points += 1;

    if (today && row.consumedOn !== today) points += 2;
    if (row.calories === 0) points -= 1;
    return score + points;
  }, 0);
}

function readAmount(cells: string[], index: number | undefined): number | undefined {
  if (index === undefined) return undefined;
  return parseAmount(cells[index] ?? '');
}

function parseAmount(value: string): number | undefined {
  const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseMealType(value: string): MealType | undefined {
  const folded = fold(value);
  if (MEAL_ALIASES[folded]) return MEAL_ALIASES[folded];
  return MEAL_TYPES.find((type) => folded.startsWith(type));
}

function parseTime(value: string): string | undefined {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([ap]m))?$/i);
  if (!match) return undefined;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridian = match[3]?.toLowerCase();

  if (meridian === 'pm' && hour < 12) hour += 12;
  if (meridian === 'am' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return undefined;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseDate(value: string, today: string): string | undefined {
  const folded = fold(value);
  if (folded === 'today') return today;
  if (folded === 'yesterday') return shiftDate(today, -1);

  const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso && isRealDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const dotted = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dotted) {
    const day = Number(dotted[1]);
    const month = Number(dotted[2]);
    const year = Number(dotted[3]);
    if (isRealDate(year, month, day)) {
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }

  const named = value.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (named?.[2]) {
    const month = MONTHS[named[2].toLowerCase()];
    const day = Number(named[1]);
    const year = Number(named[3]);
    if (month && isRealDate(year, month, day)) {
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }

  return undefined;
}

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function shiftDate(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const pad = (value: number) => String(value).padStart(2, '0');

const fold = (value: string) =>
  value
    .toLowerCase()
    .replace(/[_./()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const looksNumeric = (value: string) => /^-?\d+(?:[.,]\d+)?$/.test(value.trim());

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
