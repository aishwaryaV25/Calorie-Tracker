import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../e2e/screenshots/mobile');
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';
const API_URL = process.env.API_URL ?? 'http://localhost:4000/api';

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function api(pathname, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API_URL}${pathname}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${pathname} ${response.status}: ${text}`);
  }
  return data;
}

async function seedAccount() {
  const email = `mobile.${Date.now()}@example.com`;
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
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
      await api('/entries', {
        method: 'POST',
        token,
        body: {
          foodName: 'Oatmeal with berries',
          mealType: 'breakfast',
          quantity: 1,
          unit: 'bowl',
          calories: 420,
          proteinGrams: 14,
          carbGrams: 68,
          fatGrams: 9,
          consumedOn: today,
        },
      });
      await api('/weights', {
        method: 'POST',
        token,
        body: { kg: 62.4, loggedOn: today, note: 'Morning' },
      });
      return token;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 4000 * attempt));
    }
  }
  throw lastError;
}

async function shot(page, name) {
  await page.addStyleTag({
    content: 'nextjs-portal,[data-next-badge-root]{display:none!important}',
  }).catch(() => {});
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices['iPhone 14'],
  });
  const page = await context.newPage();

  await page.goto(`${WEB_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await shot(page, '01-landing');

  await page.goto(`${WEB_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await shot(page, '02-login');

  await page.goto(`${WEB_URL}/signup`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await shot(page, '03-signup');

  const token = await seedAccount();
  await page.addInitScript((value) => {
    window.localStorage.setItem('calorie-tracker.token', value);
  }, token);

  const routes = [
    ['04-today', '/dashboard'],
    ['05-log', '/log'],
    ['06-entries', '/entries'],
    ['07-goals', '/goals'],
    ['08-weight', '/weight'],
    ['09-reports', '/reports'],
    ['10-chat', '/chat'],
    ['11-import', '/import'],
  ];

  for (const [name, url] of routes) {
    await page.goto(`${WEB_URL}${url}`, { waitUntil: 'networkidle' });
    await page.locator('h1').first().waitFor();
    await page.waitForTimeout(400);
    await shot(page, name);
  }

  await page.getByRole('button', { name: 'More' }).click();
  await page.waitForTimeout(300);
  await shot(page, '12-more');

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
