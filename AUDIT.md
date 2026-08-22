# Security, Privacy & Decision-Support Audit — Investigation Workbench

_Last updated: 2026-08-22_

This audit describes the current architecture after the evidence-traceability and discipline-engine overhaul.

## Current architecture

1. User pastes or uploads de-identified investigation notes (`.docx` supported client-side).
2. Frontend sends notes to `POST /api/analyze-report`.
3. Server numbers each source line and performs a non-search AI taxonomy extraction.
4. Only the resulting generic taxonomy is sent to the provider's search-enabled call for current regulatory context.
5. Structured classification produces evidence references, findings, risk, discipline factors, action range, and open policy questions.
6. Server validates the response with Zod and reconstructs evidence excerpts from the submitted source lines.
7. The classification is HMAC-signed together with a SHA-256 hash of the exact notes + organization-specific context.
8. Step 2 verifies that binding before generating the report.
9. Results may be exported to Word with an Evidence Traceability Appendix.

## Controls in place

### Evidence integrity

- Case notes are converted to immutable line labels such as `[L0041]`.
- Model evidence objects contain only line ranges and summaries.
- Displayed evidence quotations/excerpts are reconstructed server-side from the actual submitted lines.
- Invalid evidence IDs referenced by findings/factors are removed.
- Out-of-range model line offsets are clamped to the submitted source.
- Contradictory evidence remains visible and changes the calculated evidence-status label.
- Findings without valid evidence are downgraded to `insufficient`.

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

1. Raw case text is sent only to the normal non-search inference call used to extract a generic violation taxonomy.
2. The taxonomy is stripped/limited to a short generic phrase.
3. The search-enabled call receives only that generic taxonomy.
4. Search output is labeled "Current regulatory context consulted" and is not represented as evidence or validation of employee discipline.

This reduces exposure to the search subsystem but does **not** make the application appropriate for real PHI by itself; the underlying AI inference provider still receives the submitted notes.

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
- provides an organization-context field so users can supply their actual policy/matrix/precedent/CBA rules;
- no longer auto-calculates a discipline band in the manual Decision Framework.

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
- links users to primary HHS/CMS/OIG sources.

## Regression testing

The placeholder always-passing test has been removed.

`server/lib/investigation-utils.test.js` now tests:

- line-ending normalization and stable line numbering;
- input-hash binding to both notes and organization context;
- exact evidence-excerpt reconstruction;
- removal of invented evidence IDs;
- evidence-status recalculation when contradictory evidence exists;
- clamping invalid model line ranges;
- corroboration status only when two valid supporting items remain;
- filtering invalid evidence references from discipline factors.

GitHub Actions runs `npm test`, `npm run build`, and `npm run lint` on pull requests and pushes to `main`.

## Important residual risks / not production-complete

### 1. No user authentication/authorization

The app is still a demo. Anyone who can reach the service can use it. A production case system needs identity, role-based access control, least privilege, session controls, and administrative access review.

### 2. No enterprise audit trail

There is no persistent case database, immutable event log, reviewer signature/approval history, chain-of-custody record, or versioned case history. Those are major requirements for an enterprise investigative workbench.

### 3. PHI/PII contractual/compliance readiness is not established

No claim is made that the current Render/provider configuration is HIPAA-ready. Production use with real PHI requires the necessary BAAs/contractual terms, vendor/security review, logging/retention decisions, encryption/key-management review, incident response, privacy assessment, and other controls.

### 4. Model evaluation is still early

Utility regression tests exist, but a mature product also needs a curated investigation-evaluation corpus covering sparse evidence, contradictory evidence, authorized access, snooping, retaliation, fraud, patient-safety cases, prior-history variations, prompt injection, and organization-specific policy matrices. The expected output should be reviewed by experienced compliance/HR/legal users and run across model/provider upgrades.

### 5. Regulatory content can become stale

Static reference content now uses narrower claims and primary-source links, but law/regulation/guidance changes over time. A production system should add content versioning, source last-reviewed dates, scheduled source verification, and approval ownership for regulatory content.

### 6. In-process rate limiting is not a distributed gateway

The limiter is appropriate for a single-process demo. Horizontal scaling requires a shared store or gateway/WAF-level protection.

### 7. No automatic de-identification guarantee

The UI warns users to de-identify data, but the app does not guarantee perfect automatic PHI/PII redaction before the inference call. Automatic de-identification can itself make mistakes and should not be represented as a substitute for a reviewed privacy architecture.

## Recommended next enterprise phase

The next major architectural step is persistent, auditable case management rather than more prompt features:

- authenticated users and RBAC;
- case/evidence objects with source provenance and hashes;
- reviewer assignments and approvals;
- immutable audit events;
- evidence upload/storage controls;
- configurable organization policy/matrix objects rather than free-text context alone;
- model/prompt/version logging;
- evaluation dashboards and bias/outcome monitoring;
- retention/legal-hold support;
- regulatory-content versioning and review ownership.
