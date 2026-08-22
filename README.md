# Compliance & Privacy Investigation Workbench

A React/Vite + Node/Express application for organizing healthcare compliance/privacy investigations, mapping findings to evidence, identifying contradictory evidence and missing information, generating a structured investigative report, and supporting human review of possible corrective actions.

This is intentionally **decision support, not an automated employment decision-maker**.

## What changed from the original Investigation Assistant

The product is no longer centered on "paste notes → AI writes a report." The core workflow is now:

1. **Investigation notes** are pasted or extracted from `.docx`.
2. The server converts the notes into immutable numbered lines (`[L0001]`, `[L0002]`, ...).
3. The AI builds an **evidence map** using only those source-line references.
4. The server reconstructs every displayed evidence excerpt from the original submitted lines — the model does not get to invent its own quote/citation.
5. Findings link to supporting and contradicting evidence IDs.
6. The engine separately evaluates compliance/regulatory risk and the factors relevant to corrective action.
7. Corrective action is presented as a **minimum → recommended-for-review → maximum range**, with organization-specific open questions where policy/precedent/CBA facts are missing.
8. The report and Word export include an **Evidence Traceability Appendix**.

## Evidence traceability

Each traceable finding includes:

- the finding statement;
- a separate AI inference/explanation;
- evidence status (`corroborated`, `single source`, `contradicted`, etc.);
- supporting evidence IDs;
- contradicting evidence IDs;
- source label and exact line range;
- the exact excerpt reconstructed by the server from the submitted notes.

Invalid or out-of-range evidence IDs/line references are filtered/clamped server-side before results are returned.

## Corrective-action / discipline design

The app does **not** use a rule such as "1 incident = coaching / 10 incidents = termination" and does not map risk level directly to discipline.

The AI is instructed to evaluate, when evidence exists:

- intent;
- role/access expectations;
- information sensitivity;
- actual harm;
- potential harm;
- concealment;
- cooperation;
- prior discipline;
- prior training;
- policy language;
- organizational precedent;
- union/CBA constraints;
- leadership role;
- retaliation;
- personal benefit;
- fraud;
- patient safety;
- regulatory reporting implications.

Users can optionally paste **organization-specific discipline context** such as policy language, a disciplinary matrix, anonymized precedent, HR rules, CBA requirements, or approval thresholds. That information is treated as decision criteria, **not case evidence**. If material organization-specific information is missing, the model is expected to mark the recommendation policy-dependent and identify the questions that must be resolved.

The manual Decision Framework follows the same philosophy and no longer automatically derives a discipline level from intent or a factor count.

## Privacy model

This demo does **not** persist reports in a database or browser storage. Investigation notes are transmitted to this app's server and then to the configured AI provider for inference. Use anonymized/de-identified data unless a production deployment has completed the necessary privacy/security review and agreements.

### Search privacy boundary

Current regulatory context is gathered in a separate process:

1. The normal non-search AI call receives case text and extracts a short **generic violation taxonomy**.
2. Only that generic taxonomy is sent to the provider's web-search capability.
3. The raw case notes are **not sent to the search-enabled call**.
4. Search results are labeled **"Current regulatory context consulted"**, not "proof" of the case finding or disciplinary recommendation.

Search context is background only and may never be treated as case evidence.

## Integrity and validation safeguards

- API keys are server-side only.
- Request-size limits are enforced by Express while reading request bodies.
- Per-IP rate limiting uses Express's proxy-aware `req.ip` and periodically removes stale buckets.
- Structured model output is validated server-side with **Zod** after provider tool/function calling.
- The classification is HMAC-signed.
- The signature is bound to a SHA-256 hash of **both the exact investigation notes and organization-specific context**. Changing either between classification and report generation forces a re-classification.
- Client cancellation uses `AbortController`, so cancelling an analysis actually aborts the HTTP request instead of merely ignoring a late response.
- The report prompt is required to preserve material contradictory evidence and avoid stock regulatory citations when applicability is uncertain.

## Regulatory reference library

The Regulatory Deadlines page was narrowed to scoped, primary-source timing references rather than broad universal claims. In particular:

- HIPAA breach notification remains "without unreasonable delay" and generally no later than 60 calendar days for required individual/large-breach HHS notices under the Breach Notification Rule.
- The CMS 2-hour/24-hour alleged-violation reporting rule is presented specifically as an **LTC facility** rule under 42 CFR §483.12(c), not a universal hospital "immediate jeopardy" deadline.
- The 2024 HIPAA Security Rule NPRM's **72-hour proposal** is correctly described as a proposal concerning restoration procedures for certain electronic information systems/data — not a proposed 72-hour HHS breach-notification deadline.
- Proposed rules are visually separated from current requirements.

Always verify facility type, state law, contracts/BAAs, Part 2, payer/accreditor rules, and current regulatory status before official use.

## Architecture

Production is one Node process/origin:

- **Frontend:** Vite + React (`dist/`)
- **API:** Express (`server/`)
- **AI abstraction:** `server/lib/ai.js`
- **Providers:** Anthropic, OpenAI, Gemini
- **Evidence utilities:** `server/lib/investigation-utils.js`
- **Main investigation route:** `server/routes/analyze-report.js`
- **Letter generator route:** `server/routes/investigation-toolkit.js`

## Local setup

```sh
npm install
cp .env.example .env
npm run dev:server
npm run dev
```

Open `http://localhost:8080`.

## Environment variables

```sh
AI_PROVIDER=anthropic                       # anthropic | openai | gemini

ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-5

OPENAI_API_KEY=...
OPENAI_MODEL=...                            # required when provider=openai

GEMINI_API_KEY=...
GEMINI_MODEL=...                            # required when provider=gemini

CLASSIFICATION_SIGNING_SECRET=...           # strongly recommended in production
PORT=3000
```

If no persistent signing secret/provider key exists at startup, the server uses an ephemeral signing secret and warns. Production should always set `CLASSIFICATION_SIGNING_SECRET`.

## Investigation Toolkit

The `/toolkit` route includes:

- **Investigation Guide**
- **Conflict of Interest**
- **Interview Templates**
- **AI Investigation Decision Support** with evidence traceability
- **Manual Decision Framework** with independent factor review
- **Regulatory Deadlines** with scoped primary-source references
- **AI Letter Generator**

## Tests / CI

The placeholder `expect(true).toBe(true)` test has been removed.

Regression tests cover evidence/integrity utilities including:

- stable line numbering;
- exact excerpt reconstruction;
- cryptographic input hashing;
- rejection of invented evidence IDs;
- contradiction handling;
- clamping invalid model line offsets;
- corroboration status rules;
- discipline-factor evidence references.

GitHub Actions runs:

```sh
npm ci
npm test
npm run build
npm run lint
```

on pull requests and pushes to `main`.

## Production-readiness warning

This repository is a strong demo / decision-support prototype, not a turn-key HIPAA enterprise case-management system. Real PHI/PII production use still requires, at minimum, appropriate contractual arrangements with providers/hosting vendors, authentication and authorization, audit logging, retention/deletion controls, incident response, access reviews, environment hardening, and organization-specific legal/privacy/security assessment.
