import { expect, test, type Page } from '@playwright/test';

const API = process.env.API_URL ?? 'http://localhost:4000/api';
const PASSWORD = 'supersecret1';

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysAgoKey(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return todayKey(date);
}

function escapePdfText(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildDiaryPdf(lines: string[]) {
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

async function apiJson(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, init);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} ${response.status}: ${text}`);
  }
  return data;
}

async function tokenFromPage(page: Page) {
  const token = await page.evaluate(() => window.localStorage.getItem('calorie-tracker.token'));
  if (!token) {
    throw new Error('No auth token in localStorage');
  }
  return token;
}

async function logMeal(
  page: Page,
  meal: string,
  fields: { food: string; quantity: string; unit: string; calories: string; protein: string; carbs: string; fat: string },
) {
  await page.getByRole('button', { name: meal, exact: true }).click();
  await page.locator('#foodName').fill(fields.food);
  await page.locator('#quantity').fill(fields.quantity);
  await page.locator('#unit').fill(fields.unit);
  await page.locator('#calories').fill(fields.calories);
  await page.locator('#proteinGrams').fill(fields.protein);
  await page.locator('#carbGrams').fill(fields.carbs);
  await page.locator('#fatGrams').fill(fields.fat);
  await page.getByRole('button', { name: 'Add meal' }).click();
  await expect(page.getByText('Saved. Keep going or review the day.')).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test.describe('Assignment end-to-end', () => {
  const stamp = Date.now();
  const email = `e2e.${stamp}@example.com`;
  const otherEmail = `e2e.other.${stamp}@example.com`;
  let authToken: string | null = null;

  test.beforeEach(async ({ page }) => {
    if (!authToken) {
      return;
    }

    await page.addInitScript((token) => {
      window.localStorage.setItem('calorie-tracker.token', token);
    }, authToken);
  });

  test('health: API is separate from the frontend', async ({ request }) => {
    const apiHealth = await request.get(`${API}/health`);
    expect(apiHealth.ok()).toBeTruthy();
    expect(await apiHealth.json()).toMatchObject({ status: 'ok' });

    const web = await request.get('/');
    expect(web.ok()).toBeTruthy();
    expect(new URL(API).origin).not.toBe(new URL(web.url()).origin);
  });

  test('multi-user: sign up through the web app', async ({ page }) => {
    await page.goto('/signup');
    await page.locator('#displayName').fill('E2E User');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page.locator('aside').getByText('E2E User')).toBeVisible();
    authToken = await tokenFromPage(page);
  });

  test('goal setting: create, update, list, delete', async ({ page }) => {
    await page.goto('/goals');
    await expect(page.getByRole('heading', { name: 'Set Your Goals' })).toBeVisible();

    await page.locator('#effectiveFrom').fill(daysAgoKey(7));
    await page.getByRole('button', { name: 'Lose fat' }).click();
    await page.locator('#targetWeightKg').fill('62');
    await page.getByRole('button', { name: 'Save goals' }).click();
    await expect(page.getByText(/Targets saved/).first()).toBeVisible();
    await expect(page.getByText('1 version')).toBeVisible();

    await page.locator('#effectiveFrom').fill(todayKey());
    await page.getByRole('button', { name: 'Build muscle' }).click();
    await page.getByRole('button', { name: 'Save goals' }).click();
    await expect(page.getByText(/Targets saved/).first()).toBeVisible();
    await expect(page.getByText('2 versions')).toBeVisible();
    await expect(page.locator('table').getByText('2,600')).toBeVisible();
    await expect(page.locator('table').getByText('62kg').first()).toBeVisible();

    const history = page.locator('table').filter({ hasText: 'Effective from' });
    await history.getByRole('button', { name: 'Delete' }).last().click();
    await expect(page.getByText('1 version')).toBeVisible();
    await expect(page.getByText('That target version was deleted.')).toBeVisible();
  });

  test('meal entry: create breakfast/lunch/dinner/snacks with macros and micros', async ({ page }) => {
    await page.goto('/log');
    await expect(page.getByRole('heading', { name: 'Log a Meal' })).toBeVisible();
    await expect(page.getByText(/photo of your meal or nutrition label/i)).toBeVisible();

    await page.getByRole('button', { name: 'Add meal' }).click();
    await expect(page.getByText('Food name is required.')).toBeVisible();

    await page.locator('#meal-micro-add-amount').fill('12');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('Vitamin A')).toBeVisible();

    await logMeal(page, 'Breakfast', {
      food: 'E2E oatmeal',
      quantity: '1',
      unit: 'bowl',
      calories: '420',
      protein: '14',
      carbs: '68',
      fat: '9',
    });

    await logMeal(page, 'Lunch', {
      food: 'E2E chicken salad',
      quantity: '1',
      unit: 'plate',
      calories: '610',
      protein: '48',
      carbs: '30',
      fat: '32',
    });

    await logMeal(page, 'Dinner', {
      food: 'E2E salmon',
      quantity: '1',
      unit: 'plate',
      calories: '720',
      protein: '42',
      carbs: '28',
      fat: '38',
    });

    await logMeal(page, 'Snacks', {
      food: 'E2E yogurt',
      quantity: '170',
      unit: 'g',
      calories: '180',
      protein: '16',
      carbs: '12',
      fat: '6',
    });
  });

  test('time-range listing: filter, search, edit, delete, paginate', async ({ page }) => {
    await page.goto('/entries');
    await expect(page.getByRole('heading', { name: 'Entries' })).toBeVisible();

    await page.getByRole('button', { name: 'Today' }).click();
    const table = page.locator('table');
    await expect(table.getByText('E2E oatmeal')).toBeVisible();
    await expect(table.getByText('E2E chicken salad')).toBeVisible();
    await expect(table.getByText('E2E salmon')).toBeVisible();
    await expect(table.getByText('E2E yogurt')).toBeVisible();

    await page.locator('#mealType').selectOption('breakfast');
    await expect(table.getByText('E2E oatmeal')).toBeVisible();
    await expect(table.getByText('E2E chicken salad')).toHaveCount(0);

    await page.getByRole('button', { name: 'Reset' }).click();
    await page.getByRole('button', { name: 'Today' }).click();
    await page.locator('#search').fill('salmon');
    await expect(table.getByText('E2E salmon')).toBeVisible();
    await expect(table.getByText('E2E oatmeal')).toHaveCount(0);

    await page.locator('#search').fill('');
    await expect(table.getByText('E2E oatmeal')).toBeVisible({ timeout: 10_000 });

    const yogurtRow = page.locator('table tbody tr', { hasText: 'E2E yogurt' });
    await yogurtRow.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('dialog', { name: 'Edit entry' })).toBeVisible();
    await page.locator('#foodName').fill('E2E yogurt updated');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved "E2E yogurt updated".')).toBeVisible();
    await expect(table.getByText('E2E yogurt updated')).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('table tbody tr', { hasText: 'E2E salmon' }).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Deleted "E2E salmon".')).toBeVisible();
    await expect(table.getByText('E2E salmon')).toHaveCount(0);

    const token = await tokenFromPage(page);
    for (let i = 0; i < 10; i += 1) {
      await apiJson('/entries', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foodName: `E2E extra ${i}`,
          mealType: 'snack',
          quantity: 1,
          unit: 'serving',
          calories: 100,
          consumedOn: todayKey(),
        }),
      });
    }

    await page.reload();
    await page.getByRole('button', { name: 'Today' }).click();
    await page.getByLabel('Entries per page').selectOption('10');
    await expect(page.getByText(/Page 1 of /)).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText(/Page 2 of /)).toBeVisible();
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    await expect(page.getByText(/Page 1 of /)).toBeVisible();
  });

  test('nutrition reports and graphs', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Daily calories' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Macro split' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Goal vs actual' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Weekly totals' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Micronutrients' })).toBeVisible();
    await expect(page.getByText('Vitamin A')).toBeVisible();
    await expect(page.locator('.recharts-responsive-container').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Download PDF/i })).toBeVisible();
  });

  test('bulk import via PDF: parse, review, commit', async ({ page }) => {
    await page.goto('/import');
    await expect(page.getByRole('heading', { name: 'Bulk import' })).toBeVisible();

    const pdf = buildDiaryPdf([
      'Type of meal | Name of meal | Calories | Protein | Carbs | Fat',
      'Breakfast | E2E imported khichdi | 380 | 14 | 58 | 8',
      'Snack | E2E imported banana | 105 | 1 | 27 | 0',
    ]);

    await page.locator('#bulk-import-file').setInputFiles({
      name: 'e2e-diary.pdf',
      mimeType: 'application/pdf',
      buffer: pdf,
    });

    await expect(page.getByRole('button', { name: /Import 2 entries/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('input[value="E2E imported khichdi"]')).toBeVisible();
    await page.getByRole('button', { name: /Import 2 entries/ }).click();
    await expect(page.getByText(/Saved 2 meals/)).toBeVisible();

    await page.goto('/entries');
    await page.getByRole('button', { name: 'Today' }).click();
    await page.locator('#search').fill('imported khichdi');
    await expect(page.locator('table').getByText('E2E imported khichdi')).toBeVisible();
  });

  test('AI extraction endpoint and chat surface exist', async ({ page, request }) => {
    await page.goto('/log');
    const status = await request.get(`${API}/ai/status`, {
      headers: { Authorization: `Bearer ${await tokenFromPage(page)}` },
    });
    expect(status.ok()).toBeTruthy();
    const { available } = (await status.json()) as { available: boolean };

    const extract = await request.post(`${API}/ai/extract`, {
      headers: { Authorization: `Bearer ${await tokenFromPage(page)}` },
    });
    expect(extract.status()).toBeGreaterThanOrEqual(400);

    await page.goto('/chat');
    if (available) {
      await expect(page.getByRole('heading', { name: 'Chat support' })).toBeVisible();
      await page.locator('#chat-message').fill('How am I doing against my calorie goal today?');
      await page.getByRole('button', { name: /Send/ }).click();
      await expect(page.getByText('How am I doing against my calorie goal today?')).toBeVisible();
      await expect(page.getByText('Thinking…')).toBeHidden({ timeout: 45_000 });
      await expect(page.getByRole('alert').or(page.getByText(/kcal|goal|logged|today/i)).first()).toBeVisible();
    } else {
      await expect(page.getByText(/Chat is switched off|Chat support/)).toBeVisible();
    }
  });

  test('isolation: a second user cannot see this diary', async ({ page, browser }) => {
    const other = await apiJson('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: otherEmail, password: PASSWORD, displayName: 'Other User' }),
    });

    const listed = await apiJson(`/entries?from=${todayKey()}&to=${todayKey()}`, {
      headers: { Authorization: `Bearer ${other.token}` },
    });
    expect(listed.meta.totalItems).toBe(0);

    const current = await apiJson(`/goals/current?date=${todayKey()}`, {
      headers: { Authorization: `Bearer ${other.token}` },
    });
    expect(current.goal).toBeNull();

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page.getByText('E2E oatmeal').first()).toBeVisible();

    const guest = await browser.newContext();
    const loginPage = await guest.newPage();
    await loginPage.goto('/login');
    await loginPage.locator('#email').fill(email);
    await loginPage.locator('#password').fill(PASSWORD);
    await loginPage.getByRole('button', { name: 'Sign in' }).click();
    await expect(loginPage.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(loginPage.getByText('E2E oatmeal').first()).toBeVisible();
    await guest.close();
  });
});
