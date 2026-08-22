# Compliance & Privacy Investigation Workbench

A React/Vite + Node/Express application for organizing healthcare compliance/privacy investigations, mapping findings to evidence, identifying contradictory evidence and missing information, generating a structured investigative report, and supporting human review of possible corrective actions.

This is intentionally **decision support, not an automated employment decision-maker**.

## Core workflow

The product is no longer centered on "paste notes → AI writes a report." The workflow is now:

1. **Investigation notes** are pasted or extracted from `.docx`.
2. The server converts the notes into immutable numbered lines (`[L0001]`, `[L0002]`, ...).
3. The AI builds an **evidence map** using only those source-line references.
4. The server reconstructs every displayed evidence excerpt from the original submitted lines — the model does not get to invent its own quote/citation.
5. Invalid line ranges and invented evidence IDs are discarded rather than silently repaired onto real source text.
6. Findings link to supporting and contradicting evidence IDs.
7. The engine separately evaluates compliance/regulatory risk and the factors relevant to corrective action.
8. Corrective action is presented as a **minimum → recommended-for-review → maximum range**, with organization-specific open questions where policy/precedent/CBA facts are missing.
9. A human reviewer can explicitly **approve, approve with changes, reject, or defer** the AI decision support and record the actual final finding/action and rationale.
10. The report and Word export include an **Evidence Traceability Appendix**, analysis provenance, and the saved human-review disposition when one has been recorded.

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

## Human review and case provenance

The main report result includes a **Human Review Record**. A reviewer can record:

- reviewer name and role;
- disposition (`approve`, `approve with changes`, `need more information`, or `reject AI recommendation`);
- final human finding;
- final corrective/employment action or other disposition;
- human rationale / override explanation;
- review timestamp.

When saved, that human decision is carried into the Word export and downstream letter handoff ahead of the AI recommendation. If no human review has been saved, exports and letter handoffs explicitly state that the AI action range is **not an authorized final employment decision**.

The result also displays **Case Provenance & Review Trail** metadata for the current analysis: analysis version, generation time, source fingerprint, evidence/finding counts, whether organization-specific discipline context was applied, the generic regulatory research topic used, and the current human-review event.

This is still a client-side current-case result, **not an immutable enterprise audit trail**. A production case-management version would persist authenticated reviewer actions, case versions, assignments, approvals, and audit events server-side.

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

### Organization-configurable discipline matrix

Both the full report workflow and standalone AI decision-support tool use the same structured organization configuration. The user can provide:

- standard of proof / finding rule;
- applicable policy or code-of-conduct language;
- the organization's own disciplinary/corrective-action matrix;
- anonymized comparable precedent;
- CBA / union / due-process requirements;
- prior-discipline / progressive-discipline rules;
- training, role, and access expectations;
- required HR / Legal / leadership approvals;
- other organization-specific criteria.

That information is serialized into clearly labeled organization context and treated as **decision criteria, not case evidence**. If material organization-specific information is missing, the model is expected to mark the recommendation policy-dependent, use `policy_review` when appropriate, and identify the questions that must be resolved rather than guessing.

The manual Decision Framework follows the same philosophy and no longer automatically derives a discipline level from intent, incident count, risk level, or a factor score.

## Privacy model

This demo does **not** persist reports in a database or browser storage. Investigation notes are transmitted to this app's server and then to the configured AI provider for inference. Use anonymized/de-identified data unless a production deployment has completed the necessary privacy/security review and agreements.

### Search privacy boundary

Current regulatory context is gathered through a deliberately constrained two-stage process:

1. A normal **non-search structured AI call** sees the case text and may select exactly one value from a closed regulatory taxonomy such as `hipaa_unauthorized_access`, `overpayment`, `anti_kickback`, or `patient_safety`.
2. The server maps that enum to a **server-owned generic research string** from `server/lib/research-taxonomy.js`.
3. Only that fixed server-owned generic string is sent to the provider's web-search capability.
4. The raw case notes and any free-text model output are **not sent to the search-enabled call**.
5. Search results are labeled **"Current regulatory context consulted"**, not "proof" of the case finding or disciplinary recommendation.

Because the search text comes from a closed server-owned map, a taxonomy model cannot smuggle a name, employer, date, patient identifier, or prompt-injected string into web search through this path.

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
- Letter generation treats case details as untrusted data and cannot turn "consider termination" or an AI action range into a final termination decision unless an authorized final decision is actually supplied.

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
- **Closed regulatory taxonomy:** `server/lib/research-taxonomy.js`
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
- **AI Evidence & Decision Support** with evidence traceability
- **Manual Decision Framework** with independent factor review
- **Regulatory Deadlines** with scoped primary-source references
- **AI Letter Generator**

The full report workflow additionally includes the **Human Review Record** and **Case Provenance & Review Trail** described above.

## Tests / CI

The placeholder `expect(true).toBe(true)` test has been removed.

Regression tests now cover:

- stable line numbering;
- exact excerpt reconstruction;
- cryptographic input hashing;
- rejection of invented evidence IDs;
- rejection of invalid/out-of-range and reversed source-line citations;
- contradiction handling;
- corroboration status rules;
- discipline-factor evidence references;
- closed regulatory taxonomy mapping;
- rejection of arbitrary/free-text values as search topics;
- organization discipline-matrix serialization;
- organization matrix UI behavior;
- case provenance UI behavior.

CI is configured to run:

```sh
npm ci
npm run check:server
npm test
npm run build
npm run lint
```

on pull requests and pushes to `main`. `check:server` uses `node --check` against the Express routes and server libraries so backend syntax is verified separately from the Vite frontend build.

## Production-readiness warning

This repository is a strong demo / decision-support prototype, not a turn-key HIPAA enterprise case-management system. Real PHI/PII production use still requires, at minimum, appropriate contractual arrangements with providers/hosting vendors, authentication and authorization, encrypted persistent case storage, immutable server-side audit logging/version history, retention/deletion controls, incident response, access reviews, environment hardening, organization-specific legal/privacy/security assessment, and a validated model-evaluation program.
