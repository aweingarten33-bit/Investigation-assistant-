import { Annotation, StateGraph, START, END, interrupt } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { hydrateEvidenceTraceability, numberReportLines } from "../lib/investigation-utils.js";
import { normalizeSufficiencyChecks } from "../routes/analyze-report.js";
import { EvidenceAnalysisZ, NextActionZ, NEXT_ACTION_TYPES } from "./schemas.js";

// --- State -------------------------------------------------------------
// Everything here is either domain content produced by the transplanted
// legacy functions (evidenceItems/findings/hypotheses/sufficiencyChecks/
// closureAssessment) or bookkeeping the graph itself needs (actionHistory,
// nextAction). No signature, no client-echoed round-trip — the checkpointer
// is the only thing carrying this between calls.
export const InvestigationState = Annotation.Root({
  caseNotes: Annotation({ default: () => "" }),
  evidenceItems: Annotation({ default: () => [] }),
  findings: Annotation({ default: () => [] }),
  hypotheses: Annotation({ default: () => [] }),
  sufficiencyChecks: Annotation({ default: () => [] }),
  closureAssessment: Annotation({ default: () => null }),
  // Overwrite semantics (the default — no custom reducer), not append-only:
  // pauseForHuman needs to mark an existing entry "completed" in place, not
  // add a second copy alongside it. Each node that touches this returns the
  // complete array it wants, computed from state.actionHistory itself.
  actionHistory: Annotation({ default: () => [] }),
  nextAction: Annotation({ default: () => null }),
});

const ANALYZE_EVIDENCE_PROMPT = `You are the evidence-analysis stage of a healthcare compliance investigation assistant. You do NOT make employment decisions and you do NOT write a final report — you build the evidence map, test competing explanations, and assess whether enough is known yet.

ABSOLUTE EVIDENCE RULES:
- The case notes arrive with immutable line labels like [L0001]. Every case-specific factual claim must trace to those lines.
- Create evidenceItems only for actual information in the notes. Cite lineStart/lineEnd; never invent a source, interview, audit, policy, date, witness, or record.
- A finding must reference evidence item IDs. Record contradictory evidence instead of hiding it.
- Regulatory research and organization-specific rules are CONTEXT, never case facts (none is provided in this call).

HYPOTHESIS-DRIVEN INVESTIGATION RULES:
- Build 1-6 competing hypotheses. Include the allegation/violation hypothesis and, when the notes actually support or leave room for one, the strongest plausible innocent, authorized, mistaken, or alternative explanation. A single hypothesis is appropriate once alternatives have been genuinely eliminated by the evidence — do not invent one merely for balance.
- Do NOT assign percentages, probabilities, odds, or pseudo-scientific confidence. Use only: supported, partially_supported, weakened, unresolved, contradicted.

INVESTIGATION SUFFICIENCY:
- Return EXACTLY one check for each of these IDs: finding_support, contradictory_evidence, objective_records, key_witnesses, material_inconsistencies, policy_regulatory_context, standard_of_proof, reporting_escalation.
- material=true only when the unresolved issue could reasonably change the finding or whether the case can fairly close.
- resolvable=true only when a realistic remaining investigative step could still answer the issue.
- evidenceIds must list the evidence item IDs this check's status is actually based on; leave empty only when no evidence bears on the check yet.
- Do not decide overall closure yourself — that is computed deterministically from your checks.`;

const RECOMMEND_ACTION_PROMPT = `You are the Next Best Investigative Action stage of a compliance investigation assistant. Given the current evidence, findings, possible explanations, and unresolved sufficiency checks, recommend exactly ONE next investigative action — the single most useful thing to do next, not a list of options.

Prefer objective evidence (an audit log, a record, a timestamp) over an interview when an untried objective record could resolve the same open question. Prefer an interview when the open question is fundamentally about a person's knowledge, intent, or authorization, or when no record plausibly exists.

Never recommend an action that matches one already marked completed below — pick something that has not already been tried, or return actionType NO_FURTHER_REASONABLE_ACTION if nothing else is realistically obtainable.`;

function buildEvidenceAnalysisUserMessage(caseNotes) {
  return `Analyze the line-numbered investigation notes below. Build an evidence map, test competing hypotheses, and complete all eight sufficiency checks.\n\n--- CASE NOTES ---\n${numberReportLines(caseNotes)}\n--- END CASE NOTES ---`;
}

function describeCompletedActions(actionHistory) {
  const completed = (actionHistory || []).filter((a) => a.status === "completed");
  if (completed.length === 0) return "None yet.";
  return completed.map((a) => `- ${a.actionType}: ${a.evidenceOrPersonNeeded}`).join("\n");
}

function buildRecommendActionUserMessage(state) {
  return `Unresolved sufficiency checks:\n${JSON.stringify(state.sufficiencyChecks.filter((c) => c.status === "unresolved"), null, 2)}\n\nCurrent findings:\n${JSON.stringify(state.findings, null, 2)}\n\nPossible explanations:\n${JSON.stringify(state.hypotheses, null, 2)}\n\nActions already completed (do not repeat these):\n${describeCompletedActions(state.actionHistory)}`;
}

// Deterministic anti-repetition check — never trusted to the model's memory
// of its own prompt, since it has none between calls. Normalized comparison
// on actionType + evidenceOrPersonNeeded against completed actions only.
function matchesCompletedAction(action, actionHistory) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return (actionHistory || []).some(
    (a) => a.status === "completed" && a.actionType === action.actionType && norm(a.evidenceOrPersonNeeded) === norm(action.evidenceOrPersonNeeded),
  );
}

// --- Nodes ---------------------------------------------------------------
// model is injectable so tests can supply a fake instead of a real provider
// call — this is the same "structured for testability" posture the
// legacy path's callStructuredWithRetry tests already used tonight.
export function buildInvestigationGraph({ model } = {}) {
  const chatModel = model || new ChatAnthropic({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5" });
  const evidenceAnalysisModel = chatModel.withStructuredOutput(EvidenceAnalysisZ);
  const nextActionModel = chatModel.withStructuredOutput(NextActionZ);

  async function analyzeEvidence(state) {
    const raw = await evidenceAnalysisModel.invoke([
      { role: "system", content: ANALYZE_EVIDENCE_PROMPT },
      { role: "user", content: buildEvidenceAnalysisUserMessage(state.caseNotes) },
    ]);
    // Transplanted unchanged, same order as the legacy classify handler:
    // normalize sufficiency checks first, then hydrate (hydration's own
    // internal logic reopens any check whose evidence got invalidated).
    const normalized = { ...raw, sufficiencyChecks: normalizeSufficiencyChecks(raw.sufficiencyChecks) };
    const hydrated = hydrateEvidenceTraceability(normalized, state.caseNotes);
    return {
      evidenceItems: hydrated.evidenceItems,
      findings: hydrated.findings,
      hypotheses: hydrated.hypotheses,
      sufficiencyChecks: hydrated.sufficiencyChecks,
      closureAssessment: hydrated.closureAssessment,
    };
  }

  function shouldContinueInvestigating(state) {
    return state.closureAssessment?.status === "not_ready_to_close" ? "recommendNextAction" : END;
  }

  async function recommendNextAction(state) {
    const messages = [
      { role: "system", content: RECOMMEND_ACTION_PROMPT },
      { role: "user", content: buildRecommendActionUserMessage(state) },
    ];
    let action = await nextActionModel.invoke(messages);
    if (matchesCompletedAction(action, state.actionHistory)) {
      // One corrective retry with explicit feedback — same "tell it exactly
      // what was wrong" pattern as the legacy path's structured-output
      // retry, applied here to a repetition mistake instead of a schema
      // mistake. Bounded: accept the second attempt regardless.
      action = await nextActionModel.invoke([
        ...messages,
        { role: "assistant", content: JSON.stringify(action) },
        { role: "user", content: `That action (${action.actionType}: ${action.evidenceOrPersonNeeded}) was already completed. Recommend a different, not-yet-attempted action, or NO_FURTHER_REASONABLE_ACTION if nothing else is realistically obtainable.` },
      ]);
    }
    return {
      nextAction: action,
      actionHistory: [
        ...(state.actionHistory || []),
        { actionType: action.actionType, evidenceOrPersonNeeded: action.evidenceOrPersonNeeded, status: "recommended" },
      ],
    };
  }

  // Deliberately its own node with nothing before the interrupt() call —
  // interrupt() re-runs the containing node from the top on resume, so any
  // model call placed before it in the same node would re-fire on every
  // resume. Keeping it isolated here means resuming costs nothing but this.
  function pauseForHuman(state) {
    const newEvidenceText = interrupt({
      recommendedAction: state.nextAction,
      message: "Investigation paused. Provide the result of the recommended action, or any new evidence.",
    });
    const completedHistory = (state.actionHistory || []).map((a) =>
      a.status === "recommended" && a.actionType === state.nextAction.actionType
        ? { ...a, status: "completed" }
        : a,
    );
    return {
      caseNotes: `${state.caseNotes}\n\n--- NEW EVIDENCE ---\n${newEvidenceText}`,
      actionHistory: completedHistory,
    };
  }

  const graph = new StateGraph(InvestigationState)
    .addNode("analyzeEvidence", analyzeEvidence)
    .addNode("recommendNextAction", recommendNextAction)
    .addNode("pauseForHuman", pauseForHuman)
    .addEdge(START, "analyzeEvidence")
    .addConditionalEdges("analyzeEvidence", shouldContinueInvestigating, ["recommendNextAction", END])
    .addEdge("recommendNextAction", "pauseForHuman")
    .addEdge("pauseForHuman", "analyzeEvidence");

  return graph;
}
