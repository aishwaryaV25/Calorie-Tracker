import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../e2e/screenshots');
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';
const API_URL = process.env.API_URL ?? 'http://localhost:4000/api';
const VIEWPORT = { width: 1440, height: 900 };

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysAgoKey(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return todayKey(date);
}

function escapePdfText(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildDiaryPdf(lines) {
  const streamBody = [
    'BT',
    '/F1 11 Tf',
    '50 760 Td',
    ...lines.flatMap((line, index) =>
      index === 0 ? [`(${escapePdfText(line)}) Tj`] : ['0 -16 Td', `(${escapePdfText(line)}) Tj`],
    ),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(streamBody)} >>\nstream\n${streamBody}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${offsets.length - 1} 0 obj\n${object}\nendobj\n`;
  }

  const xrefAt = Buffer.byteLength(pdf);
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(pdf);
}

async function api(pathname, { method = 'GET', token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = { method, headers, body: form };
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = { method, headers, body: JSON.stringify(body) };
  } else {
    payload = { method, headers };
  }

  const response = await fetch(`${API_URL}${pathname}`, payload);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${pathname} ${response.status}: ${text}`);
  }
  return data;
}

async function seedAccount() {
  const email = `visual.${Date.now()}@example.com`;
  const { token } = await api('/auth/signup', {
    method: 'POST',
    body: { email, password: 'password123', displayName: 'Aishwarya' },
  });

  const today = todayKey();
  await api('/goals', {
    method: 'POST',
    token,
    body: {
      dailyCalories: 2200,
      proteinGrams: 140,
      carbGrams: 220,
      fatGrams: 70,
      targetWeightKg: 62,
      effectiveFrom: today,
    },
  });

  const meals = [
    { daysAgo: 0, foodName: 'Oatmeal with berries', mealType: 'breakfast', quantity: 1, unit: 'bowl', calories: 420, proteinGrams: 14, carbGrams: 68, fatGrams: 9 },
    { daysAgo: 0, foodName: 'Grilled chicken salad', mealType: 'lunch', quantity: 1, unit: 'plate', calories: 610, proteinGrams: 48, carbGrams: 30, fatGrams: 32 },
    { daysAgo: 1, foodName: 'Salmon with roasted vegetables', mealType: 'dinner', quantity: 1, unit: 'plate', calories: 720, proteinGrams: 42, carbGrams: 28, fatGrams: 38 },
    { daysAgo: 2, foodName: 'Greek yogurt', mealType: 'snack', quantity: 170, unit: 'g', calories: 180, proteinGrams: 16, carbGrams: 12, fatGrams: 6 },
    { daysAgo: 3, foodName: 'Idli sambar', mealType: 'breakfast', quantity: 3, unit: 'pcs', calories: 320, proteinGrams: 12, carbGrams: 54, fatGrams: 4 },
  ];

  for (const meal of meals) {
    const { daysAgo, ...entry } = meal;
    await api('/entries', {
      method: 'POST',
      token,
      body: { ...entry, consumedOn: daysAgoKey(daysAgo) },
    });
  }

  return token;
}

async function shot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const token = await seedAccount();

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.addInitScript((value) => {
    window.localStorage.setItem('calorie-tracker.token', value);
  }, token);

  const routes = [
    ['dashboard', '/dashboard', 'Today'],
    ['log', '/log', 'Log a Meal'],
    ['goals', '/goals', 'Set Your Goals'],
    ['entries', '/entries', 'Entries'],
    ['reports', '/reports', 'Reports'],
    ['chat', '/chat', 'Chat support'],
    ['import-empty', '/import', 'Bulk import'],
  ];

  for (const [name, url, heading] of routes) {
    await page.goto(`${WEB_URL}${url}`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: heading }).waitFor();
    await page.waitForTimeout(400);
    await shot(page, name);
  }

  const pdf = buildDiaryPdf([
    'Date | Meal | Food | Qty | Unit | Calories | Protein | Carbs | Fat',
    '2026-08-10 | Breakfast | Oatmeal with berries | 1 | bowl | 420 | 12 | 68 | 9',
    '2026-08-11 | Lunch | Grilled chicken salad | 1 | plate | 610 | 48 | 30 | 32',
    '2026-08-12 | Dinner | Salmon with roasted vegetables | 1 | plate | 720 | 42 | 28 | 38',
    '2026-08-13 | Snacks | Greek yogurt | 170 | g | 180 | 16 | 12 | 6',
    '2026-08-14 | Breakfast | Idli sambar | 3 | pcs | 320 | 12 | 54 | 4',
  ]);

  await page.locator('#bulk-import-file').setInputFiles({
    name: 'sample_meal_data.pdf',
    mimeType: 'application/pdf',
    buffer: pdf,
  });
  await page.getByRole('button', { name: /Import \d+ entries/ }).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(500);
  await shot(page, 'import-review');

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
