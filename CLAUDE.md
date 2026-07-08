# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A Vite + React + TypeScript single-page app that turns de-identified HIPAA
compliance/privacy investigation notes into a structured investigative report.
The frontend never calls Anthropic directly — all AI calls go through a single
Supabase Edge Function (`supabase/functions/analyze-report/index.ts`), which
talks to the Claude Messages API.

**Privacy note baked into the product itself**: the app does not persist
reports client-side and has no database write path, but notes are sent to the
Edge Function and then to Anthropic. Treat any change that adds storage,
logging of note contents, or third-party calls as privacy-sensitive.

## Commands

```sh
npm install
cp .env.example .env      # fill in VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev                # Vite dev server on :8080
npm run build               # production build
npm run build:dev           # build with --mode development (keeps lovable-tagger)
npm run preview              # preview a production build
npm run lint                # eslint .
npm run test                 # vitest run (single pass, CI mode)
npm run test:watch          # vitest watch mode
```

- Run a single test file: `npx vitest run src/test/example.test.ts`
- Run tests matching a name: `npx vitest run -t "should pass"`
- E2E: no npm script is wired up; run Playwright directly with `npx playwright test` (config: `playwright.config.ts`, spec dir `src/test`, auto-starts `npm run dev` on port 8080). Import `test`/`expect` from `playwright-fixture.ts`, not `@playwright/test` directly, in new specs.
- Vitest config (`vitest.config.ts`) only picks up `src/**/*.{test,spec}.{ts,tsx}`, uses `jsdom`, and loads `src/test/setup.ts` (stubs `window.matchMedia`).

The Supabase Edge Function has its own runtime (Deno) and is not covered by
`npm run test`/`vitest` — it isn't unit tested; validate it via `supabase
functions serve` or by deploying to a dev project.

## Architecture

### Two-step, signed Claude flow (the core design to preserve)

The analysis is deliberately split into two round-trips to the Edge Function,
both hitting `supabase/functions/analyze-report/index.ts` with
`{ reportText, step }`:

1. **`step: "classify"`** — Claude classifies the notes (decision, riskLevel,
   recommendationTier, aggravating/mitigating factors, etc. — see
   `classificationSchema`). The function HMAC-signs the classification
   (`signClassification`, SHA-256, key from `CLASSIFICATION_SIGNING_SECRET`
   falling back to `ANTHROPIC_API_KEY`) and returns `{ classification,
   signature }`.
2. **`step: "report"`** — The client sends the classification and signature
   back. The server re-validates the shape (`isValidClassificationShape`),
   re-derives the expected signature, and compares it with
   `timingSafeEqual` before using the classification to build the report
   prompt (`buildReportPrompt`). Only on success does it call Claude again to
   generate the report (`reportSchema`).

This exists so a client cannot forge fields like `recommendationTier` (e.g.
escalate to `recommend_termination`) between the two calls, and so unvalidated
client data never reaches `buildReportPrompt`'s string interpolation (prompt
injection). **Any change to the classification shape must update all three
of**: `classificationSchema`, `isValidClassificationShape`, and
`src/lib/types.ts#AnalysisResult` — they must stay in sync or step 2 will
reject valid classifications or accept invalid ones.

Frontend orchestration of these two calls lives in `src/pages/Index.tsx`
(`handleAnalyze`). It uses a **monotonic `runIdRef` counter**, not a boolean,
to guard against stale-async-result races: cancelling or resetting increments
the ref, and any in-flight `.then`/`finally` checks `runIdRef.current !==
myRunId` before touching state. Keep this pattern for any new async flow in
that component instead of a cancelled/aborted boolean flag.

### Request hardening in the Edge Function

`supabase/functions/analyze-report/index.ts` layers several defenses in a
specific order — preserve the order when editing:

1. CORS preflight / method check.
2. Per-IP best-effort rate limit (`isRateLimited`, 20/min, in-memory —
   documented as not a substitute for gateway-level limits).
3. Fast `Content-Length` reject, then `readBodyWithLimit` streams the body
   with a hard byte cap (`MAX_BODY_BYTES`) so chunked/spoofed-header bodies
   can't exhaust memory before the text-length check runs.
4. JSON parse, then `reportText` length/type validation.
5. Per-step validation as described above.

`getAllowedOrigin` returns `"null"` (not the request origin) for unrecognized
origins when `ALLOWED_ORIGINS` is configured, so browsers reject the response
and `Vary: Origin` caching semantics stay correct — don't "fix" this to
reflect an origin unconditionally.

### Frontend structure

- `src/pages/Index.tsx` — the entire app's flow lives here: upload/paste →
  analyze (2-step) → results → export. It's a single large page component by
  design (see `AUDIT.md`), not split into a router of steps.
- `src/components/` — feature components (`UploadZone`, `AnalysisResults`,
  `Disclaimer`, `PiiReminder`, `StepsIndicator`); `src/components/ui/` is
  shadcn/ui-generated primitives (config in `components.json`, base color
  `slate`, path aliases `@/components`, `@/lib`, `@/hooks`) — treat these as
  generated/vendored, not hand-authored.
- `src/integrations/supabase/client.ts` — the Supabase client **does not
  throw at module load** if env vars are missing (a top-level throw would
  escape React error boundaries and blank-screen the app). Instead it exports
  `isSupabaseConfigured` and falls back to placeholder URL/key; callers (e.g.
  `handleAnalyze`) must check `isSupabaseConfigured` before invoking
  functions. Auth session persistence is deliberately disabled
  (`persistSession: false`) — this app has no login.
- `src/lib/docx-export.ts` — builds the exported Word report via `docx` +
  `file-saver`. `src/lib/pdf-export.ts` exists but is not wired into the UI
  (only `.docx` export is exposed from `Index.tsx`).
- `src/lib/types.ts` — `AnalysisResult` is the single shape spanning
  classification + report + client-added `caseId`; keep it in sync with both
  Edge Function schemas (see above).
- Path alias `@/*` → `src/*` (configured in both `vite.config.ts` and
  `vitest.config.ts`).

### Environment / secrets split

- Frontend (`.env`, `VITE_*` prefix required by Vite): `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Supabase Edge Function secrets (set in the Supabase dashboard, **never** in
  frontend `.env`): `ANTHROPIC_API_KEY` (required), `ANTHROPIC_MODEL`
  (defaults to `claude-sonnet-4-6` in code — README mentions
  `claude-sonnet-4-20250514`, check which is actually deployed before
  assuming), `ALLOWED_ORIGINS`, `CLASSIFICATION_SIGNING_SECRET`.
- Deploy target is Vercel (`vercel.json` — SPA rewrite to `index.html`); the
  app was moved to the repo root specifically for zero-config Vercel deploys.

## Notable history

`AUDIT.md` documents a full security/correctness audit (auth/rate-limiting,
HMAC integrity binding, prompt-injection hardening, race conditions, CORS
origin handling, body-size streaming limits) with a findings table mapping
each issue to its fix location — read it before changing anything in the
Edge Function or the analyze flow, since it explains *why* the current code
looks the way it does. It also lists residual/accepted risks (e.g. the
in-function rate limiter is per-instance/best-effort, PHI is transmitted
twice per analysis, `deno.land/std@0.168.0` is a pinned 2022 release).
