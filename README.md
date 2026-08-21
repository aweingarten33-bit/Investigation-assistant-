# Compliance & Privacy Investigation Assistant

A Vite + React + Supabase Edge Function app that helps turn de-identified investigation notes into a structured compliance/privacy investigative report — plus an Investigation Toolkit with AI letter drafting, AI case analysis, and a full investigator reference library (decision framework, HIPAA/CFR deadlines, interview scripts, COI toolkit).

## Important privacy note

This demo does **not** save reports in the browser or include a database write path, but investigation notes are sent to the Supabase Edge Function and then to Anthropic for analysis. Use anonymized/de-identified data only unless the production environment has been reviewed for HIPAA/privacy/security requirements and the appropriate agreements are in place.

## Local setup

```sh
npm install
cp .env.example .env
npm run dev
```

Then set your real Supabase values in `.env`.

## Supabase Edge Function secrets

Set these in Supabase, not in the frontend `.env` file. Both edge functions
(`analyze-report` and `investigation-toolkit`) read the same secrets — no
extra configuration is needed for the toolkit's AI tools.

```sh
ANTHROPIC_API_KEY=your_anthropic_key
ANTHROPIC_MODEL=claude-sonnet-4-20250514
ALLOWED_ORIGINS=http://localhost:8080,https://your-domain.com
```

## Deploying

There are two separate deploys — the static frontend and the Supabase Edge
Functions (the AI backend). Render hosts the frontend only; the edge
functions live on Supabase's own infrastructure regardless of where the
frontend is hosted.

**1. Deploy the Supabase Edge Functions** (do this first — the frontend needs a live backend to call):

```sh
npx supabase login
npx supabase link --project-ref your-project-id
npx supabase functions deploy analyze-report
npx supabase functions deploy investigation-toolkit
npx supabase secrets set ANTHROPIC_API_KEY=your_anthropic_key
npx supabase secrets set ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

**2. Deploy the frontend on Render:**

1. Push this repo to GitHub (if it isn't already).
2. In the Render dashboard: **New > Blueprint**, connect the repo. Render
   reads `render.yaml` at the repo root and configures the static site
   automatically (build command, publish directory, and the SPA rewrite
   so routes like `/toolkit` don't 404 on refresh).
3. Render will prompt for the three env vars marked `sync: false` in
   `render.yaml` — fill in your real Supabase values (same ones as
   `.env` locally): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
   `VITE_SUPABASE_PROJECT_ID`. These are baked into the build, not read at
   runtime, so changing them later requires a redeploy.
4. Deploy. Render gives you a `*.onrender.com` URL (or attach a custom
   domain in the service's Settings).
5. Back in Supabase, set `ALLOWED_ORIGINS` to that URL (comma-separated if
   you also keep `localhost` for dev) — `npx supabase secrets set
   ALLOWED_ORIGINS=https://your-app.onrender.com,http://localhost:8080` —
   then redeploy the two edge functions so the new CORS allowlist takes
   effect. Until you set this, the functions accept requests from any
   origin (`*`), which is fine for testing but not for production.

No `render.yaml` changes are needed for subsequent deploys — Render
redeploys automatically on every push to the connected branch.

## Investigation Toolkit

The `/toolkit` route (linked from the top-right of the home page, and from
"Draft Notification Letter" once a report is generated) adds:

- **AI Letter Generator** — drafts determination/notification letters (counseling
  memo through termination, plus closure, reporter-update, and self-disclosure
  templates) from a case summary. Pre-fills from a just-generated report.
- **AI Case Analysis** — a quick preliminary read (root cause, HIPAA exposure,
  risk level, next steps) from raw case facts, useful before there's enough
  for a full report.
- **Investigation Guide, Regulatory Deadlines, Interview Templates, Decision
  Framework, Conflict of Interest** — a static, HIPAA-focused investigator
  reference library. No AI calls, no data leaves the browser.

Both AI tools run through `supabase/functions/investigation-toolkit`, hardened
the same way as `analyze-report` (origin allowlist, per-IP rate limiting, a
hard request-body byte cap, and strict input validation) — see AUDIT.md.

## Scripts

```sh
npm run dev
npm run build
npm run lint
npm run test
npm run preview
```

## Fixed in this version

- Added missing React type imports that can break TypeScript builds.
- Made the Supabase client fail clearly if env vars are missing.
- Disabled unnecessary auth session persistence because this app does not use login.
- Added frontend length validation before invoking the AI function.
- Hardened the Supabase Edge Function with method checks, JSON validation, request size limits, better CORS handling, and clearer upstream AI errors.
- Replaced Lovable-specific Playwright config imports with standard `@playwright/test` config.
- Corrected privacy/disclaimer language so it does not overpromise that data is never sent or shared.
