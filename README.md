# Compliance & Privacy Investigation Assistant

A Vite + React + Supabase Edge Function app that helps turn de-identified investigation notes into a structured compliance/privacy investigative report.

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

Set these in Supabase, not in the frontend `.env` file:

```sh
ANTHROPIC_API_KEY=your_anthropic_key
ANTHROPIC_MODEL=claude-sonnet-4-20250514
ALLOWED_ORIGINS=http://localhost:8080,https://your-domain.com
```

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
