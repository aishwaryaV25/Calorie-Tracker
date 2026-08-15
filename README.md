# Personal Calorie Tracker

Full-stack app for logging meals, setting nutrition goals, and reading macro / micronutrient trends. The web app talks to the API only over HTTP. Food entries, goals, and users live in Postgres (Neon).

## Requirements

Two processes: the Express API on port 4000 and the Next.js app on port 3000.

- Node.js 20+
- npm
- A [Neon](https://console.neon.tech) Postgres project

## Setup

### 1. Create the Neon project

On the Neon welcome screen:

1. Project name: `Calorie-Tracker`
2. Postgres 18 is fine
3. Pick a region close to you
4. Leave **Neon Auth off** — this app already has signup/login
5. Click **Create project**

### 2. Copy both connection strings

In Neon → **Dashboard → Connection details**:

- **Pooled connection** (host contains `-pooler`) → `DATABASE_URL`
- **Direct connection** (host has no `-pooler`) → `DIRECT_URL`

Both should end with `?sslmode=require`. Prisma uses the pooled URL for queries and the direct URL for migrations.

### 3. Run the apps

```bash
# API
cd server
cp .env.example .env
# paste DATABASE_URL and DIRECT_URL into .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

```bash
# Web (second terminal)
cd web
echo 'NEXT_PUBLIC_API_URL=http://localhost:4000/api' > .env.local
npm install
unset PORT && npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up, set a goal, then log a meal.

`unset PORT` matters if the API `.env` exported `PORT=4000` into your shell — Next would otherwise try to bind that same port.

Local SQLite diaries are not imported. After switching to Neon, create a new account in the app.

## Tests

From the repo root:

```bash
npm test          # unit tests + API regression — this is the PR gate
npm run test:e2e  # local Playwright walkthrough (not run in CI)
```

`npm test` is what GitHub Actions runs on every push and pull request. It covers dates, pagination, nutrition, AI sanitising, PDF parsing, and HTTP CRUD against Postgres (`DATABASE_URL` in `server/.env`, or the CI Postgres service).

Playwright (`web/e2e`) is a local UI check only. It is not part of the production test gate.

## What is implemented

| Assignment item | Where |
| --- | --- |
| Goal setting (calories, P/C/F, optional weight) | `/goals` · `POST/GET/DELETE /api/goals` |
| Meal entries (name, qty, calories, macros, micros) | `/log`, `/entries` · `/api/entries` |
| Time-range listing, date + meal filters, pagination | `/entries` · `GET /api/entries` |
| Reports: daily trend, weekly totals, macro split, micros, goal vs actual | `/reports` · `/api/reports/*` |
| AI photo extract (label or plate) | `/log` · `POST /api/ai/extract` |
| Chat assistant (agentic tools + pending choices) | `/chat` · `POST /api/ai/chat` |
| Multi-user signup / login / isolation | `/signup`, `/login` · `/api/auth` |
| Bulk PDF import | `/import` · `/api/imports` |

AI routes return a clear 503 when `AI_API_KEY` is unset. The rest of the app still works.

## Assumptions

- Meal types are breakfast, lunch, dinner, and snacks.
- Goals are versioned by `effectiveFrom`. Saving again on the same day replaces that version so reports still compare a past day to the targets that were in force then.
- A calendar day is the user's local day (`YYYY-MM-DD`), not the server's UTC day.
- Micronutrients are an open-ended list of named amounts, not fixed columns.
- PDF import tries a local table parser first. Deep Analyse (Gemini) is optional.
- The frontend never imports server code. `NEXT_PUBLIC_API_URL` is the only coupling.

## Deploy (Vercel + Render)

The web app goes on **Vercel**. The API goes on **Render** (free web service, no card). Postgres stays on **Neon** — do not create a Render database.

Render’s free instance sleeps after 15 minutes idle and takes about a minute to wake. That is fine for a first deploy. GCP Cloud Run is nicer when you already have a billing account; it is not worth opening one just for this.

### 1. API on Render

1. Push this repo to GitHub.
2. [Render](https://dashboard.render.com) → **New** → **Web Service** → this repo.
3. Set **Root Directory** to `server`, instance type **Free**.
4. Build `npm ci --include=dev && npm run build`, start `npm run start:prod`.
5. Health check path: `/api/health`.
6. Add environment variables (same names as `server/.env.example`):

| Name | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon **pooled** URI |
| `DIRECT_URL` | Neon **direct** URI |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `CORS_ORIGIN` | your Vercel origin, e.g. `https://your-app.vercel.app` |
| `AI_*` / `GEMINI_*` | copy from local `.env` if you want chat and photo extract live |

`PORT` is set by Render. Do not add it.

The first deploy can use `CORS_ORIGIN=http://localhost:3000` so the service boots; switch it to the Vercel URL after step 2 and restart the service.

### 2. Web on Vercel

1. [Vercel](https://vercel.com) → **Add New** → **Project** → this repo.
2. **Root Directory**: `web`.
3. Framework: Next.js (detected).
4. Environment variable:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://<your-render-service>.onrender.com/api` |

5. Deploy. Then set `CORS_ORIGIN` on Render to the Vercel origin (`https://….vercel.app`, no trailing slash, no `/api`) and restart the API.

Open the Vercel URL, sign up, and log a meal. The first API call after idle may take ~30–60 seconds while Render wakes up.
