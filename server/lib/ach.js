// Ported from radarist/structured-analytic-skills, skills/analysis-of-
// competing-hypotheses/scripts/ach.py (MIT License, Copyright (c) 2025-2026
// Claudio Babelis — see THIRD_PARTY_NOTICES.md at the repo root). This is a
// deliberate, minimal port of the scoring algorithm only (Heuer's steps 4-5:
// weighted-inconsistency ranking and evidence diagnosticity), adapted from
// Python to this Node/JS codebase and renamed to the six-value mark
// vocabulary this app uses end to end. sensitivityAnalysis() below is new —
// upstream describes the sensitivity check in prose (step 6) but ships no
// companion-tool function for it; this implements it in code, reusing the
// same ranking primitives, so "what evidence flips the ranking if retracted"
// is computed rather than asserted.
//
// Method: Richards J. Heuer Jr., Psychology of Intelligence Analysis, CIA,
// 1999, ch. 8 "Analysis of Competing Hypotheses". Hypotheses are ranked by
// FEWEST weighted inconsistencies, never by most confirmations — counting
// consistencies rewards the confirmation bias ACH exists to remove.

// Numeric value of each mark on the consistency scale, used for the
// diagnosticity spread. not_applicable has no value: the cell does not bear
// on the hypothesis and is excluded from both scoring and spread.
export const MARK_VALUE = {
  strongly_consistent: -2,
  consistent: -1,
  neutral: 0,
  inconsistent: 1,
  strongly_inconsistent: 2,
};

export const ACH_MARKS = [...Object.keys(MARK_VALUE), "not_applicable"];

// Heuer: prefer the hypothesis with the FEWEST inconsistencies.
// strongly_inconsistent penalizes double.
const INCONSISTENCY_PENALTY = { inconsistent: 1.0, strongly_inconsistent: 2.0 };

function markOf(row, hypothesisId) {
  const mark = row.marks?.[hypothesisId];
  return ACH_MARKS.includes(mark) ? mark : "not_applicable";
}

function evidenceWeight(row) {
  const w = Number.isFinite(row.weight) && row.weight >= 0 ? row.weight : 1;
  const credibility = Number.isFinite(row.credibility) && row.credibility >= 0 ? row.credibility : 1;
  const relevance = Number.isFinite(row.relevance) && row.relevance >= 0 ? row.relevance : 1;
  return w * credibility * relevance;
}

// Per hypothesis: { weighted, raw } inconsistency totals.
// weighted = sum over evidence of weight x penalty(mark); raw treats
// inconsistent as 1 and strongly_inconsistent as 2, ignoring weights.
export function inconsistencyTotals(hypotheses, evidenceRows) {
  const totals = {};
  for (const h of hypotheses) {
    let weighted = 0;
    let raw = 0;
    for (const row of evidenceRows) {
      const mark = markOf(row, h.id);
      const penalty = INCONSISTENCY_PENALTY[mark] || 0;
      weighted += evidenceWeight(row) * penalty;
      raw += penalty ? (mark === "strongly_inconsistent" ? 2 : 1) : 0;
    }
    totals[h.id] = { weighted, raw };
  }
  return totals;
}

// Fewest weighted inconsistencies first (Heuer); ties broken by raw count,
// then by hypothesis id for determinism.
export function rankHypotheses(hypotheses, totals) {
  return [...hypotheses].sort((a, b) => {
    const ta = totals[a.id];
    const tb = totals[b.id];
    if (ta.weighted !== tb.weighted) return ta.weighted - tb.weighted;
    if (ta.raw !== tb.raw) return ta.raw - tb.raw;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// Diagnosticity of one evidence row: spread = max - min of mark values
// across hypotheses, not_applicable cells excluded. Spread 0 (or a single
// applicable cell) means the evidence cannot discriminate between
// hypotheses.
export function markSpread(row, hypothesisIds) {
  const values = hypothesisIds
    .map((hid) => markOf(row, hid))
    .filter((mark) => mark !== "not_applicable")
    .map((mark) => MARK_VALUE[mark]);
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

// Heuer step-4 verdict for one evidence row, or null if it discriminates.
export function diagnosticityFlag(row, hypothesisIds) {
  const applicable = hypothesisIds.map((hid) => markOf(row, hid)).filter((mark) => mark !== "not_applicable");
  if (applicable.length === 0) return "bears on no hypothesis (all not_applicable) — drop";
  const distinct = new Set(applicable);
  if (distinct.size === 1) {
    const mark = applicable[0];
    if (mark === "consistent" || mark === "strongly_consistent") {
      return "consistent with every hypothesis — no diagnostic value, consider dropping";
    }
    if (mark === "neutral") return "neutral for every hypothesis — no diagnostic value, drop";
    return "inconsistent with every hypothesis — challenge the evidence or add a missing hypothesis";
  }
  return null;
}

// Ids of the discriminating evidence rows with the largest spread.
export function mostDiagnostic(evidenceRows, hypothesisIds) {
  let best = [];
  let bestSpread = -1;
  for (const row of evidenceRows) {
    if (diagnosticityFlag(row, hypothesisIds) !== null) continue;
    const spread = markSpread(row, hypothesisIds);
    if (spread > bestSpread) {
      best = [row.evidenceId];
      bestSpread = spread;
    } else if (spread === bestSpread) {
      best.push(row.evidenceId);
    }
  }
  return { evidenceIds: best, spread: bestSpread < 0 ? 0 : bestSpread };
}

// Full scoring pass: ranking, per-row diagnosticity, most-diagnostic rows,
// and non-diagnostic rows flagged for pruning (Heuer step 4). hypotheses:
// [{id, label}]; evidenceRows: [{evidenceId, weight?, credibility?,
// relevance?, marks: {hypothesisId: mark}}].
export function scoreAch(hypotheses, evidenceRows) {
  const hypothesisIds = hypotheses.map((h) => h.id);
  const totals = inconsistencyTotals(hypotheses, evidenceRows);
  const ranking = rankHypotheses(hypotheses, totals).map((h) => ({
    hypothesisId: h.id,
    label: h.label,
    weightedInconsistency: totals[h.id].weighted,
    rawInconsistencyCount: totals[h.id].raw,
  }));
  const diagnosticity = evidenceRows.map((row) => ({
    evidenceId: row.evidenceId,
    spread: markSpread(row, hypothesisIds),
    flag: diagnosticityFlag(row, hypothesisIds),
  }));
  const { evidenceIds: mostDiagnosticEvidenceIds, spread: mostDiagnosticSpread } = mostDiagnostic(evidenceRows, hypothesisIds);
  return { ranking, diagnosticity, mostDiagnosticEvidenceIds, mostDiagnosticSpread };
}

// Evidence ids marked consistent/strongly_consistent (supporting) vs.
// inconsistent/strongly_inconsistent (contradicting — the "loose ends" that
// must stay visible, per Heuer step 7) against one hypothesis.
export function evidenceForAgainst(evidenceRows, hypothesisId) {
  const supportingEvidenceIds = [];
  const contradictingEvidenceIds = [];
  for (const row of evidenceRows) {
    const mark = markOf(row, hypothesisId);
    if (mark === "consistent" || mark === "strongly_consistent") supportingEvidenceIds.push(row.evidenceId);
    else if (mark === "inconsistent" || mark === "strongly_inconsistent") contradictingEvidenceIds.push(row.evidenceId);
  }
  return { supportingEvidenceIds, contradictingEvidenceIds };
}

// New (not in upstream ach.py): Heuer step 6, implemented rather than
// merely described. For the current leading hypothesis, try removing each
// evidence row one at a time and re-score; report which removals flip the
// leader, i.e. the pivotal evidence the conclusion actually rests on.
export function sensitivityAnalysis(hypotheses, evidenceRows) {
  if (hypotheses.length < 2 || evidenceRows.length === 0) {
    return { currentLeaderId: hypotheses[0]?.id || null, pivotalEvidenceIds: [], flips: [] };
  }
  const baseline = scoreAch(hypotheses, evidenceRows);
  const currentLeaderId = baseline.ranking[0].hypothesisId;
  const flips = [];
  for (const row of evidenceRows) {
    const withoutRow = evidenceRows.filter((r) => r.evidenceId !== row.evidenceId);
    if (withoutRow.length === 0) continue;
    const rescored = scoreAch(hypotheses, withoutRow);
    const newLeaderId = rescored.ranking[0].hypothesisId;
    if (newLeaderId !== currentLeaderId) {
      flips.push({ evidenceId: row.evidenceId, newLeaderId });
    }
  }
  return { currentLeaderId, pivotalEvidenceIds: flips.map((f) => f.evidenceId), flips };
}
