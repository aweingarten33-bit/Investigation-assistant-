# Security, Privacy & Decision-Support Audit — Investigation Assistant

_Last updated: 2026-08-22_

## Current product scope

This repository is optimized as a **personal Compliance & Privacy Investigation Assistant** for a single experienced investigator using de-identified case material. The goal is fast, defensible analysis and report drafting without turning the app into a multi-user enterprise case-management system.

The primary workflow is:

1. paste or upload de-identified investigation notes;
2. map findings to exact source lines;
3. surface supporting and contradictory evidence;
4. assess substantiated / unsubstantiated / needs more information;
5. separate compliance/regulatory risk from employment action;
6. generate a structured investigative report;
7. optionally generate practical investigator next steps; and
8. optionally record the investigator's own final decision for export.

## Evidence controls

- Submitted notes are converted to immutable numbered lines.
- AI evidence items must reference those line numbers.
- Displayed excerpts are reconstructed by the server from the original submitted notes.
- Invalid, reversed, or out-of-range citations are removed rather than clamped to nearby real text.
- Invented evidence IDs are removed from findings and discipline factors.
- Evidence status is recalculated after validation.
- Material contradictions remain visible.
- Model-suggested source labels are shown only when the label can be verified near the cited source lines; otherwise the source falls back to `Investigation Notes`.

## Decision-support controls

- Risk level is not a disciplinary level.
- Incident count does not mechanically determine discipline.
- Corrective-action analysis considers intent, role expectations, sensitivity, harm, concealment, cooperation, prior discipline/training, policy, precedent, CBA/union constraints, leadership role, retaliation, personal benefit, fraud, patient safety, and regulatory reporting implications when evidence exists.
- Missing organization-specific policy/precedent/history can force a policy-dependent result rather than an invented answer.
- Serious actions remain subject to human/HR/Legal review.

## Personal investigator next-step planner

The optional planner is intentionally practical rather than report-like. It can identify:

- immediate preservation or escalation steps;
- objective records/evidence to obtain;
- people still worth interviewing;
- specific unresolved interview questions;
- contradictions that need resolution;
- analysis checks before deciding;
- process/corrective-action ideas; and
- TEST → FIND → FIX → RETEST follow-up when a control/process issue exists.

It is on-demand so the normal report flow remains fast and does not incur another provider call unless wanted.

## Search/privacy boundary

Previous behavior sent raw case text into a search-enabled model call while relying on prompt instructions not to search identifiers. That was not a real privacy boundary.

Current behavior:

1. Raw case text is sent only to a **non-search structured taxonomy-selection call**.
2. That call may return only a fixed enum such as `hipaa_unauthorized_access`, `false_claims_billing`, `controlled_substance_diversion`, or `patient_safety`.
3. The server maps the enum to a fixed string in `server/lib/research-taxonomy.js`.
4. The search-enabled provider call receives only that **server-owned fixed string**.
5. Free-text model output cannot become a search query through this path.
6. Search output is background regulatory context, not case evidence.

This materially reduces exposure to the search subsystem but does **not** make the application appropriate for real PHI by itself; the underlying non-search AI provider still receives the submitted notes.

## Integrity/security controls

- API keys remain server-side.
- Structured AI output is validated with Zod.
- Classification is HMAC-signed.
- The signature binds to a SHA-256 hash of the exact notes plus optional organization context.
- Changed notes/context require reclassification before report generation.
- Signature comparison uses constant-time comparison.
- Request size is bounded.
- Rate limiting uses proxy-aware `req.ip` with stale bucket cleanup.
- Client cancellation uses AbortController.
- Letter and investigator-plan prompts treat case material as untrusted data and resist embedded prompt instructions.

## Optional policy / discipline context

When useful, the investigator can provide:

- standard of proof;
- applicable policy/code language;
- internal corrective-action matrix;
- anonymized precedent;
- CBA/union/due-process requirements;
- prior-history rules;
- role/training/access expectations;
- required approvals; and
- other organization-specific criteria.

These values are decision criteria, not case evidence, and are included in the signed input hash.

## My Final Decision

The investigator can optionally record whether they agree, agree with changes, need more information, or disagree with the AI result and can save the actual final finding, action/disposition, rationale, and timestamp. That human conclusion is used in exports and downstream letter handoff ahead of the AI recommendation.

This remains current-result/export metadata, not a persistent enterprise approval system.

## Regulatory source governance

The regulatory reference library uses a centralized source registry with:

- authority/source;
- jurisdiction;
- citation;
- source URL;
- current/proposed/guidance status;
- effective or publication date where applicable;
- last-verified date;
- registry version; and
- revision history.

Sources exceeding the freshness threshold are visibly flagged for re-verification.

Current corrections include:

- HIPAA breach-notification timing is not misstated as 72 hours;
- the proposed HIPAA Security Rule 72-hour item is treated as a proposed restoration-procedure requirement, not a current breach-notification rule;
- CMS 2-hour/24-hour alleged-violation reporting is scoped to LTC under 42 CFR §483.12(c);
- NYC Local Law 144 is not presented as a general employee-discipline rule.

## AI evaluation program

The repository contains realistic synthetic investigation scenarios for:

- authorized access;
- deliberate unauthorized access;
- conflicting witnesses;
- retaliation;
- billing/document fraud;
- controlled-substance discrepancies;
- insufficient allegations; and
- misleading notes / prompt injection.

The scorer tests decision range, evidence-line integrity, contradiction handling, missing-information recognition, factor handling, human-review safeguards, automatic-discipline language, and research-topic de-identification.

Deterministic evaluator tests run in normal CI. Live provider evaluations are run separately with `npm run eval:ai` because they call the configured model and may use web grounding.

## Deliberate non-features for this personal build

The following are **not defects for the current personal workflow** and should not be added merely for enterprise optics:

- user accounts / SSO;
- RBAC;
- multi-user case assignment;
- persistent case database;
- supervisor approval queues;
- enterprise dashboards;
- immutable organization-wide audit logs;
- retention/legal-hold administration.

If the application is later converted into a real multi-user system processing identifiable PHI/PII, those become a separate required architecture with authenticated users, encrypted persistent storage, immutable server-side events, retention/deletion controls, vendor/BAA review, deployment hardening, and formal security/privacy governance.

## Remaining release blocker

The branch should not be treated as clean for merge until the production dependency audit is green. Functional syntax/tests/build/lint have already been exercised repeatedly; the remaining dependency advisory must be resolved and normal CI rerun before merge.
