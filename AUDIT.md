# Security, Privacy & Decision-Support Audit — Investigation Workbench

_Last updated: 2026-08-22_

This audit describes the current architecture after the evidence-traceability, discipline-engine, search-privacy, organization-matrix, provenance, and human-review overhaul.

## Current architecture

1. User pastes or uploads de-identified investigation notes (`.docx` supported client-side).
2. Frontend sends notes to `POST /api/analyze-report`.
3. Server numbers each source line.
4. A non-search structured AI call selects exactly one value from a closed regulatory taxonomy.
5. The server maps that enum to a fixed server-owned generic research topic; only that generic topic is sent to the search-enabled AI call.
6. Structured classification produces evidence references, findings, risk, discipline factors, action range, and open policy questions.
7. Server validates the response with Zod, rejects invalid evidence ranges, verifies source labels locally, and reconstructs evidence excerpts from the submitted source lines.
8. The classification is HMAC-signed together with a SHA-256 hash of the exact notes + organization-specific context.
9. Step 2 verifies that binding before generating the report.
10. A human reviewer may explicitly approve, modify, reject, or defer the AI recommendation and record the actual final finding/action and rationale.
11. The current case result records analysis provenance (analysis version, timestamp, source fingerprint, research topic, organization-context use, evidence/finding counts) and the human-review event.
12. Results may be exported to Word with provenance, an Evidence Traceability Appendix, and the saved Human Review Record.

## Controls in place

### Evidence integrity

- Case notes are converted to immutable line labels such as `[L0041]`.
- Model evidence objects contain only line ranges and summaries.
- Displayed evidence quotations/excerpts are reconstructed server-side from the actual submitted lines.
- Invalid evidence IDs referenced by findings/factors are removed.
- Out-of-range, reversed, or otherwise invalid model line ranges are **discarded**, not clamped onto real source text.
- A model-suggested source label is shown only when that label can be verified in a small local window around the cited source lines; otherwise the label falls back to `Investigation Notes`.
- Contradictory evidence remains visible and changes the calculated evidence-status label.
- Findings without valid evidence are downgraded to `insufficient`.
- A `corroborated` status is recomputed from valid evidence rather than trusted directly from model output.

### Classification/report integrity

- Structured responses are validated server-side with Zod after provider tool/function calling.
- Classification values use constrained enums.
- Step-1 classification is HMAC-signed.
- The HMAC payload includes `inputHash`, a SHA-256 hash of the investigation notes plus organization-specific discipline context.
- A different note set or changed organization context in Step 2 is rejected and requires re-classification.
- Signature comparison uses Node's constant-time `timingSafeEqual`.
- If no persistent signing secret/provider key is configured, a random ephemeral process secret is generated instead of running with an empty HMAC key. Production should set `CLASSIFICATION_SIGNING_SECRET`.

### Prompt-injection resistance

- Investigation notes and case details are explicitly described to the model as untrusted data, not instructions.
- The model is prohibited from treating embedded text as role/system/output instructions.
- Organization-specific policy context is separately labeled as decision criteria, not case evidence.
- Current regulatory research is separately labeled as background context, not case evidence.
- Letter generation cannot convert a recommendation/action range into a final termination decision unless the supplied case details explicitly state an authorized final decision.

### Search privacy boundary

Previous behavior sent up to 4,000 characters of raw case text into a search-enabled model call while merely instructing it not to search names. That was not a real privacy boundary.

Current behavior:

1. Raw case text is sent only to a **non-search structured taxonomy-selection call**.
2. That call may return only a fixed enum such as `hipaa_unauthorized_access`, `false_claims_billing`, `controlled_substance_diversion`, or `patient_safety`.
3. The server maps the enum to a fixed string in `server/lib/research-taxonomy.js`.
4. The search-enabled provider call receives only that **server-owned fixed string**.
5. Free-text model output cannot become a search query through this path.
6. Raw notes, names, employers, dates, patient identifiers, and prompt-injected text therefore cannot be forwarded into search through taxonomy output.
7. Search output is labeled "Current regulatory context consulted" and is not represented as evidence or validation of employee discipline.

This materially reduces exposure to the search subsystem but does **not** make the application appropriate for real PHI by itself; the underlying non-search AI inference provider still receives the submitted notes.

### Discipline / employment-decision safeguards

The previous engine mechanically linked risk/count bands to four discipline outcomes. That has been removed as the governing logic.

The current engine:

- separates compliance/regulatory risk from employment action;
- weighs intent, role expectations, sensitivity, harm, concealment, cooperation, prior discipline/training, policy language, precedent, CBA/union constraints, leadership role, retaliation, personal benefit, fraud, patient safety, and reporting implications independently;
- produces a minimum-to-maximum corrective-action range;
- may recommend deferring final action pending policy/HR review;
- explicitly identifies missing organization-specific questions;
- requires HR/Legal review for serious action;
- treats `recommendationTier` only as a coarse legacy workflow label rather than the decision engine;
- supports `policy_review` when organization-specific criteria are missing;
- no longer auto-calculates a discipline band in the manual Decision Framework.

### Organization-configurable discipline matrix

Both the full report workflow and standalone AI decision-support tool use the same structured configuration fields:

- standard of proof / finding rule;
- applicable policy / code-of-conduct rules;
- organization disciplinary/corrective-action matrix;
- anonymized comparable precedent;
- CBA / union / due-process requirements;
- prior-discipline / progressive-discipline rules;
- training / role / access expectations;
- required HR / Legal / leadership approvals;
- other organization-specific criteria.

Those values are serialized into clearly labeled organization context and treated as decision criteria, not case evidence. The exact serialized context is included in the `inputHash`, so changing it after classification invalidates the signed classification.

### Human review and provenance safeguards

The main report workflow includes a Human Review Record. The reviewer can:

- approve the AI decision support;
- approve it with changes;
- require more information;
- reject the AI recommendation;
- record the final human finding;
- record the final action/disposition;
- explain the rationale/override;
- identify reviewer name/role and timestamp.

The saved human decision is included in exports and downstream letter-prefill data ahead of the AI recommendation. If no human review exists, those downstream artifacts explicitly state that the AI action range is not an authorized final employment decision.

The current result also carries analysis provenance: analysis-version identifier, generation timestamp, source fingerprint, organization-context flag, generic regulatory research topic, evidence count, and finding count.

**Residual limitation:** these records live in the current client-side case result/export. They are not yet a persistent, immutable, authenticated enterprise approval/audit record.

### API/cost hardening

- API keys remain server-only.
- Express request-size limits are enforced while bodies are read.
- Rate limiting uses Express's proxy-aware `req.ip`, not the first raw `X-Forwarded-For` value.
- Stale rate-limit buckets are periodically removed to prevent unbounded key growth.
- Client cancellation uses `AbortController`, aborting in-flight HTTP requests instead of only ignoring late results.
- Same-origin production deployment avoids a cross-origin API surface.

### Regulatory-reference corrections

The static deadline/reference library now:

- correctly describes the 2024 HIPAA Security Rule NPRM's 72-hour item as a proposed restoration procedure for certain electronic systems/data, not a proposed 72-hour HHS breach-notification deadline;
- scopes the CMS 2-hour/24-hour alleged-violation rule to LTC facilities under 42 CFR §483.12(c), rather than presenting it as a universal hospital immediate-jeopardy rule;
- keeps proposed rules visually separate from current requirements;
- labels internal investigation targets as organization governance targets rather than universal federal deadlines;
- links users to primary HHS/CMS/OIG sources;
- describes NYC Local Law 144 narrowly as candidate/employment and promotion screening rather than a general employee-discipline mandate;
- separately flags Illinois employment-AI requirements relevant to discipline without turning that statement into universal legal advice.

## Regression testing / CI

The placeholder always-passing test has been removed.

`server/lib/investigation-utils.test.js` tests:

- line-ending normalization and stable line numbering;
- input-hash binding to both notes and organization context;
- exact evidence-excerpt reconstruction;
- removal of invented evidence IDs;
- rejection of out-of-range and reversed model line ranges;
- evidence-status recalculation when contradictory evidence exists;
- contradiction-only handling;
- corroboration status only when two valid supporting items remain;
- filtering invalid evidence references from discipline factors.

`server/lib/research-taxonomy.test.js` tests:

- every permitted category maps to a server-owned topic;
- arbitrary/free-text categories map to no topic;
- prompt-injection-like text cannot become a search topic.

Frontend/unit tests also cover:

- organization discipline-context serialization;
- organization matrix UI fields/editing;
- current-case provenance rendering.

CI is configured to run `npm run check:server`, `npm test`, `npm run build`, and `npm run lint` after `npm ci`. The explicit server syntax gate exists because the Vite build does not compile-check the Express route files.

## Important residual risks / not production-complete

### 1. No user authentication/authorization

The app is still a demo. Anyone who can reach the service can use it. A production case system needs identity, role-based access control, least privilege, session controls, and administrative access review.

### 2. No persistent enterprise audit trail

A human review and provenance record can now be captured in the current case result/export, but there is still no persistent case database, immutable event log, authenticated reviewer signature, chain-of-custody record, assignment history, or versioned case history. Those remain major requirements for an enterprise investigative workbench.

### 3. PHI/PII contractual/compliance readiness is not established

No claim is made that the current Render/provider configuration is HIPAA-ready. Production use with real PHI requires the necessary BAAs/contractual terms, vendor/security review, logging/retention decisions, encryption/key-management review, incident response, privacy assessment, and other controls.

### 4. Model evaluation is still early

Utility regression tests exist, but a mature product also needs a curated investigation-evaluation corpus covering sparse evidence, contradictory evidence, authorized access, snooping, retaliation, fraud, patient-safety cases, prior-history variations, prompt injection, and organization-specific policy matrices. Expected outputs should be reviewed by experienced compliance/HR/legal users and re-run across prompt/model/provider upgrades.

### 5. Regulatory content can become stale

Static reference content now uses narrower claims and primary-source links, but law/regulation/guidance changes over time. A production system should add content versioning, source last-reviewed dates, scheduled source verification, and approval ownership for regulatory content.

### 6. In-process rate limiting is not a distributed gateway

The limiter is appropriate for a single-process demo. Horizontal scaling requires a shared store or gateway/WAF-level protection.

### 7. No automatic de-identification guarantee

The UI warns users to de-identify data, but the app does not guarantee perfect automatic PHI/PII redaction before the inference call. Automatic de-identification can itself make mistakes and should not be represented as a substitute for a reviewed privacy architecture.

## Recommended next enterprise phase

The next major architectural step is persistent, auditable case management rather than more prompt features:

- authenticated users and RBAC;
- persistent case/evidence objects with source provenance and hashes;
- authenticated reviewer assignments, approvals, and overrides;
- immutable audit events;
- evidence upload/storage controls;
- server-persisted organization policy/matrix objects with versioning and approval ownership;
- model/prompt/version logging;
- evaluation dashboards and bias/outcome monitoring;
- retention/legal-hold support;
- regulatory-content versioning and review ownership.
