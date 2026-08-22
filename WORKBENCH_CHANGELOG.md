# Investigation Workbench Overhaul

This branch converts the app from a report/recommendation generator into an evidence-grounded investigation workbench.

## Major changes

- Evidence traceability: line-numbered source notes, server-reconstructed excerpts, finding-to-evidence links, contradictory evidence, and evidence-strength status.
- Safer citations: invalid/out-of-range model line references are discarded rather than clamped onto real text.
- Decision support instead of automatic discipline: risk and incident count no longer mechanically map to punishment.
- Eighteen independent discipline factors: intent, role/access expectations, sensitivity, actual/potential harm, concealment, cooperation, prior discipline/training, policy, precedent, CBA/union, leadership role, retaliation, personal benefit, fraud, patient safety, and reporting implications.
- Organization-configurable discipline matrix: standard of proof, policy rules, organization action bands, precedent, CBA/labor rules, prior-history rules, training/role expectations, required approvals, and additional criteria.
- Corrective-action range: minimum/maximum/recommended-for-review plus policy-dependency and HR/Legal-review flags.
- Human review record: approve, approve with changes, request more information, or reject AI recommendation; final human finding/action/rationale is included in export.
- Case provenance: analysis version, generated time, source fingerprint, evidence/finding counts, organization-matrix use, regulatory research topic, and human-review event.
- Safer web research: raw case notes never reach the search-enabled provider call. A closed generic taxonomy is selected first, then only a server-owned generic topic is searched.
- Integrity binding: classification signature is bound to both the exact case notes and organization context hash; changed inputs require reclassification.
- Server-side Zod validation of AI structured output.
- Real client abort support for report-generation requests.
- Safer rate limiting and stale-IP cleanup.
- Regulatory reference corrections: removed the false HIPAA 72-hour breach-notification claim; scoped the CMS 2-hour rule to LTC §483.12 reporting; corrected NYC Local Law 144 scope.
- Versioned regulatory source registry: authoritative source, jurisdiction, citation, effective/publication date, current/proposed/guidance status, last-verified date, registry version, and revision history are centralized instead of embedded ad hoc in the UI.
- Regulatory freshness warning: sources older than the configured verification threshold are visibly flagged for re-review rather than silently treated as current.
- Investigation AI evaluation framework: eight realistic synthetic scenarios cover authorized vs. unauthorized access, conflicting witnesses, retaliation, billing fraud, controlled-substance diversion, insufficient evidence, and prompt-injection/misleading notes.
- Live model evaluation runner: `npm run eval:ai` sends the synthetic cases through the real `/api/analyze-report` classification path and scores decisions, evidence grounding, contradictions, missing information, factor analysis, human-review safeguards, prompt-injection resistance, and de-identified research topics.
- Deterministic eval-scoring tests run in normal CI; live provider calls remain opt-in because they cost money and can vary across model versions.
- Provider-neutral privacy disclosure.
- Expanded automated tests and CI (syntax, unit tests, production dependency audit, production build, lint).

## Important limitation

The demo still deliberately does not store real cases. Provenance and human-review records exist in the current result/export only. A production health-system deployment still needs authenticated users, role-based access control, appropriate HIPAA/privacy agreements, encrypted persistent case storage, immutable server-side audit events/version history, retention/deletion controls, and deployment-specific security review.
