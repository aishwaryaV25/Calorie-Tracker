# Personal Calorie Tracker

Full-stack app for logging meals, setting nutrition goals, and reading macro / micronutrient trends. The web app talks to the API only over HTTP. Food entries, goals, and users live in SQLite.

## Requirements

Two processes: the Express API on port 4000 and the Next.js app on port 3000.

- Node.js 20+
- npm

## Setup

```bash
# API
cd server
cp .env.example .env
npm install
npx prisma migrate dev
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

## Tests

From the repo root:

```bash
npm test          # unit tests + API regression (isolated test.db)
npm run test:e2e  # browser CRUD (starts API + web if they are not already up)
npm run test:all  # both
```

`npm test` does not touch `server/prisma/dev.db`. The API suite boots Express in-process against `prisma/test.db`, so a failing change is caught without a running server.

The UI suite covers signup, goals, meal CRUD, filters, pagination, reports, PDF import, chat, and user isolation. GitHub Actions runs the same commands on every push.

## What is implemented

| Assignment item | Where |
| --- | --- |
| Goal setting (calories, P/C/F, optional weight) | `/goals` · `POST/GET/DELETE /api/goals` |
| Meal entries (name, qty, calories, macros, micros) | `/log`, `/entries` · `/api/entries` |
| Time-range listing, date + meal filters, pagination | `/entries` · `GET /api/entries` |
| Reports: daily trend, weekly totals, macro split, micros, goal vs actual | `/reports` · `/api/reports/*` |
| AI photo extract (label or plate) | `/log` · `POST /api/ai/extract` |
| Chat assistant | `/chat` · `POST /api/ai/chat` |
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
