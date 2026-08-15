import { createApp } from '../src/app.js';
import type { Server } from 'node:http';
import assert from 'node:assert/strict';

export const PASSWORD = 'supersecret1';

export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function daysAgoKey(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return todayKey(date);
}

export async function startApi() {
  const app = createApp();
  const server = app.listen(0, '127.0.0.1') as Server;

  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve());
    server.once('error', reject);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not bind a port.');
  }

  return {
    base: `http://127.0.0.1:${address.port}/api`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

export async function request(
  base: string,
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    form?: FormData;
  } = {},
) {
  const headers: Record<string, string> = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${base}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  return { status: response.status, data, headers: response.headers };
}

export async function signup(base: string, displayName = 'Tester') {
  const email = `${displayName.toLowerCase().replace(/\s+/g, '')}.${Date.now()}.${Math.random()
    .toString(16)
    .slice(2)}@example.com`;

  const { status, data } = await request(base, '/auth/signup', {
    method: 'POST',
    body: { email, password: PASSWORD, displayName },
  });

  assert.equal(status, 201, `signup failed: ${JSON.stringify(data)}`);

  return { email, token: data.token as string, user: data.user };
}

export function escapePdfText(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Minimal one-page PDF whose extracted text the import parser can read. */
export function buildDiaryPdf(lines: string[]) {
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
