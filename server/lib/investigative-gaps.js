// Deterministically turns the structured analysis (ACH ranking + sensitivity
// + key assumptions + unresolved questions) into the candidate pool the
// Next Best Action is chosen from, and the readiness gate the graph uses to
// decide whether to keep investigating. This is the code that replaced the
// old 8-sufficiency-check brain — nothing here is announced by the model;
// it is computed from state the model already produced and validated.
import { isResolvableAssumptionGap } from "./key-assumptions-check.js";

const GAP_TYPE_PRIORITY = {
  // Highest priority: evidence the ranking itself hinges on (Heuer step 6).
  pivotal_evidence_needs_corroboration: 0,
  // Evidence inconsistent with the leading explanation, not yet reconciled.
  unresolved_contradiction: 1,
  // A weak, high-sensitivity premise behind the leading explanation.
  unresolved_key_assumption: 2,
  // A generic open question the evidence-analysis pass flagged.
  discriminating_evidence_missing: 3,
};

function wasReportedUnavailable(actionHistory, gapId) {
  return (actionHistory || []).some((a) => a.status === "unavailable" && a.targetGapId === gapId);
}

export function identifyInvestigativeGaps({ achResult, sensitivity, achMatrix, keyAssumptions, unresolvedQuestions, actionHistory }) {
  const gaps = [];
  const leadingId = achResult?.ranking?.[0]?.hypothesisId || null;

  for (const evidenceId of sensitivity?.pivotalEvidenceIds || []) {
    const id = `pivot:${evidenceId}`;
    const flip = (sensitivity.flips || []).find((f) => f.evidenceId === evidenceId);
    gaps.push({
      id,
      gapType: "pivotal_evidence_needs_corroboration",
      description: `Evidence ${evidenceId} is pivotal — the leading explanation changes if this evidence is retracted or disproven${flip ? ` (ranking would flip to ${flip.newLeaderId})` : ""}.`,
      relatedEvidenceIds: [evidenceId],
      relatedHypothesisIds: leadingId ? [leadingId] : [],
      resolvable: !wasReportedUnavailable(actionHistory, id),
    });
  }

  if (leadingId) {
    for (const row of achMatrix || []) {
      const mark = row.marks?.[leadingId];
      if (mark === "inconsistent" || mark === "strongly_inconsistent") {
        const id = `contradiction:${row.evidenceId}:${leadingId}`;
        gaps.push({
          id,
          gapType: "unresolved_contradiction",
          description: `Evidence ${row.evidenceId} is inconsistent with the leading explanation and is not yet reconciled.`,
          relatedEvidenceIds: [row.evidenceId],
          relatedHypothesisIds: [leadingId],
          resolvable: !wasReportedUnavailable(actionHistory, id),
        });
      }
    }
  }

  for (const assumption of keyAssumptions || []) {
    if (assumption.category !== "unsupported_questionable") continue;
    const id = `assumption:${assumption.id}`;
    gaps.push({
      id,
      gapType: "unresolved_key_assumption",
      description: assumption.statement,
      relatedAssumptionIds: [assumption.id],
      relatedHypothesisIds: leadingId ? [leadingId] : [],
      resolvable: isResolvableAssumptionGap(assumption) && !wasReportedUnavailable(actionHistory, id),
    });
  }

  (unresolvedQuestions || []).forEach((question, index) => {
    const id = `question:${index}:${question.slice(0, 40)}`;
    gaps.push({
      id,
      gapType: "discriminating_evidence_missing",
      description: question,
      relatedHypothesisIds: leadingId ? [leadingId] : [],
      resolvable: !wasReportedUnavailable(actionHistory, id),
    });
  });

  return gaps;
}

// Most diagnostic / highest realistic ability to change the conclusion
// first — pivotal evidence and unresolved contradictions against the
// leader outrank a weak assumption, which outranks a generic open
// question.
export function rankGaps(gaps) {
  return [...(gaps || [])].sort((a, b) => (GAP_TYPE_PRIORITY[a.gapType] ?? 9) - (GAP_TYPE_PRIORITY[b.gapType] ?? 9));
}

// INCOMPLETE: a material uncertainty remains AND a reasonable investigative
//   action could still resolve/discriminate it.
// READY_WITH_LIMITATIONS: material uncertainty remains but no reasonable
//   obtainable investigation step is likely to resolve it.
// READY_FOR_HUMAN_REVIEW: no material reasonably-resolvable gap remains.
// Code evaluates the structured state — the model never announces
// readiness itself.
export function computeInvestigationStatus(gaps) {
  if (!gaps || gaps.length === 0) return "ready_for_review";
  return gaps.some((g) => g.resolvable) ? "incomplete" : "ready_with_limitations";
}
