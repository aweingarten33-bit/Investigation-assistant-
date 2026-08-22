# Compliance & Privacy Investigation Assistant

A React/Vite + Node/Express application for turning de-identified healthcare compliance/privacy investigation notes into evidence-grounded findings, a structured investigative report, and practical next-step guidance for the investigator.

This is intentionally **decision support, not an automated employment decision-maker**.

## Core workflow

The main flow is intentionally simple:

1. **Paste investigation notes or upload a `.docx`.**
2. The server converts the notes into immutable numbered lines (`[L0001]`, `[L0002]`, ...).
3. The AI builds an **evidence map** using only those source-line references.
4. The server reconstructs every displayed evidence excerpt from the original submitted lines — the model does not get to invent its own quote/citation.
5. Invalid line ranges and invented evidence IDs are discarded rather than silently repaired onto real source text.
6. Findings link to supporting and contradicting evidence IDs.
7. The engine separately evaluates compliance/regulatory risk and the factors relevant to corrective action.
8. Corrective action is presented as a **minimum → recommended-for-review → maximum range**, with organization-specific questions where policy/precedent/CBA facts are missing.
9. The investigator can optionally click **Build My Next Steps** to generate a practical case-specific plan: what to preserve, what records to obtain, who to interview, exact questions to ask, contradictions to resolve, analysis checks, corrective-action ideas, and a TEST → FIND → FIX → RETEST plan where applicable.
10. The investigator can optionally save **My Final Decision** so the Word export reflects the actual human conclusion rather than treating the AI output as final.
11. The report and Word export include an evidence traceability appendix and analysis provenance.

## Evidence traceability

Each traceable finding includes:

- the finding statement;
- a separate AI inference/explanation;
- evidence status (`corroborated`, `single source`, `contradicted`, etc.);
- supporting evidence IDs;
- contradicting evidence IDs;
- a source label only when that label can be verified near the cited source lines;
- exact line range;
- the exact excerpt reconstructed by the server from the submitted notes.

The model never supplies the displayed quote. The server reconstructs it from the submitted line range. Out-of-range or reversed line references are rejected, invented evidence IDs are stripped, and evidence status is recalculated after validation. This prevents a model from obtaining a "corroborated" label merely by inventing citations.

## Investigator next-step planner

The main result includes an optional **What should I do next?** action. It sends the current de-identified case notes plus the structured analysis through the configured provider and returns:

- the single most important bottom-line point;
- immediate preservation/escalation actions;
- records or objective evidence to obtain;
- people who still need to be interviewed;
- case-specific interview questions;
- contradictions that still need resolution;
- analysis checks before deciding;
- process/control or corrective-action ideas;
- a retest / sustained-compliance plan when a process issue exists; and
- whether the matter appears ready to close and why.

The planner is deliberately on-demand so it does not slow the normal two-step analysis/report flow or add an extra provider call unless the investigator actually wants it.

## Human review and case provenance

The result includes an optional **My Final Decision** section. The investigator can record:

- whether they agree, agree with changes, need more information, or disagree with the AI;
- the final human finding;
- the final corrective/action disposition;
- the investigator's rationale;
- optional name/role; and
- review timestamp.

When saved, that human decision is carried into the Word export and downstream letter handoff ahead of the AI recommendation. If no human review has been saved, exports and letter handoffs explicitly state that the AI action range is **not an authorized final employment decision**.

The result also retains current-analysis provenance: analysis version, generation time, source fingerprint, evidence/finding counts, whether optional policy/discipline context was applied, the generic regulatory research topic used, and the current human-review event.

This personal-use version does **not** persist cases in a database or browser storage.

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

### Optional policy / discipline context

The user can optionally provide:

- standard of proof / finding rule;
- applicable policy or code-of-conduct language;
- the organization's disciplinary/corrective-action matrix;
- anonymized comparable precedent;
- CBA / union / due-process requirements;
- prior-discipline / progressive-discipline rules;
- training, role, and access expectations;
- required HR / Legal / leadership approvals; and
- other organization-specific criteria.

That information is treated as **decision criteria, not case evidence**. If material organization-specific information is missing, the model is expected to mark the recommendation policy-dependent and identify what needs review rather than guessing.

## Privacy model

This personal-use demo does **not** persist reports in a database or browser storage. Investigation notes are transmitted to this app's server and then to the configured AI provider for inference. Use anonymized/de-identified data unless a future production deployment completes the necessary privacy/security review and agreements.

### Search privacy boundary

Current regulatory context is gathered through a constrained two-stage process:

1. A normal **non-search structured AI call** sees the case text and may select exactly one value from a closed regulatory taxonomy such as `hipaa_unauthorized_access`, `overpayment`, `anti_kickback`, or `patient_safety`.
2. The server maps that enum to a **server-owned generic research string** from `server/lib/research-taxonomy.js`.
3. Only that fixed server-owned generic string is sent to the provider's web-search capability.
4. The raw case notes and any free-text model output are **not sent to the search-enabled call**.
5. Search results are labeled as current regulatory context, not proof of the case finding or disciplinary recommendation.

Because the search text comes from a closed server-owned map, a taxonomy model cannot smuggle a name, employer, date, patient identifier, or prompt-injected string into web search through this path.

## Integrity and validation safeguards

- API keys are server-side only.
- Request-size limits are enforced by Express while reading request bodies.
- Per-IP rate limiting uses Express's proxy-aware `req.ip` and periodically removes stale buckets.
- Structured model output is validated server-side with **Zod** after provider tool/function calling.
- The classification is HMAC-signed.
- The signature is bound to a SHA-256 hash of **both the exact investigation notes and optional organization-specific context**. Changing either between classification and report generation forces a re-classification.
- Client cancellation uses `AbortController`.
- Report and letter prompts preserve contradictory evidence and resist embedded prompt injection.

## Regulatory source management

Regulatory timing content is no longer stored as anonymous hard-coded text. Each source record now includes:

- authoritative source/agency;
- jurisdiction;
- citation;
- direct source URL;
- status (`current`, `proposed`, or `guidance`);
- effective date or publication date where applicable;
- last-verified date;
- registry version; and
- revision history.

The UI visibly flags a source when it exceeds the configured verification-age threshold so old content is not silently treated as current.

The current reference set also corrects prior overbroad statements:

- HIPAA breach notification remains "without unreasonable delay" and generally no later than 60 calendar days for required individual/large-breach HHS notices.
- The CMS 2-hour/24-hour alleged-violation reporting rule is scoped to **LTC facilities under 42 CFR §483.12(c)**, not presented as a universal hospital deadline.
- The HIPAA Security Rule NPRM's **72-hour proposal** is described as proposed restoration procedures for certain systems/data, not a 72-hour HHS breach-notification deadline.
- Proposed rules are visually separated from current requirements.

## AI evaluation framework

The repository includes both deterministic scoring tests and an optional live-model evaluation suite.

Synthetic cases cover:

- authorized access falsely alleged as snooping;
- deliberate unauthorized access to sensitive information;
- conflicting witness accounts;
- retaliation with disputed causation;
- supported billing/document falsification;
- controlled-substance discrepancy without proof identifying the responsible individual;
- vague/insufficient allegations; and
- misleading notes / prompt-injection attempts designed to make the AI fabricate evidence or force termination.

The scorer checks decision quality, evidence grounding, valid source-line references, contradictory evidence, missing-information recognition, discipline-factor handling, HR/Legal review safeguards, automatic-termination language, prompt-injection resistance, and de-identified research topics.

Run deterministic tests with:

```sh
npm test
```

Run the live AI evaluation suite with the configured provider:

```sh
npm run eval:ai
```

Or run a single scenario:

```sh
npm run eval:ai -- --case=deliberate-unauthorized-access
```

Live evaluations are opt-in because they call the configured AI provider and may use regulatory web grounding.

## Architecture

- **Frontend:** Vite + React (`dist/`)
- **API:** Express (`server/`)
- **AI abstraction:** `server/lib/ai.js`
- **Providers:** Anthropic, OpenAI, Gemini
- **Evidence utilities:** `server/lib/investigation-utils.js`
- **Closed regulatory taxonomy:** `server/lib/research-taxonomy.js`
- **Investigation AI evals:** `server/evals/`
- **Main investigation route:** `server/routes/analyze-report.js`
- **Next-step planner / letter route:** `server/routes/investigation-toolkit.js`
- **Regulatory source registry:** `src/lib/regulatory-sources.ts`

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

CLASSIFICATION_SIGNING_SECRET=...           # recommended for a stable deployment
PORT=3000
```

## Investigation Toolkit

The `/toolkit` route includes:

- Investigation Guide
- Conflict of Interest
- Interview Templates
- AI Evidence & Decision Support
- Manual Decision Framework
- Regulatory Deadlines with versioned source metadata
- AI Letter Generator

The main report workflow additionally includes the on-demand **My Investigator Plan**, **My Final Decision**, and analysis provenance.

## CI

CI verifies:

```sh
npm ci
npm run check:server
npm test
npm run build
npm run lint
npm audit --omit=dev --audit-level=high
```

The live-model evaluation suite is deliberately separate from normal CI.

## Scope

This repository is optimized as a **personal investigation assistant**: fast analysis, evidence traceability, practical next steps, report generation, and optional human-final-decision capture without requiring a case database, login system, or enterprise workflow engine. A future multi-user deployment involving real PHI/PII would require a separate security/identity/storage architecture rather than pretending those controls exist in this personal-use build.
