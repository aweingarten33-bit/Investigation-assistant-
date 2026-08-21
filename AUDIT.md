# Security & Code Audit — Investigation Assistant

_Audit date: 2026-06-02_

This document records the findings of a multi-angle review of the application
(React + Vite frontend, Node/Express backend, Claude API) and the fixes
applied in the same change set. The backend originally ran on Supabase Edge
Functions; see the 2026-08-21 addendum below for the migration off Supabase
and why the findings below still apply unchanged to the Express port.

## Architecture

1. User pastes or uploads (`.docx`) investigation notes (potential PHI/PII).
2. Frontend calls this app's own API route, `POST /api/analyze-report`.
3. The server calls Claude twice: **classify** → **generate report**.
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
- ~~`ALLOWED_ORIGINS`~~ — removed in the 2026-08-21 migration below. The
  frontend and API are now served from the same origin, so there's no CORS
  surface to allowlist.

## Addendum: Investigation Toolkit (2026-08-21)

Added `supabase/functions/investigation-toolkit/index.ts` for the AI Letter
Generator and AI Case Analysis tools, following the same hardening pattern as
`analyze-report`: origin allowlist (`ALLOWED_ORIGINS`), a `Vary: Origin` +
`"null"`-for-unrecognized-origin CORS response, best-effort per-IP rate
limiting (20/min, separate bucket from `analyze-report`), a hard request-body
byte cap enforced while streaming (not just via `Content-Length`), POST-only,
and strict input validation (letter type against a fixed enum, min/max length
checks on free-text fields) before any field reaches the Claude prompt. No new
secrets — reuses `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`. Unlike
`analyze-report`, this function has no multi-step state to sign (each call is
a single, independent request), so there's no HMAC/integrity step to carry
over. `analyze-report` itself was left untouched by this change.

## Addendum: Removed the Supabase dependency (2026-08-21)

The app originally used Supabase for exactly one thing — hosting the two
Edge Functions above as a way to call Anthropic without exposing the API key
in the browser. It had no auth, no database, no storage; Supabase was purely
a serverless-functions host, a byproduct of the original Lovable scaffold
rather than a deliberate requirement. Replaced with a small Express server
(`server/`) that serves both the built frontend and the two API routes from
a single process/origin, deployed as one Render service.

What changed, and why the findings above still hold:

- **`supabase/functions/analyze-report/index.ts`** → `server/routes/analyze-report.js`.
  Ported line-for-line: same classification/report prompts, same
  `classificationSchema`/`reportSchema`, same HMAC signing and constant-time
  verification (`node:crypto`'s Web Crypto `crypto.subtle` instead of Deno's —
  same API), same `isValidClassificationShape` defense-in-depth, same
  `MAX_REPORT_TEXT_LENGTH` (100,000 chars).
- **`supabase/functions/investigation-toolkit/index.ts`** → `server/routes/investigation-toolkit.js`.
  Same port: same `LETTER_TYPES` (now including `hr_referral`), same prompts,
  same length bounds.
- **Body-size cap**: Express's `express.json({ limit })` enforces the byte
  cap while reading the request stream (via the `raw-body` package), not
  just via a `Content-Length` header check — the same property the hand-
  rolled `readBodyWithLimit` was providing in the Deno version. Limits are
  unchanged (`MAX_BODY_BYTES` per route, same formula as before).
- **Rate limiting**: same per-IP, in-memory, sliding-window logic
  (`createRateLimiter`), but now running in a persistent Node process
  instead of ephemeral, independently-scaled Deno edge instances. This
  makes it a **stronger** guarantee than before, not a weaker one — see the
  updated residual-risk note below.
- **CORS**: eliminated, not hardened-and-kept. Same-origin means there's no
  cross-origin request to allow or deny in the first place; `ALLOWED_ORIGINS`
  is gone (see Configuration notes above).
- **`ANTHROPIC_API_KEY`**: still server-only, never sent to or readable by
  the browser. Same trust boundary as before, just a different process
  holding it.

## Addendum: Multi-provider AI backend (2026-08-21)

Added OpenAI and Gemini as selectable alternatives to Anthropic
(`AI_PROVIDER=anthropic|openai|gemini`), motivated by a real outage: the
account's Anthropic API access was unavailable, and there was no way to
keep testing without a second provider to fall back to.

- `server/lib/{anthropic,openai,gemini}.js` each implement the same two-
  function interface (`callStructured`, `callText`); `server/lib/ai.js`
  dispatches to whichever is selected. Routes call the dispatcher only —
  no provider-specific code left in `server/routes/*`.
- Each provider module owns its own key/model config and validates it
  independently (clear `HttpError` if missing) rather than the route
  hardcoding a single `ANTHROPIC_API_KEY` check, which is what this
  replaces.
- **Deliberately no default model for OpenAI or Gemini.** The prior
  `ANTHROPIC_MODEL` default (`claude-sonnet-4-6`) was a guessed value that
  was never actually valid — it shipped silently broken until someone hit
  it with a real key (see the earlier fix in this history). Repeating that
  guess for two more providers was the obvious wrong move immediately
  after diagnosing it; `OPENAI_MODEL`/`GEMINI_MODEL` are required with no
  fallback, so a missing model fails loudly and immediately instead of
  looking like a working configuration.
- **Error messages from all three providers now reach the user directly**
  (`"<Provider> error (<status>): <their message>"`), not just server
  logs — the previous opaque `"AI analysis failed (400)"` was the actual
  bottleneck in diagnosing the Anthropic outage that motivated this whole
  change; multiplying that opacity across three providers would have made
  the next failure worse, not better.
- `CLASSIFICATION_SIGNING_SECRET`'s fallback chain now checks all three
  provider keys, not just `ANTHROPIC_API_KEY` — previously, running with
  only `OPENAI_API_KEY` or `GEMINI_API_KEY` set would have left the HMAC
  signing key silently empty. A startup log now warns loudly if no secret
  can be derived at all.
- **Gemini confirmed against live traffic (same day, real account).** The
  `describeError` path did exactly what it was built for: a live
  `generateContent` call against a real key returned a 404 for
  `gemini-2.5-flash` ("no longer available to new users"), and Google's
  own error body — surfaced verbatim through this app's error handling,
  not just server logs — named the replacement (`gemini-3.6-flash`)
  directly. No debugging beyond reading the toast was needed. Updated the
  `GEMINI_MODEL` example in README.md/.env.example accordingly.
- **OpenAI still unverified against live traffic** — no working key
  available to test with in the environment this was built in. Verified
  instead: correct routing per `AI_PROVIDER`, correct missing-config
  errors, and a live non-2xx response (a network-proxy rejection, not a
  real OpenAI response) confirming the fetch/error-parsing path doesn't
  crash end to end. The request/response shapes are implemented per
  OpenAI's public docs but unexercised against a real account. Treat the
  first real use of `openai` as the actual test — the error-surfacing
  work proven out on the Gemini path above means a wrong `OPENAI_MODEL`
  should be similarly self-diagnosing from the toast alone.

## Addendum: Live web-search grounding for recommendations (2026-08-21)

Added a grounding pass before the classification step (`analyze-report.js`,
`step: "classify"` — used by both the AI Recommendation tool and the full
Report Generator) so the severity/discipline-tier determination is checked
against current information instead of relying solely on the model's
training-data recall. Motivated directly by the user asking, in effect,
"is this recommendation based on Reddit?" — a fair question the app had no
good answer to before this.

- `server/lib/{anthropic,gemini}.js` each add `callTextWithSearch`, using
  the provider's native web-search tool (`web_search_20250305` for
  Anthropic — the basic variant, chosen over `_20260209`'s dynamic
  filtering since `ANTHROPIC_MODEL` is user-configured and not guaranteed
  to support it; `google_search` for Gemini). Both return `{ text, sources }`
  in a single request — these are server-side tools, no client-side loop.
- `server/lib/openai.js` adds the same function but gated: OpenAI's Chat
  Completions API (which this app uses) has no optional/toggleable
  web-search tool for arbitrary models — search is instead baked into
  specific `-search-preview` models that always search. If `OPENAI_MODEL`
  isn't one of those, `callTextWithSearch` throws a clear `HttpError`
  rather than silently returning an ungrounded result. True toggleable
  search on any OpenAI model requires the separate Responses API — a
  different request/response shape from Chat Completions — which is out of
  scope here; see the comment in `openai.js`.
- **The grounding search never sees case-identifying details on purpose.**
  It's a separate `callTextWithSearch` call with its own prompt
  (`RESEARCH_PROMPT`), scoped to "search on the violation type only, never
  on names/employer/dates" and told explicitly to research general
  regulatory/industry-practice background, not this specific case. This
  matters because a search query is a different exposure surface than an
  LLM inference call — it can hit the provider's search backend/index, not
  just the model.
- **Forced tool-choice and server-side search don't mix safely in one
  call**, so grounding is a genuinely separate step, not a tool bolted onto
  the existing classification call. The classification step still uses
  `tool_choice: {type: "tool", ...}` to force the structured JSON schema
  back, completely unchanged from before — the grounding research result
  (if any) is generated first, then folded into the classification
  prompt's user message as a clearly-labeled "CURRENT REGULATORY CONTEXT"
  section, with `CLASSIFICATION_PROMPT` explicitly told that section is
  background, not a case fact, and never overrides what's in the notes.
- **Soft-fail, not a blocker.** `researchContext()` in `analyze-report.js`
  catches any grounding failure (missing search support, rate limit,
  provider error) and logs it, then proceeds with classification exactly as
  it worked before this change. A user should never see "recommendation
  failed" because search was down.
- **Sources are shown, not hidden.** `sources` is returned as a sibling
  field on the classify response (outside the HMAC-signed `classification`
  object, so the existing integrity check — see the addendum above — is
  completely untouched) and rendered in `ClassificationSummary.tsx` as a
  "Grounded in live search" list of clickable links. Both AI Recommendation
  and the full Report Generator show it.
- Verified via unit-style tests against the exact documented response
  shapes (Anthropic's `web_search_tool_result`/`web_search_result` blocks,
  Gemini's `groundingMetadata.groundingChunks`) and an end-to-end mocked-
  fetch run of the actual Express route handler confirming: (1) the
  grounding text is injected into the classification prompt when search
  succeeds, (2) classification still returns 200 with an empty `sources`
  array when search fails, and (3) the HMAC signature is computed only over
  the classification object, unaffected by sources either way.

## Residual risks (not addressed here)

- **Cost protection** still ultimately benefits from a gateway/WAF-level
  limit for defense-in-depth, but the in-process limiter is no longer purely
  best-effort the way the per-instance Deno version was — a single Render
  service means one shared limiter sees all traffic, not a fragmented view
  across cold-started instances. Horizontal scaling (multiple Render
  instances) would reintroduce the old per-instance caveat; this app runs as
  a single instance.
- **PHI is transmitted twice** (once per step). A server-side session/token
  pattern would halve over-the-wire exposure.
- **No database migration risk was introduced** by this change — there was
  never a database. If a future feature adds one, it needs its own review
  (RLS/access-control design), not inherited from this migration.
