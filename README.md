# Personal Calorie Tracker

Live: [https://calorie-tracker-ochre-eight.vercel.app](https://calorie-tracker-ochre-eight.vercel.app)

Log meals, set calorie and macro goals, track weight, and read reports. The Next.js app talks to the Express API only. Data lives in Neon Postgres.

The first load after idle can take about a minute while the API wakes up.

## Run locally

Needs Node 20+ and a [Neon](https://console.neon.tech) Postgres project. Skip Neon Auth. Copy both connection strings (pooled → `DATABASE_URL`, direct → `DIRECT_URL`). Both should end with `?sslmode=require`.

```bash
cd server
cp .env.example .env
# paste DATABASE_URL, DIRECT_URL, and a long JWT_SECRET
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

```bash
cd web
cp .env.example .env.local
npm install
unset PORT && npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up, set a goal, log a meal.

`unset PORT` matters if the API `.env` leaked `PORT=4000` into the shell. Next would otherwise try to bind that same port.

## Tests

```bash
npm test
```

That is the GitHub Actions gate: unit tests plus API tests against Postgres (`DATABASE_URL` in `server/.env`, or the CI Postgres service).

## What is in the app

| Assignment | Where |
| --- | --- |
| Goal setting (calories, P/C/F, optional weight) | `/goals` · `POST/GET/DELETE /api/goals` |
| Meal entries (name, qty, calories, macros, micros) | `/log`, `/entries` · `/api/entries` |
| Time-range listing, filters, pagination | `/entries` · `GET /api/entries` |
| Reports: daily, weekly, macros, micros, goal vs actual | `/reports` · `/api/reports/*` |
| AI photo extract (label or plate) | `/log` · `POST /api/ai/extract` |
| Chat assistant | `/chat` · `POST /api/ai/chat` |
| Multi-user signup / login / isolation | `/signup`, `/login` · `/api/auth` |
| Bulk PDF import | `/import` · `/api/imports` |
| Weight tracker | `/weight` · `/api/weights` |

Photo extract uses `AI_API_KEY`. Chat and PDF Deep Analyse use `GEMINI_API_KEY`. Either can be unset; that feature returns 503 and the rest of the app still works.

## Assumptions

- Meal types are breakfast, lunch, dinner, and snacks.
- Goals are versioned by `effectiveFrom`. Saving again on the same day replaces that version, so reports still compare a past day to the targets that were in force then.
- A calendar day is the user's local day (`YYYY-MM-DD`), not the server's UTC day.
- One weigh-in per calendar day. Saving again that day replaces it.
- Micronutrients are an open-ended list of named amounts, not fixed columns.
- PDF import tries a local table parser first. Deep Analyse (Gemini) is optional.
- Bite is read-only. Chat Support is the agent that can write.
- The frontend never imports server code. `NEXT_PUBLIC_API_URL` is the only coupling.

## Deploy

Web is on Vercel. API is on Render (free). Postgres stays on Neon. Do not add a Render database.

Secrets live in the dashboards, not in git. Copy names from `server/.env.example` and `web/.env.example`.

### API (Render)

Root directory `server`. Health check `/api/health`. Build `npm ci --include=dev && npm run build`. Start `npm run start:prod`. Set `NODE_ENV=production`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CORS_ORIGIN` (the Vercel origin, no trailing slash), and the AI keys if you want those features live. Do not set `PORT`.

### Web (Vercel)

Root directory `web`. Set `NEXT_PUBLIC_API_URL` to `https://<render-service>.onrender.com/api` and `API_UPSTREAM` to `https://<render-service>.onrender.com`. Those are baked in at build time, so redeploy after changing them.

Turn off Vercel Deployment Protection on production so visitors see this app's login, not Vercel's.
