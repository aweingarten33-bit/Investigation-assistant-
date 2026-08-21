# Compliance & Privacy Investigation Assistant

A Vite + React app with a small Node/Express API that helps turn de-identified investigation notes into a structured compliance/privacy investigative report — plus an Investigation Toolkit with AI letter drafting, AI case analysis, an AI recommendation engine, and a full investigator reference library (decision framework, HIPAA/CFR deadlines, interview scripts, COI toolkit).

## Important privacy note

This demo does **not** save reports anywhere — no database, no browser storage — but investigation notes are sent to this app's own server and then to Anthropic for analysis. Use anonymized/de-identified data only unless the production environment has been reviewed for HIPAA/privacy/security requirements and the appropriate agreements are in place.

## Architecture

One app, two processes in dev, one process in production:

- **Frontend** — Vite + React, built to static files (`dist/`).
- **API** — a small Express server (`server/`) that calls Anthropic. It's the
  only thing that ever sees `ANTHROPIC_API_KEY`; the browser never talks to
  Anthropic directly.

In production, `server/index.js` serves both — the built frontend as static
files and the two API routes — from a single process on a single origin. No
CORS, no third-party backend account, no client-exposed credentials beyond
the app's own URL. (This app was originally scaffolded with Supabase Edge
Functions as the backend; that dependency has been removed — see AUDIT.md.)

## Local setup

You need two processes running:

```sh
npm install
cp .env.example .env    # then set ANTHROPIC_API_KEY

npm run dev:server   # the API, on :3000
npm run dev          # the frontend, on :8080 — proxies /api to :3000
```

Open `http://localhost:8080`.

## Environment variables

Set these where the API process runs (locally: `.env`; in production: your
host's dashboard). None of them are needed by the frontend build.

The AI backend is provider-agnostic. Pick one with `AI_PROVIDER` (defaults
to `anthropic`) and set that provider's key + model — the other providers'
variables can stay unset:

```sh
AI_PROVIDER=anthropic                       # optional — anthropic (default) | openai | gemini

ANTHROPIC_API_KEY=your_anthropic_key        # required if AI_PROVIDER=anthropic
ANTHROPIC_MODEL=claude-sonnet-5             # optional, has a default

OPENAI_API_KEY=your_openai_key              # required if AI_PROVIDER=openai
OPENAI_MODEL=gpt-4o                         # required if AI_PROVIDER=openai — no default, on purpose (see below)

GEMINI_API_KEY=your_google_ai_key           # required if AI_PROVIDER=gemini
GEMINI_MODEL=gemini-2.0-flash               # required if AI_PROVIDER=gemini — no default, on purpose (see below)

CLASSIFICATION_SIGNING_SECRET=...           # optional, falls back to whichever provider key is set
PORT=3000                                   # optional, Render sets this itself
```

`OPENAI_MODEL`/`GEMINI_MODEL` have no built-in fallback. The original
`ANTHROPIC_MODEL` default shipped with this app was a guessed value that
turned out not to be a real model — every call silently 400'd until someone
actually tried it against a live key. Rather than repeat that for two more
providers, those two are required: get the exact model id from your
provider's own docs/dashboard and set it explicitly.

## Deploying (Render)

One service, one deploy:

1. Push this repo to GitHub (if it isn't already).
2. In the Render dashboard: **New > Blueprint**, connect the repo. Render
   reads `render.yaml` at the repo root and configures the service
   automatically — build (`npm ci && npm run build`), start
   (`npm start`, which runs `node server/index.js`).
3. Render will prompt for every var marked `sync: false` in `render.yaml`
   (see Environment variables above). You only need to fill in the key +
   model for whichever `AI_PROVIDER` you're using — leave the rest blank.
   These are runtime server secrets, never baked into the frontend bundle.
4. Deploy. Render gives you a `*.onrender.com` URL serving the whole app.

For later pushes: Blueprint-created services don't always auto-redeploy
reliably on every push — if a push doesn't show up, go to the Blueprint
page in Render and click **Manual Sync**.

## Investigation Toolkit

The `/toolkit` route (linked from the top-right of the home page, and from
"Draft Notification Letter" once a report is generated) adds:

- **AI Letter Generator** — drafts determination/notification letters
  (HR referral memo, counseling memo through termination, plus closure,
  reporter-update, and self-disclosure templates) from a case summary.
  Pre-fills from a just-generated report or from AI Recommendation.
- **AI Case Analysis** — a quick preliminary read (root cause, HIPAA exposure,
  risk level, next steps) from raw case facts, useful before there's enough
  for a full report.
- **AI Recommendation** — once you're done investigating, paste in what you
  found and get the same classification/discipline-tier determination the
  full Report Generator produces, plus who to notify and in what order.
- **Investigation Guide, Regulatory Deadlines, Interview Templates, Decision
  Framework, Conflict of Interest** — a static, HIPAA-focused investigator
  reference library. No AI calls, no data leaves the browser.

All AI tools run through `server/routes/analyze-report.js` and
`server/routes/investigation-toolkit.js`, which carry forward the same
hardening the original Supabase functions had (best-effort per-IP rate
limiting, a hard request-body byte cap, strict input validation, HMAC-signed
classification integrity) — see AUDIT.md. Same-origin deployment also means
there's no CORS allowlist to maintain anymore.

## Scripts

```sh
npm run dev          # frontend (Vite dev server, :8080)
npm run dev:server   # API (Node, :3000) — run alongside npm run dev
npm run build        # build the frontend to dist/
npm start            # production: node server/index.js (serves dist/ + API)
npm run lint
npm run test
npm run preview      # preview the built frontend only, without the API
```

## Fixed in this version

- Added missing React type imports that can break TypeScript builds.
- Disabled unnecessary auth session persistence because this app does not use login. *(historical — predates the Supabase removal below)*
- Added frontend length validation before invoking the AI function.
- Hardened the backend with method checks, JSON validation, request size limits, and clearer upstream AI errors.
- Replaced Lovable-specific Playwright config imports with standard `@playwright/test` config.
- Corrected privacy/disclaimer language so it does not overpromise that data is never sent or shared.
- Removed the Supabase Edge Function dependency entirely — the AI backend is now a small Express server in `server/`, deployed alongside the frontend as a single Render service. See AUDIT.md for what changed and why the security properties still hold.
