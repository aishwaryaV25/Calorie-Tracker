import {
  banner,
  barChart,
  createDocument,
  finish,
  meters,
  paragraph,
  sectionTitle,
  table,
  tiles,
  toBuffer,
  type Bar,
  type Document,
} from '../lib/pdf.js';
import type { ReportRangeQuery } from '../types/dto.js';
import { getProfile } from './authService.js';
import {
  getDailyReport,
  getGoalComparison,
  getMacroBreakdown,
  getMicronutrientReport,
  getWeeklyReport,
  resolveRange,
} from './reportsService.js';

/**
 * The downloadable nutrition report.
 *
 * Everything in it comes from the same report services the charts on screen use,
 * so the document cannot disagree with the app; this module only decides what to
 * include and in which order. The layout primitives live in `lib/pdf`.
 */

/** A month of days is the most that stays readable as a chart and a table. */
const MAX_DAYS_CHARTED = 366;
const MAX_WEEKS = 53;
const MAX_MICRONUTRIENTS = 30;

export interface ReportPdf {
  buffer: Buffer;
  filename: string;
}

export async function buildReportPdf(
  userId: string,
  query: ReportRangeQuery,
): Promise<ReportPdf> {
  // Resolved up front so the filename and the heading describe the same range the
  // sections were built from, including the default window when none was given.
  const { from, to } = resolveRange(query);
  const range = { from, to, page: 1, pageSize: MAX_DAYS_CHARTED };

  const [profile, daily, weekly, macros, micronutrients, comparison] = await Promise.all([
    getProfile(userId),
    getDailyReport(userId, range),
    getWeeklyReport(userId, { ...range, pageSize: MAX_WEEKS }),
    getMacroBreakdown(userId, range),
    getMicronutrientReport(userId, { ...range, pageSize: MAX_MICRONUTRIENTS }),
    getGoalComparison(userId, range),
  ]);

  const doc = createDocument('Nutrition report');
  const pending = toBuffer(doc);

  // Both reports come back newest first, which suits a screen you scroll. A
  // document is read from the top down, so everything here runs oldest first.
  const days = [...daily.data].reverse();
  const weeks = [...weekly.data].reverse();
  const { range: dates } = comparison;

  banner(
    doc,
    'Nutrition report',
    `Prepared for ${profile.displayName}. Every figure covers ${formatDate(dates.from)} to ${formatDate(dates.to)}, ${dates.days} ${dates.days === 1 ? 'day' : 'days'}.`,
    `Generated ${formatDate(new Date().toISOString().slice(0, 10))}`,
  );

  writeSummary(doc, comparison, micronutrients.data.length);
  writeGoalComparison(doc, comparison);
  writeDailyChart(doc, days, comparison);
  writeMacroSplit(doc, macros);
  writeWeekly(doc, weeks);
  writeMicronutrients(doc, micronutrients.data, dates.days);
  writeDailyTable(doc, days);

  finish(doc, 'Calorie Tracker — figures as recorded in your diary.');

  return {
    buffer: await pending,
    filename: `calorie-report-${dates.from}-to-${dates.to}.pdf`,
  };
}

type Comparison = Awaited<ReturnType<typeof getGoalComparison>>;
type Daily = Awaited<ReturnType<typeof getDailyReport>>['data'];
type Macros = Awaited<ReturnType<typeof getMacroBreakdown>>;
type Micronutrients = Awaited<ReturnType<typeof getMicronutrientReport>>['data'];
type Weekly = Awaited<ReturnType<typeof getWeeklyReport>>['data'];

function writeSummary(doc: Document, comparison: Comparison, nutrients: number) {
  const { actual, target, adherence, daysLogged, range } = comparison;

  tiles(doc, [
    {
      label: 'Total calories',
      value: `${formatNumber(actual.calories)} kcal`,
      note: `${daysLogged} of ${range.days} days logged`,
    },
    {
      label: 'Average per day',
      value: `${formatNumber(actual.averageDailyCalories)} kcal`,
      note: daysLogged > 0 ? 'across days with entries' : 'nothing logged yet',
    },
    {
      label: 'Daily target',
      value: target.averageDailyCalories > 0 ? `${formatNumber(target.averageDailyCalories)} kcal` : '—',
      note: comparison.hasGoal ? 'average of goals in force' : 'no goal set',
    },
    {
      label: 'Of target',
      value: adherence ? `${formatNumber(adherence.calories)}%` : '—',
      note: adherence ? describeAdherence(adherence.calories) : 'set a goal to compare',
      // Over target is the case worth spotting at a glance.
      isAlert: Boolean(adherence && adherence.calories > 100),
    },
  ]);

  if (daysLogged === 0) {
    paragraph(doc, 'Nothing has been logged in this range, so every figure below is empty.');
    return;
  }

  paragraph(
    doc,
    `${nutrients} ${nutrients === 1 ? 'micronutrient' : 'micronutrients'} recorded in this range. Averages are taken over days with at least one entry, so a partial range is not mistaken for under-eating.`,
  );
}

function writeGoalComparison(doc: Document, comparison: Comparison) {
  sectionTitle(doc, 'Goal versus actual');

  if (!comparison.hasGoal) {
    paragraph(doc, 'No goal applied to any day in this range, so there is nothing to compare against.');
    return;
  }

  const { actual, target } = comparison;

  meters(doc, [
    row('Calories', actual.calories, target.calories, 'kcal'),
    row('Protein', actual.proteinGrams, target.proteinGrams, 'g'),
    row('Carbohydrate', actual.carbGrams, target.carbGrams, 'g'),
    row('Fat', actual.fatGrams, target.fatGrams, 'g'),
  ]);
}

/** One meter comparing an actual total against the total that was targeted. */
function row(label: string, actual: number, target: number, unit: string) {
  return {
    label,
    value: `${formatNumber(actual)} / ${formatNumber(target)} ${unit}`,
    fraction: target > 0 ? actual / target : 0,
  };
}

function writeDailyChart(doc: Document, days: Daily, comparison: Comparison) {
  sectionTitle(doc, 'Daily calories');

  // An axis with no bars on it says less than a sentence does.
  if (days.every((day) => day.entryCount === 0)) {
    paragraph(doc, 'No entries fall inside this range.');
    return;
  }

  const bars: Bar[] = days.map((day) => ({
    // Only the day of the month: a full date under every bar is unreadable, and
    // the range is already stated at the top of the report.
    label: day.date.slice(8),
    value: day.calories,
    isOver: Boolean(day.goal && day.calories > day.goal.dailyCalories),
  }));

  barChart(doc, bars, comparison.hasGoal ? comparison.target.averageDailyCalories : null);
  paragraph(doc, 'Bars in red are days that went over the target in force on that day.');
}

function writeMacroSplit(doc: Document, macros: Macros) {
  sectionTitle(doc, 'Macronutrient split');

  const { grams, caloriePercentage } = macros;
  const total = grams.proteinGrams + grams.carbGrams + grams.fatGrams;

  if (total === 0) {
    paragraph(doc, 'No macros were recorded in this range.');
    return;
  }

  meters(doc, [
    macroRow('Protein', grams.proteinGrams, caloriePercentage.proteinGrams),
    macroRow('Carbohydrate', grams.carbGrams, caloriePercentage.carbGrams),
    macroRow('Fat', grams.fatGrams, caloriePercentage.fatGrams),
  ]);

  paragraph(
    doc,
    'Percentages are each macro\u2019s share of energy at 4, 4 and 9 kcal per gram, so the three always add up to 100.',
  );
}

const macroRow = (label: string, grams: number, share: number) => ({
  label,
  value: `${formatNumber(grams)} g · ${formatNumber(share)}%`,
  fraction: share / 100,
});

function writeWeekly(doc: Document, weeks: Weekly) {
  // Weeks with nothing in them would be rows of zeros; the gaps in the chart
  // above already say when nothing was logged.
  const logged = weeks.filter((week) => week.daysLogged > 0);

  if (logged.length === 0) {
    return;
  }

  sectionTitle(doc, 'By week');

  table(
    doc,
    [
      { header: 'Week', width: 0.3 },
      { header: 'Days', width: 0.1, align: 'right' },
      { header: 'Calories', width: 0.15, align: 'right' },
      { header: 'Avg / day', width: 0.15, align: 'right' },
      { header: 'Protein', width: 0.1, align: 'right' },
      { header: 'Carbs', width: 0.1, align: 'right' },
      { header: 'Fat', width: 0.1, align: 'right' },
    ],
    logged.map((week) => [
      `${formatDate(week.weekStart)} – ${formatDate(week.weekEnd)}`,
      String(week.daysLogged),
      formatNumber(week.calories),
      formatNumber(week.averageDailyCalories),
      `${formatNumber(week.proteinGrams)} g`,
      `${formatNumber(week.carbGrams)} g`,
      `${formatNumber(week.fatGrams)} g`,
    ]),
  );
  paragraph(doc, 'Averages are per day logged, so a half-finished week is not read as a week of under-eating.');
}

function writeMicronutrients(
  doc: Document,
  nutrients: Micronutrients,
  days: number,
) {
  sectionTitle(doc, 'Vitamins and minerals');

  if (nutrients.length === 0) {
    paragraph(
      doc,
      'No micronutrients were recorded. They are filled in automatically when a nutrition label is read from a photo, and can be added by hand on any entry.',
    );
    return;
  }

  table(
    doc,
    [
      { header: 'Nutrient', width: 0.4 },
      { header: 'Total', width: 0.3, align: 'right' },
      { header: `Average per day (${days})`, width: 0.3, align: 'right' },
    ],
    nutrients.map((nutrient) => [
      nutrient.label,
      `${formatNumber(nutrient.total)} ${nutrient.unit}`,
      `${formatNumber(nutrient.averagePerDay)} ${nutrient.unit}`,
    ]),
  );
}

function writeDailyTable(doc: Document, days: Daily) {
  const logged = days.filter((day) => day.entryCount > 0);

  if (logged.length === 0) {
    return;
  }

  sectionTitle(doc, 'Day by day');
  paragraph(doc, 'Days with no entries are left out.');

  table(
    doc,
    [
      { header: 'Date', width: 0.22 },
      { header: 'Entries', width: 0.11, align: 'right' },
      { header: 'Calories', width: 0.15, align: 'right' },
      { header: 'Target', width: 0.14, align: 'right' },
      { header: 'Protein', width: 0.13, align: 'right' },
      { header: 'Carbs', width: 0.13, align: 'right' },
      { header: 'Fat', width: 0.12, align: 'right' },
    ],
    logged.map((day) => [
      formatDate(day.date),
      String(day.entryCount),
      formatNumber(day.calories),
      day.goal ? formatNumber(day.goal.dailyCalories) : '—',
      `${formatNumber(day.proteinGrams)} g`,
      `${formatNumber(day.carbGrams)} g`,
      `${formatNumber(day.fatGrams)} g`,
    ]),
  );
}

const describeAdherence = (percentage: number): string => {
  if (percentage > 110) return 'over target';
  if (percentage < 90) return 'under target';
  return 'on target';
};

/** Whole numbers with thousands separators: nutrition figures need no decimals. */
const formatNumber = (value: number): string => Math.round(value).toLocaleString('en-GB');

/** "2026-08-15" as "15 Aug 2026", read as a calendar day rather than an instant. */
function formatDate(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
