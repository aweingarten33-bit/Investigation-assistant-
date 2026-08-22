# Investigation Assistant Overhaul

This branch upgrades the app into a stronger evidence-grounded **Compliance & Privacy Investigation Assistant** optimized for one investigator rather than a multi-user enterprise case-management platform.

## Major changes

- Evidence traceability: line-numbered source notes, server-reconstructed excerpts, finding-to-evidence links, contradictory evidence, and evidence-strength status.
- Safer citations: invalid/out-of-range model line references are discarded rather than clamped onto real text.
- Decision support instead of automatic discipline: risk and incident count no longer mechanically map to punishment.
- Eighteen independent discipline factors: intent, role/access expectations, sensitivity, actual/potential harm, concealment, cooperation, prior discipline/training, policy, precedent, CBA/union, leadership role, retaliation, personal benefit, fraud, patient safety, and reporting implications.
- Optional organization/policy context: standard of proof, policy rules, organization action bands, precedent, CBA/labor rules, prior-history rules, training/role expectations, required approvals, and additional criteria can be supplied only when useful.
- Corrective-action range: minimum/maximum/recommended-for-review plus policy-dependency and HR/Legal-review flags.
- Personal investigator next-step planner: on demand, produces immediate actions, records to obtain, people/questions to interview, contradictions to resolve, analysis checks, corrective-action ideas, and TEST → FIND → FIX → RETEST follow-up.
- Simplified personal final-decision record: investigator can agree, change, defer, or reject the AI result and save the actual final finding/action/rationale into the current result/export.
- Case provenance: analysis version, generated time, source fingerprint, evidence/finding counts, optional organization-context use, regulatory research topic, and final-review event.
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

## Personal-use scope

The app intentionally does not add login screens, a persistent case database, assignments, enterprise dashboards, or multi-user workflow overhead. It remains a fast paste/upload → analyze → investigate-next → report workflow for de-identified personal use.

A future real-PHI multi-user deployment would require a separate authenticated storage/audit architecture rather than bolting enterprise controls onto this personal-use build.
