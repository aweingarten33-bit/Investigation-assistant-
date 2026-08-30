import { Annotation, StateGraph, START, END, interrupt } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { validateEvidenceItems, groundFindings, numberReportLines } from "../lib/investigation-utils.js";
import { evidenceForAgainst, scoreAch, sensitivityAnalysis } from "../lib/ach.js";
import { categorizeAssumption } from "../lib/key-assumptions-check.js";
import { computeInvestigationStatus, identifyInvestigativeGaps, rankGaps } from "../lib/investigative-gaps.js";
import {
  EvidenceExtractionZ,
  KeyAssumptionsCheckZ,
  NextActionZ,
  FinalRecommendationZ,
  HumanResultZ,
} from "./schemas.js";

// --- State -------------------------------------------------------------
// The investigation reasoning is Analysis of Competing Hypotheses (ACH) +
// Key Assumptions Check (KAC), not the old 8-sufficiency-check brain — see
// THIRD_PARTY_NOTICES.md for the upstream methodology this adapts. Nothing
// here is a signature or a client-echoed round-trip; the checkpointer is
// the only thing carrying any of this between calls.
export const InvestigationState = Annotation.Root({
  caseId: Annotation({ default: () => "" }),
  caseObjective: Annotation({ default: () => "" }),
  allegations: Annotation({ default: () => "" }),
  organizationContext: Annotation({ default: () => "" }),
  caseNotes: Annotation({ default: () => "" }),

  evidenceItems: Annotation({ default: () => [] }),
  findings: Annotation({ default: () => [] }),
  hypotheses: Annotation({ default: () => [] }), // [{id, label, description}]
  achMatrix: Annotation({ default: () => [] }), // [{evidenceId, marks: {hypothesisId: mark}}]
  achResult: Annotation({ default: () => null }), // {ranking, diagnosticity, mostDiagnosticEvidenceIds, mostDiagnosticSpread}
  sensitivity: Annotation({ default: () => null }), // {currentLeaderId, pivotalEvidenceIds, flips}
  keyAssumptions: Annotation({ default: () => [] }), // KeyAssumptionZ[] + computed `category`
  unresolvedQuestions: Annotation({ default: () => [] }),
  investigativeGaps: Annotation({ default: () => [] }),
  // "incomplete" | "ready_with_limitations" | "ready_for_review" — computed
  // by computeInvestigationStatus from investigativeGaps, never announced
  // by the model.
  investigationStatus: Annotation({ default: () => null }),

  currentNextBestAction: Annotation({ default: () => null }),
  // Overwrite semantics (the default — no custom reducer): ingestHumanResult
  // needs to mark an existing actionHistory entry "completed"/"unavailable"
  // in place, not add a second copy alongside it. Each node that touches
  // these returns the complete array it wants, computed from prior state.
  actionHistory: Annotation({ default: () => [] }),
  completedActions: Annotation({ default: () => [] }),
  humanInputs: Annotation({ default: () => [] }),
  // Transient handoff from humanActionInterrupt to ingestHumanResult — never
  // read by the UI directly, cleared once ingested.
  pendingHumanResult: Annotation({ default: () => null }),

  finalRecommendation: Annotation({ default: () => null }),

  lastAnalysisAt: Annotation({ default: () => null }),
  graphStatus: Annotation({ default: () => "new" }),
  errors: Annotation({ default: () => [] }),
  warnings: Annotation({ default: () => [] }),
});

const EVIDENCE_EXTRACTION_PROMPT = `You are the evidence-and-hypothesis stage of a healthcare compliance investigation assistant leading a real investigation, using Analysis of Competing Hypotheses (Heuer, CIA).

ABSOLUTE EVIDENCE RULES:
- The case notes arrive with immutable line labels like [L0001]. Every case-specific factual claim must trace to those lines.
- Create evidenceItems only for actual information in the notes. Cite lineStart/lineEnd; never invent a source, interview, audit, policy, date, witness, or record.
- Only grade sourceReliability/informationCredibility when you actually have a basis (a track record for the source, or corroboration for the item); otherwise leave them null. Never use these to judge a person's honesty — they grade the RECORD, not the witness.
- A finding must reference evidence item IDs. Record contradictory evidence instead of hiding it.

HYPOTHESES:
- List every materially plausible explanation (aim for 2-6): the allegation itself, and any innocent, authorized, mistaken, or alternative explanation genuinely left open by the notes. Do NOT invent a hypothesis the evidence has already eliminated, and do NOT force a false "balance" when only one explanation remains plausible.
- Do NOT assign percentages, probabilities, odds, or confidence scores to any hypothesis.

ACH MATRIX (build this — it is the actual method, not a summary):
- For EVERY evidence item, grade its consistency against EVERY hypothesis, graded in isolation from the other cells: "if this hypothesis were true, would this evidence surprise me?"
- Marks: strongly_consistent, consistent, neutral, inconsistent, strongly_inconsistent, not_applicable.
- Grade evidence primarily by what it is INCONSISTENT with, not by counting confirmations — the point of ACH is to find what each hypothesis contradicts, not what it agrees with.

unresolvedQuestions: material questions the evidence so far does not answer. Do not pad this list — omit an entry once nothing material remains open on it.`;

const KEY_ASSUMPTIONS_PROMPT = `You are the Key Assumptions Check stage. A leading explanation has been identified by Analysis of Competing Hypotheses scoring (fewest weighted inconsistencies). Surface the premises — explicit AND unstated — that this leading explanation depends on.

For each assumption:
- assumptionType: implicit (unstated), boundary (holds only within some scope), absence_of_evidence ("no report of X means X didn't happen" — silence is not evidence), or explicit (stated in the notes).
- grounding: weak (no real support), partial (some support or scope-limited), or strong (evidence-backed).
- sensitivity: how much the conclusion would change if this assumption were wrong (low/medium/high).
- disposition: re-source (go verify it), test (a concrete step would test it), bound (the conclusion should be scoped to where it holds — likely not resolvable further), or flag (document as an unresolved limitation — likely not resolvable further).

Do not rate everything medium to dodge the hard call. Do not treat consensus ("everyone assumes X") as grounding.`;

const RECOMMEND_ACTION_PROMPT = `You are the Next Best Investigative Action stage. You are given a ranked shortlist of investigative gaps computed from the structured analysis (Analysis of Competing Hypotheses + Key Assumptions Check) — pivotal evidence the ranking hinges on, unresolved contradictions against the leading explanation, weak load-bearing assumptions, and other open questions, ordered by how much each could realistically change or discriminate the current conclusion.

Pick exactly ONE candidate from the shortlist (set targetGapId to its id) and turn it into one concrete action. Prefer objective evidence (a record, a log, a timestamp) over an interview when an untried objective record could resolve it. Prefer an interview when the open question is about a person's knowledge, intent, or authorization. Prefer comparing to a specific policy provision when organization policy context is available and relevant.

If the action is an interview, populate suggestedQuestions with a short, focused list. If it is a document/record/log request, populate documentRequest with exactly what to obtain.

Never recommend an action that matches one already attempted below — pick a different candidate, or return actionType NO_FURTHER_REASONABLE_ACTION if nothing on the shortlist is realistically obtainable.`;

const FINAL_RECOMMENDATION_PROMPT = `You are drafting the final AI recommendation for human review. No material, reasonably-resolvable investigative gap remains — the structured analysis (ACH ranking, sensitivity, key assumptions) is provided below.

Only use "substantiated", "unsubstantiated", or "inconclusive" for recommendedDetermination when the case objective or supplied context actually calls for that kind of determination. Never invent an organization's legal or disciplinary standard — if none was supplied and the framing does not call for one, use "not_applicable" and frame the rationale around what the evidence shows instead.

This is a RECOMMENDATION, not a decision — a human makes the final determination. Write the rationale so it stands on the ACH ranking and key assumptions actually given to you, not on anything outside them.`;

function contextBlock(state) {
  return [
    state.caseObjective ? `Case objective: ${state.caseObjective}` : null,
    state.allegations ? `Allegation / issue being investigated: ${state.allegations}` : null,
    state.organizationContext ? `--- ORGANIZATION POLICY CONTEXT (context only, not case facts) ---\n${state.organizationContext}` : null,
  ].filter(Boolean).join("\n\n");
}

function buildEvidenceExtractionUserMessage(state) {
  const ctx = contextBlock(state);
  return `${ctx ? `${ctx}\n\n` : ""}Analyze the line-numbered investigation notes below. Extract evidence, build the competing hypotheses, and complete the full ACH matrix (every evidence item x every hypothesis).\n\n--- CASE NOTES ---\n${numberReportLines(state.caseNotes)}\n--- END CASE NOTES ---`;
}

function buildKeyAssumptionsUserMessage(state) {
  const leader = state.achResult.ranking[0];
  const { supportingEvidenceIds, contradictingEvidenceIds } = evidenceForAgainst(state.achMatrix, leader.hypothesisId);
  const describeEvidence = (ids) => ids.map((id) => {
    const ev = state.evidenceItems.find((e) => e.id === id);
    return ev ? `${id}: ${ev.summary}` : id;
  });
  return `Leading explanation (fewest weighted inconsistencies): ${leader.label}\n\nEvidence consistent with it:\n${JSON.stringify(describeEvidence(supportingEvidenceIds), null, 2)}\n\nEvidence inconsistent with it (loose ends):\n${JSON.stringify(describeEvidence(contradictingEvidenceIds), null, 2)}\n\nCase objective: ${state.caseObjective}`;
}

function describeAttemptedActions(actionHistory) {
  const attempted = (actionHistory || []).filter((a) => a.status === "completed" || a.status === "unavailable");
  if (attempted.length === 0) return "None yet.";
  return attempted.map((a) => `- [${a.status}] ${a.actionType}: ${a.evidenceOrPersonNeeded}`).join("\n");
}

function buildRecommendActionUserMessage(state, candidates) {
  const ctx = contextBlock(state);
  return `${ctx ? `${ctx}\n\n` : ""}Ranked candidate investigative gaps (most diagnostic first):\n${JSON.stringify(candidates, null, 2)}\n\nActions already attempted (do not repeat these):\n${describeAttemptedActions(state.actionHistory)}`;
}

function buildFinalRecommendationUserMessage(state) {
  const ctx = contextBlock(state);
  return `${ctx ? `${ctx}\n\n` : ""}ACH ranking (fewest weighted inconsistencies first):\n${JSON.stringify(state.achResult.ranking, null, 2)}\n\nSensitivity: ${JSON.stringify(state.sensitivity, null, 2)}\n\nKey assumptions behind the leading explanation:\n${JSON.stringify(state.keyAssumptions, null, 2)}\n\nRemaining limitations (not reasonably resolvable further):\n${JSON.stringify(state.investigativeGaps, null, 2)}`;
}

// Deterministic anti-repetition check — never trusted to the model's memory
// of its own prompt, since it has none between calls. Normalized comparison
// on actionType + evidenceOrPersonNeeded against actions already attempted
// (completed or reported unavailable) only.
function matchesAttemptedAction(action, actionHistory) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return (actionHistory || []).some(
    (a) => (a.status === "completed" || a.status === "unavailable")
      && a.actionType === action.actionType
      && norm(a.evidenceOrPersonNeeded) === norm(action.evidenceOrPersonNeeded),
  );
}

function pushError(state, node, error) {
  return {
    errors: [...(state.errors || []), { node, message: error?.message || String(error), at: new Date().toISOString() }],
    graphStatus: "error",
  };
}

// model is injectable so tests can supply a fake instead of a real provider
// call — same "structured for testability" posture as the legacy path's
// callStructuredWithRetry tests.
export function buildInvestigationGraph({ model } = {}) {
  // Lazy and memoized: constructing ChatAnthropic() eagerly would require an
  // API key even for routes that never call the model at all (GET /state,
  // or POST /resume//start short-circuiting on an already-existing/missing
  // case). The real client is only built the first time a node that
  // actually needs it runs.
  let chatModel;
  const structuredModels = new Map();
  function getChatModel() {
    if (!chatModel) chatModel = model || new ChatAnthropic({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5" });
    return chatModel;
  }
  function structuredModel(schema) {
    if (!structuredModels.has(schema)) structuredModels.set(schema, getChatModel().withStructuredOutput(schema));
    return structuredModels.get(schema);
  }

  // Shared by analyzeEvidence and reanalyze: the graph names these as two
  // steps in the loop (first pass vs. after new human evidence), but the
  // reasoning is identical — re-run evidence extraction, hypothesis
  // building, and the ACH matrix against the current authoritative case
  // notes. Registering the same handler under two node names keeps the
  // graph's explicit topology without duplicating the prompt/call logic.
  async function runEvidenceAnalysis(state) {
    let raw;
    try {
      raw = await structuredModel(EvidenceExtractionZ).invoke([
        { role: "system", content: EVIDENCE_EXTRACTION_PROMPT },
        { role: "user", content: buildEvidenceExtractionUserMessage(state) },
      ]);
    } catch (error) {
      // A model response failing schema validation must not be silently
      // accepted — record it and halt the graph rather than proceeding on
      // garbage.
      return pushError(state, "analyzeEvidence", error);
    }

    const evidenceItems = validateEvidenceItems(raw.evidenceItems, state.caseNotes);
    const findings = groundFindings(raw.findings, evidenceItems);
    const validEvidenceIds = new Set(evidenceItems.map((e) => e.id));
    const validHypothesisIds = new Set((raw.hypotheses || []).map((h) => h.id));

    // Invalidated evidence must change the analysis: an ACH matrix row that
    // cites evidence which failed citation validation is dropped entirely,
    // not kept with a stale mark — the same "strip, don't repair" posture
    // as evidence citations themselves.
    const achMatrix = (raw.achMatrix || [])
      .filter((row) => validEvidenceIds.has(row.evidenceId))
      .map((row) => ({
        evidenceId: row.evidenceId,
        marks: Object.fromEntries(Object.entries(row.marks || {}).filter(([hid]) => validHypothesisIds.has(hid))),
      }));

    const hypotheses = raw.hypotheses || [];
    const achResult = hypotheses.length > 0 ? scoreAch(hypotheses, achMatrix) : { ranking: [], diagnosticity: [], mostDiagnosticEvidenceIds: [], mostDiagnosticSpread: 0 };
    const sensitivity = hypotheses.length > 1 ? sensitivityAnalysis(hypotheses, achMatrix) : { currentLeaderId: hypotheses[0]?.id || null, pivotalEvidenceIds: [], flips: [] };

    return {
      evidenceItems,
      findings,
      hypotheses,
      achMatrix,
      achResult,
      sensitivity,
      unresolvedQuestions: Array.isArray(raw.unresolvedQuestions) ? raw.unresolvedQuestions : [],
      lastAnalysisAt: new Date().toISOString(),
      graphStatus: "analyzed",
    };
  }

  function afterAnalysisRouter(state) {
    return state.graphStatus === "error" ? END : "assessKeyAssumptions";
  }

  async function assessKeyAssumptions(state) {
    if (!state.achResult?.ranking?.length) {
      return { keyAssumptions: [] };
    }
    let raw;
    try {
      raw = await structuredModel(KeyAssumptionsCheckZ).invoke([
        { role: "system", content: KEY_ASSUMPTIONS_PROMPT },
        { role: "user", content: buildKeyAssumptionsUserMessage(state) },
      ]);
    } catch (error) {
      return pushError(state, "assessKeyAssumptions", error);
    }
    // Category is computed deterministically from grounding x sensitivity —
    // never trusted from the model's own label.
    const keyAssumptions = (raw.keyAssumptions || []).map((a) => ({ ...a, category: categorizeAssumption(a.grounding, a.sensitivity) }));
    return { keyAssumptions, graphStatus: "assumptions_checked" };
  }

  function afterAssumptionsRouter(state) {
    return state.graphStatus === "error" ? END : "computeReadiness";
  }

  // Pure/deterministic — no model call. Replaces the old 8-sufficiency-
  // check closure brain: readiness is computed from investigativeGaps
  // (themselves derived from ACH sensitivity + unresolved contradictions +
  // key uncertainties), never announced by the model.
  function computeReadiness(state) {
    const investigativeGaps = identifyInvestigativeGaps(state);
    const investigationStatus = computeInvestigationStatus(investigativeGaps);
    return {
      investigativeGaps,
      investigationStatus,
      graphStatus: investigationStatus === "incomplete" ? "awaiting_next_action" : "awaiting_human_review",
    };
  }

  function afterReadinessRouter(state) {
    return state.investigationStatus === "incomplete" ? "recommendNextBestAction" : "readyForHumanReview";
  }

  async function recommendNextBestAction(state) {
    const candidates = rankGaps(state.investigativeGaps.filter((g) => g.resolvable)).slice(0, 5);
    const messages = [
      { role: "system", content: RECOMMEND_ACTION_PROMPT },
      { role: "user", content: buildRecommendActionUserMessage(state, candidates) },
    ];
    let action;
    try {
      action = await structuredModel(NextActionZ).invoke(messages);
      if (matchesAttemptedAction(action, state.actionHistory)) {
        // One corrective retry with explicit feedback — same "tell it
        // exactly what was wrong" pattern as the legacy path's structured-
        // output retry, applied here to a repetition mistake instead of a
        // schema mistake. Bounded: accept the second attempt regardless.
        action = await structuredModel(NextActionZ).invoke([
          ...messages,
          { role: "assistant", content: JSON.stringify(action) },
          { role: "user", content: `That action (${action.actionType}: ${action.evidenceOrPersonNeeded}) was already attempted. Pick a different candidate from the shortlist, or NO_FURTHER_REASONABLE_ACTION if nothing else is realistically obtainable.` },
        ]);
      }
    } catch (error) {
      return pushError(state, "recommendNextBestAction", error);
    }
    return {
      currentNextBestAction: action,
      actionHistory: [
        ...(state.actionHistory || []),
        { actionType: action.actionType, evidenceOrPersonNeeded: action.evidenceOrPersonNeeded, targetGapId: action.targetGapId, status: "recommended" },
      ],
      graphStatus: "awaiting_human_action",
    };
  }

  function afterRecommendRouter(state) {
    return state.graphStatus === "error" ? END : "humanActionInterrupt";
  }

  // Deliberately nothing before interrupt() — interrupt() re-runs the
  // containing node from the top on resume, so any model call placed
  // before it in the same node would re-fire on every resume. This node
  // does no processing at all; ingestHumanResult (a separate node reached
  // by a plain edge, not replayed by the interrupt) does that.
  function humanActionInterrupt(state) {
    const resumeValue = interrupt({
      kind: "next_best_action",
      recommendedAction: state.currentNextBestAction,
      caseObjective: state.caseObjective,
      message: "Investigation paused. Provide the result of the recommended action, or any new evidence.",
    });
    return { pendingHumanResult: resumeValue };
  }

  // Validates the resumed payload even though the API route already
  // validates it before ever issuing Command({resume}) — this is the
  // second line of defense for anything that reaches the graph directly.
  // Malformed input does not get silently accepted or blended into case
  // notes.
  function ingestHumanResult(state) {
    const parsed = HumanResultZ.safeParse(state.pendingHumanResult);
    if (!parsed.success) {
      return {
        ...pushError(state, "ingestHumanResult", new Error(`Malformed human input: ${parsed.error.issues.map((i) => i.message).join("; ")}`)),
        pendingHumanResult: null,
      };
    }
    const { resultType, text } = parsed.data;

    const label = {
      interview_notes: "NEW EVIDENCE (interview notes)",
      document: "NEW EVIDENCE (document)",
      response: "NEW EVIDENCE",
      unavailable: "ACTION OUTCOME: COULD NOT BE OBTAINED",
      correction: "CORRECTION TO PRIOR FACTS",
    }[resultType];

    const pendingAction = state.currentNextBestAction;
    const attemptStatus = resultType === "unavailable" ? "unavailable" : "completed";
    // Never overwrite historical evidence silently — mark the matching
    // "recommended" entry in place, everything else in actionHistory is
    // untouched, and the raw human input is appended (never replaced) both
    // into the audit trail (humanInputs) and into the authoritative notes.
    const actionHistory = (state.actionHistory || []).map((a) =>
      a.status === "recommended" && pendingAction && a.actionType === pendingAction.actionType && a.evidenceOrPersonNeeded === pendingAction.evidenceOrPersonNeeded
        ? { ...a, status: attemptStatus }
        : a,
    );

    return {
      caseNotes: `${state.caseNotes}\n\n--- ${label} ---\n${text}`,
      humanInputs: [
        ...(state.humanInputs || []),
        { resultType, text, respondingToAction: pendingAction, at: new Date().toISOString() },
      ],
      actionHistory,
      completedActions: actionHistory.filter((a) => a.status === "completed" || a.status === "unavailable"),
      pendingHumanResult: null,
      graphStatus: "ingested",
    };
  }

  function afterIngestRouter(state) {
    return state.graphStatus === "error" ? END : "reanalyze";
  }

  // Pauses with the full final-recommendation packet. Case closure and
  // discipline stay out of scope — the graph does not autonomously close
  // the case; humanFinalDetermination is always "pending" until a human
  // acts outside this graph. If this ever resumes, the response is just
  // recorded as an acknowledgment; there is nowhere further to route.
  async function readyForHumanReview(state) {
    const leader = state.achResult.ranking[0] || null;
    const { supportingEvidenceIds, contradictingEvidenceIds } = leader ? evidenceForAgainst(state.achMatrix, leader.hypothesisId) : { supportingEvidenceIds: [], contradictingEvidenceIds: [] };

    let draft;
    try {
      draft = await structuredModel(FinalRecommendationZ).invoke([
        { role: "system", content: FINAL_RECOMMENDATION_PROMPT },
        { role: "user", content: buildFinalRecommendationUserMessage(state) },
      ]);
    } catch (error) {
      return pushError(state, "readyForHumanReview", error);
    }

    const finalRecommendation = {
      recommendedDetermination: draft.recommendedDetermination,
      leadingHypothesis: leader ? state.hypotheses.find((h) => h.id === leader.hypothesisId) : null,
      competingHypotheses: state.achResult.ranking.slice(1).map((r) => state.hypotheses.find((h) => h.id === r.hypothesisId)).filter(Boolean),
      evidenceSupporting: supportingEvidenceIds,
      evidenceContradicting: contradictingEvidenceIds,
      mostDiagnosticEvidenceIds: state.achResult.mostDiagnosticEvidenceIds,
      achResult: state.achResult,
      sensitivity: state.sensitivity,
      keyAssumptions: state.keyAssumptions,
      remainingLimitations: state.investigativeGaps,
      whatCouldChangeThis: draft.whatCouldChangeThis,
      aiRationale: draft.rationale,
      humanFinalDetermination: "pending",
    };

    const ack = interrupt({
      kind: "ready_for_human_review",
      finalRecommendation,
      investigationStatus: state.investigationStatus,
      message: "Investigation has reached a review point. This is an AI recommendation, not a decision — the graph does not close the case automatically.",
    });

    const base = { finalRecommendation };
    if (ack === undefined || ack === null) return base;
    return { ...base, humanInputs: [...(state.humanInputs || []), { resultType: "review_acknowledgment", text: String(ack), respondingToAction: null, at: new Date().toISOString() }] };
  }

  const graph = new StateGraph(InvestigationState)
    .addNode("openCase", openCaseNode)
    .addNode("analyzeEvidence", runEvidenceAnalysis)
    .addNode("assessKeyAssumptions", assessKeyAssumptions)
    .addNode("computeReadiness", computeReadiness)
    .addNode("recommendNextBestAction", recommendNextBestAction)
    .addNode("humanActionInterrupt", humanActionInterrupt)
    .addNode("ingestHumanResult", ingestHumanResult)
    .addNode("reanalyze", runEvidenceAnalysis)
    .addNode("readyForHumanReview", readyForHumanReview)
    .addEdge(START, "openCase")
    .addEdge("openCase", "analyzeEvidence")
    .addConditionalEdges("analyzeEvidence", afterAnalysisRouter, ["assessKeyAssumptions", END])
    .addConditionalEdges("assessKeyAssumptions", afterAssumptionsRouter, ["computeReadiness", END])
    .addConditionalEdges("computeReadiness", afterReadinessRouter, ["recommendNextBestAction", "readyForHumanReview"])
    .addConditionalEdges("recommendNextBestAction", afterRecommendRouter, ["humanActionInterrupt", END])
    .addEdge("humanActionInterrupt", "ingestHumanResult")
    .addConditionalEdges("ingestHumanResult", afterIngestRouter, ["reanalyze", END])
    .addConditionalEdges("reanalyze", afterAnalysisRouter, ["assessKeyAssumptions", END])
    .addEdge("readyForHumanReview", END);

  return graph;
}

// Pure initialization/defaulting — "load or initialize" state for a caseId.
// Genuine idempotency (never re-running this against an already-open case)
// is guaranteed one level up, by the API route: POST /start checks
// graph.getState() first and only calls invoke() at all for a case that has
// no existing checkpoint.
function openCaseNode(state) {
  return {
    caseObjective: state.caseObjective || state.allegations || "Investigate the reported concern.",
    graphStatus: "open",
  };
}
