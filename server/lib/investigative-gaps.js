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

// Content-based, not position-based: reordering or lightly rephrasing the
// model's unresolvedQuestions list between rounds must not manufacture a
// "new" gap id for something already tracked in gapHistory.
export function slugify(text) {
  const slug = String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return slug || "question";
}

// Structural gaps computed fresh from the current state — every call is a
// clean re-derivation, with no memory of prior rounds. Whether a gap is
// actually still worth acting on (never tried, tried and resolved, tried
// and stuck, or reported unobtainable) is applyGapLifecycle's job below,
// not this function's. inherentlyResolvable marks a gap that KAC itself
// already decided is not further actionable (disposition bound/flag) —
// distinct from the attempt-based lifecycle, since that call was made once
// by the analysis, not by a failed action.
export function identifyInvestigativeGaps({ achResult, sensitivity, achMatrix, keyAssumptions, unresolvedQuestions }) {
  const gaps = [];
  const leadingId = achResult?.ranking?.[0]?.hypothesisId || null;

  for (const evidenceId of sensitivity?.pivotalEvidenceIds || []) {
    const flip = (sensitivity.flips || []).find((f) => f.evidenceId === evidenceId);
    gaps.push({
      id: `pivot:${evidenceId}`,
      gapType: "pivotal_evidence_needs_corroboration",
      description: `Evidence ${evidenceId} is pivotal — the leading explanation changes if this evidence is retracted or disproven${flip ? ` (ranking would flip to ${flip.newLeaderId})` : ""}.`,
      relatedEvidenceIds: [evidenceId],
      relatedHypothesisIds: leadingId ? [leadingId] : [],
      inherentlyResolvable: true,
    });
  }

  if (leadingId) {
    for (const row of achMatrix || []) {
      const mark = row.marks?.[leadingId];
      if (mark === "inconsistent" || mark === "strongly_inconsistent") {
        gaps.push({
          id: `contradiction:${row.evidenceId}:${leadingId}`,
          gapType: "unresolved_contradiction",
          description: `Evidence ${row.evidenceId} is inconsistent with the leading explanation and is not yet reconciled.`,
          relatedEvidenceIds: [row.evidenceId],
          relatedHypothesisIds: [leadingId],
          inherentlyResolvable: true,
        });
      }
    }
  }

  for (const assumption of keyAssumptions || []) {
    if (assumption.category !== "unsupported_questionable") continue;
    gaps.push({
      id: `assumption:${assumption.id}`,
      gapType: "unresolved_key_assumption",
      description: assumption.statement,
      relatedAssumptionIds: [assumption.id],
      relatedHypothesisIds: leadingId ? [leadingId] : [],
      // KAC itself judged this: disposition re-source/test is actionable;
      // bound/flag means the check already concluded no further step is
      // realistically obtainable — a documented limitation, not a gap to
      // send a human after.
      inherentlyResolvable: isResolvableAssumptionGap(assumption),
    });
  }

  (unresolvedQuestions || []).forEach((question) => {
    gaps.push({
      id: `question:${slugify(question)}`,
      gapType: "discriminating_evidence_missing",
      description: question,
      relatedHypothesisIds: leadingId ? [leadingId] : [],
      inherentlyResolvable: true,
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

// gapHistory is a { [gapId]: { status, at } } map persisted in graph state
// across rounds — the smallest lifecycle needed to stop a gap from being
// recommended forever: unresolved (default, no entry yet) -> attempted (an
// action targeted it, set by recommendNextBestAction) -> resolved (the
// next reanalysis no longer computes this gap at all) | remains_open (the
// next reanalysis still computes it — a completed action does NOT get to
// claim resolution on its own; only reanalysis does) | unavailable (the
// human reported the targeted action could not be completed, set directly
// by ingestHumanResult without waiting on reanalysis).
//
// Call this once per computeReadiness pass, after a fresh
// identifyInvestigativeGaps() — it both resolves any pending "attempted"
// entries against the newly computed structural gaps and produces the
// final resolvable flag each gap carries this round.
export function applyGapLifecycle(rawGaps, gapHistory) {
  const nextHistory = { ...(gapHistory || {}) };
  const rawGapIds = new Set(rawGaps.map((g) => g.id));

  for (const [gapId, entry] of Object.entries(nextHistory)) {
    if (entry.status === "attempted") {
      nextHistory[gapId] = {
        status: rawGapIds.has(gapId) ? "remains_open" : "resolved",
        at: new Date().toISOString(),
      };
    }
  }

  const gaps = rawGaps.map((gap) => {
    const lifecycleStatus = nextHistory[gap.id]?.status || "unresolved";
    const resolvable = gap.inherentlyResolvable !== false
      && lifecycleStatus !== "remains_open"
      && lifecycleStatus !== "unavailable";
    return { ...gap, lifecycleStatus, resolvable };
  });

  return { gaps, gapHistory: nextHistory };
}

export function markGapAttempted(gapHistory, gapId) {
  if (!gapId) return gapHistory || {};
  return { ...(gapHistory || {}), [gapId]: { status: "attempted", at: new Date().toISOString() } };
}

export function markGapUnavailable(gapHistory, gapId) {
  if (!gapId) return gapHistory || {};
  return { ...(gapHistory || {}), [gapId]: { status: "unavailable", at: new Date().toISOString() } };
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
