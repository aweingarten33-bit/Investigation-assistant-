# Security & Code Audit — Investigation Assistant

_Audit date: 2026-06-02_

This document records the findings of a multi-angle review of the application
(React + Vite frontend, Supabase Edge Function backend, Claude API) and the
fixes applied in the same change set.

## Architecture

1. User pastes or uploads (`.docx`) investigation notes (potential PHI/PII).
2. Frontend invokes the Supabase Edge Function `analyze-report`.
3. The function calls Claude twice: **classify** → **generate report**.
4. Results are rendered and exported to Word (`.docx`).

## Findings & Fixes

Severity tiers: **Critical** = trust/integrity/cost; **High** = crash/UX-break;
**Medium/Low** = robustness & resilience.

| # | Severity | Location | Issue | Fix |
|---|----------|----------|-------|-----|
| 1 | Critical | `supabase/functions/analyze-report/index.ts` | No auth or rate limiting — anyone with the bundled anon key could trigger unlimited paid Claude calls. | Added best-effort per-IP rate limiting (`20/min`). Documented that hard limits belong at the gateway/WAF. |
| 2 | Critical | `index.ts` (report step) / `src/pages/Index.tsx` | The step-1 classification round-trips through the client into step 2 with no integrity binding; an attacker could forge `recommendationTier` (e.g. → `recommend_termination`). | Server now **HMAC-signs** the classification (`SHA-256`) and verifies the signature (constant-time) on step 2. The client passes the signature through. |
| 3 | Critical | `index.ts` `buildReportPrompt` | Client-controlled classification fields were interpolated verbatim into the Claude **system prompt** (prompt injection). | Strict enum/type validation (`isValidClassificationShape`) + the HMAC check above reject adversarial payloads before prompt construction. |
| 4 | High | `index.ts` `buildReportPrompt:117` | `.toUpperCase()` / `.replace()` / `.length` on unvalidated fields threw a `TypeError` → 500 with leaked error text. | Same shape validation returns a clean `400` before any field access. |
| 5 | High | `src/pages/Index.tsx` analyze flow | Cancel-then-immediately-reanalyze race: the stale run's `finally` stomped the new run's loading state. | Replaced the boolean `abortRef` with a monotonic **run-id** counter; stale runs no-op. |
| 6 | Medium | `index.ts` `getAllowedOrigin:14` | Unrecognized origins received a *real* allowed origin in `Access-Control-Allow-Origin`, breaking cache (`Vary`) semantics and giving false security. | Return `"null"` for unrecognized origins. |
| 7 | Medium | `index.ts` request handling | Body size was validated **after** `req.json()` had already buffered the full body into memory. | Reject via `Content-Length` **before** parsing (`MAX_BODY_BYTES`). |
| 8 | Medium | `src/lib/docx-export.ts` / `Index.tsx` `handleExport` | `Packer.toBlob()` failure was an unhandled rejection — no user feedback. | Wrapped export in `try/catch` with an error toast. |
| 9 | Low | `src/integrations/supabase/client.ts` | Module-level `throw` on missing env vars escaped React error boundaries → blank white screen. | Replaced with a non-throwing `isSupabaseConfigured` flag + safe placeholders; the UI surfaces a handled error toast. |
| 10 | Low | `src/components/UploadZone.tsx` | After **Clear**, the tab stayed stuck on "Upload" instead of returning to "Paste". | `fileName` is now the single decider; falls back to the paste tab otherwise. |
| 11 | Low | `src/pages/Index.tsx` `handleFileSelect` | File validation checked only the `.docx` extension (a renamed payload passed). | Added a MIME-type guard as defense-in-depth. |

## Configuration notes

- `CLASSIFICATION_SIGNING_SECRET` (optional) — secret used to HMAC-sign the
  classification. Falls back to `ANTHROPIC_API_KEY` if unset. Set a dedicated
  secret in production.
- `ALLOWED_ORIGINS` — comma-separated origin allowlist for CORS. When unset,
  the function allows all origins (`*`) for pre-production convenience.

## Residual risks (not addressed here)

- **Cost protection** ultimately requires gateway-level rate limiting / auth;
  the in-function limiter is per-instance and best-effort only.
- **PHI is transmitted twice** (once per step). A server-side session/token
  pattern would halve over-the-wire exposure.
- **`deno.land/std@0.168.0`** is pinned to a 2022 release; consider upgrading.
