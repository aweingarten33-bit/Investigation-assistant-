import { Annotation, StateGraph, START, END, interrupt } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { hydrateEvidenceTraceability, numberReportLines } from "../lib/investigation-utils.js";
import { normalizeSufficiencyChecks } from "../routes/analyze-report.js";
import { EvidenceAnalysisZ, NextActionZ, HumanResultZ } from "./schemas.js";

// --- State -------------------------------------------------------------
// caseId/caseObjective/allegations/organizationContext are investigator-
// supplied case framing. evidenceItems/findings/hypotheses/sufficiencyChecks
// /closureAssessment are produced by the transplanted legacy logic. The
// rest is graph bookkeeping (no signature, no client-echoed round-trip —
// the checkpointer is the only thing carrying any of this between calls).
export const InvestigationState = Annotation.Root({
  caseId: Annotation({ default: () => "" }),
  caseObjective: Annotation({ default: () => "" }),
  allegations: Annotation({ default: () => "" }),
  organizationContext: Annotation({ default: () => "" }),
  caseNotes: Annotation({ default: () => "" }),

  evidenceItems: Annotation({ default: () => [] }),
  findings: Annotation({ default: () => [] }),
  hypotheses: Annotation({ default: () => [] }),
  sufficiencyChecks: Annotation({ default: () => [] }),
  closureAssessment: Annotation({ default: () => null }),
  unresolvedQuestions: Annotation({ default: () => [] }),
  // "incomplete" | "provisional" | "ready_for_review" — set by
  // assessSufficiency from closureAssessment.status. Kept as its own field
  // (not re-derived ad hoc) so the UI reads one clear value instead of
  // re-interpreting the closure gate itself.
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

  lastAnalysisAt: Annotation({ default: () => null }),
  graphStatus: Annotation({ default: () => "new" }),
  errors: Annotation({ default: () => [] }),
  warnings: Annotation({ default: () => [] }),
});

const ANALYZE_EVIDENCE_PROMPT = `You are the evidence-analysis stage of a healthcare compliance investigation assistant leading a real investigation. You do NOT make employment decisions and you do NOT write a final report — you build the evidence map, test competing explanations, surface unresolved questions, and assess whether enough is known yet.

ABSOLUTE EVIDENCE RULES:
- The case notes arrive with immutable line labels like [L0001]. Every case-specific factual claim must trace to those lines.
- Create evidenceItems only for actual information in the notes. Cite lineStart/lineEnd; never invent a source, interview, audit, policy, date, witness, or record.
- A finding must reference evidence item IDs. Record contradictory evidence instead of hiding it.
- Organization policy context, when provided, is CONTEXT for interpreting the case — never treat it as a case fact, and never invent policy provisions not given to you.

HYPOTHESIS-DRIVEN INVESTIGATION RULES:
- Build 1-6 competing hypotheses. Include the allegation/violation hypothesis and, when the notes actually support or leave room for one, the strongest plausible innocent, authorized, mistaken, or alternative explanation. A single hypothesis is appropriate once alternatives have been genuinely eliminated by the evidence — do not invent one merely for balance.
- Do NOT assign percentages, probabilities, odds, or pseudo-scientific confidence. Use only: supported, partially_supported, weakened, unresolved, contradicted.
- List unresolvedQuestions: the specific material questions the evidence so far does not answer. Do not pad this list — omit it (empty array) once nothing material remains open.

INVESTIGATION SUFFICIENCY:
- Return EXACTLY one check for each of these IDs: finding_support, contradictory_evidence, objective_records, key_witnesses, material_inconsistencies, policy_regulatory_context, standard_of_proof, reporting_escalation.
- material=true only when the unresolved issue could reasonably change the finding or whether the case can fairly close.
- resolvable=true only when a realistic remaining investigative step could still answer the issue.
- evidenceIds must list the evidence item IDs this check's status is actually based on; leave empty only when no evidence bears on the check yet.
- Do not decide overall closure yourself — that is computed deterministically from your checks.`;

const RECOMMEND_ACTION_PROMPT = `You are the Next Best Investigative Action stage of a compliance investigation assistant leading a real investigation. Given the current evidence, findings, competing explanations, and unresolved sufficiency checks, recommend exactly ONE next investigative action — the single most useful thing to do next, not a list of options.

Prefer objective evidence (an audit log, a system access record, a timestamp) over an interview when an untried objective record could resolve the same open question. Prefer an interview when the open question is fundamentally about a person's knowledge, intent, or authorization, or when no record plausibly exists. Prefer comparing evidence against a specific policy provision when organization policy context is available and the open question is whether conduct was authorized or against policy.

If the action is an interview, populate suggestedQuestions with a short, focused list. If it is a document/record/log request, populate documentRequest with exactly what to obtain.

Never recommend an action that matches one already marked completed below — pick something that has not already been tried, or return actionType NO_FURTHER_REASONABLE_ACTION if nothing else is realistically obtainable.`;

function buildEvidenceAnalysisUserMessage(state) {
  const contextBlock = [
    state.caseObjective ? `Case objective: ${state.caseObjective}` : null,
    state.allegations ? `Allegation / issue being investigated: ${state.allegations}` : null,
    state.organizationContext ? `--- ORGANIZATION POLICY CONTEXT (context only, not case facts) ---\n${state.organizationContext}` : null,
  ].filter(Boolean).join("\n\n");

  return `${contextBlock ? `${contextBlock}\n\n` : ""}Analyze the line-numbered investigation notes below. Build an evidence map, test competing hypotheses, list unresolved material questions, and complete all eight sufficiency checks.\n\n--- CASE NOTES ---\n${numberReportLines(state.caseNotes)}\n--- END CASE NOTES ---`;
}

function describeCompletedActions(actionHistory) {
  const completed = (actionHistory || []).filter((a) => a.status === "completed" || a.status === "unavailable");
  if (completed.length === 0) return "None yet.";
  return completed.map((a) => `- [${a.status}] ${a.actionType}: ${a.evidenceOrPersonNeeded}`).join("\n");
}

function buildRecommendActionUserMessage(state) {
  const contextBlock = [
    state.caseObjective ? `Case objective: ${state.caseObjective}` : null,
    state.organizationContext ? `Organization policy context is available and may be relevant.` : null,
  ].filter(Boolean).join("\n");

  return `${contextBlock ? `${contextBlock}\n\n` : ""}Unresolved sufficiency checks:\n${JSON.stringify(state.sufficiencyChecks.filter((c) => c.status === "unresolved"), null, 2)}\n\nUnresolved questions:\n${JSON.stringify(state.unresolvedQuestions, null, 2)}\n\nCurrent findings:\n${JSON.stringify(state.findings, null, 2)}\n\nCompeting explanations:\n${JSON.stringify(state.hypotheses, null, 2)}\n\nActions already attempted (do not repeat these):\n${describeCompletedActions(state.actionHistory)}`;
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

// closureAssessment.status ("not_ready_to_close" | "ready_with_unresolved_limitations"
// | "ready_to_close", from the transplanted deriveClosureAssessment) maps to
// the three-way distinction the spec requires the graph to make explicit.
function mapInvestigationStatus(closureStatus) {
  if (closureStatus === "ready_to_close") return "ready_for_review";
  if (closureStatus === "ready_with_unresolved_limitations") return "provisional";
  return "incomplete";
}

function buildReviewSummary(state) {
  return {
    caseObjective: state.caseObjective,
    investigationStatus: state.investigationStatus,
    whatEvidenceSupports: state.findings.map((f) => ({ id: f.id, statement: f.statement, evidenceStatus: f.evidenceStatus })),
    whatRemainsUncertain: [
      ...state.unresolvedQuestions,
      ...state.sufficiencyChecks.filter((c) => c.status === "unresolved").map((c) => c.rationale),
    ],
    competingExplanations: state.hypotheses.map((h) => ({ id: h.id, label: h.label, state: h.state })),
    evidentiaryLimitations: state.closureAssessment?.unresolvedMaterialIssues || [],
    closureAssessment: state.closureAssessment,
  };
}

// model is injectable so tests can supply a fake instead of a real provider
// call — same "structured for testability" posture as the legacy path's
// callStructuredWithRetry tests.
export function buildInvestigationGraph({ model } = {}) {
  // Lazy and memoized: constructing ChatAnthropic() eagerly here would
  // require an API key even for routes that never call the model at all
  // (GET /state, or POST /resume/​/start short-circuiting on an
  // already-existing/missing case). The real client is only built the
  // first time a node that actually needs it runs.
  let chatModel;
  let evidenceAnalysisModel;
  let nextActionModel;
  function getChatModel() {
    if (!chatModel) chatModel = model || new ChatAnthropic({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5" });
    return chatModel;
  }
  function getEvidenceAnalysisModel() {
    if (!evidenceAnalysisModel) evidenceAnalysisModel = getChatModel().withStructuredOutput(EvidenceAnalysisZ);
    return evidenceAnalysisModel;
  }
  function getNextActionModel() {
    if (!nextActionModel) nextActionModel = getChatModel().withStructuredOutput(NextActionZ);
    return nextActionModel;
  }

  // Shared by the analyzeEvidence and reanalyze nodes: the spec calls these
  // out as two named steps in the loop (first pass vs. after new human
  // evidence), but the reasoning they run is identical — re-run evidence
  // grounding against the current authoritative case notes. Registering the
  // same handler under two node names keeps the graph's explicit topology
  // without duplicating the prompt/call logic.
  async function runEvidenceAnalysis(state) {
    let raw;
    try {
      raw = await getEvidenceAnalysisModel().invoke([
        { role: "system", content: ANALYZE_EVIDENCE_PROMPT },
        { role: "user", content: buildEvidenceAnalysisUserMessage(state) },
      ]);
    } catch (error) {
      // A model response failing schema validation must not be silently
      // accepted — record it and halt the graph rather than proceeding on
      // garbage. withStructuredOutput throws (after its own internal
      // retries) when it cannot get valid structured output.
      return pushError(state, "analyzeEvidence", error);
    }
    const normalized = { ...raw, sufficiencyChecks: normalizeSufficiencyChecks(raw.sufficiencyChecks) };
    const hydrated = hydrateEvidenceTraceability(normalized, state.caseNotes);
    return {
      evidenceItems: hydrated.evidenceItems,
      findings: hydrated.findings,
      hypotheses: hydrated.hypotheses,
      sufficiencyChecks: hydrated.sufficiencyChecks,
      closureAssessment: hydrated.closureAssessment,
      unresolvedQuestions: Array.isArray(raw.unresolvedQuestions) ? raw.unresolvedQuestions : [],
      lastAnalysisAt: new Date().toISOString(),
      graphStatus: "analyzed",
    };
  }

  function afterAnalysisRouter(state) {
    return state.graphStatus === "error" ? END : "assessSufficiency";
  }

  // Pure/deterministic — no model call. Makes the three-way sufficiency
  // distinction ("investigation incomplete" / "enough for a provisional
  // determination" / "ready for human closure review") an explicit state
  // field, rather than leaving callers to re-derive it from the closure gate.
  function assessSufficiency(state) {
    const investigationStatus = mapInvestigationStatus(state.closureAssessment?.status);
    return {
      investigationStatus,
      graphStatus: investigationStatus === "incomplete" ? "awaiting_next_action" : "awaiting_human_review",
    };
  }

  function afterSufficiencyRouter(state) {
    if (state.graphStatus === "error") return END;
    return state.investigationStatus === "incomplete" ? "recommendNextBestAction" : "readyForHumanReview";
  }

  async function recommendNextBestAction(state) {
    const messages = [
      { role: "system", content: RECOMMEND_ACTION_PROMPT },
      { role: "user", content: buildRecommendActionUserMessage(state) },
    ];
    let action;
    try {
      action = await getNextActionModel().invoke(messages);
      if (matchesAttemptedAction(action, state.actionHistory)) {
        // One corrective retry with explicit feedback — same "tell it
        // exactly what was wrong" pattern as the legacy path's structured-
        // output retry, applied here to a repetition mistake instead of a
        // schema mistake. Bounded: accept the second attempt regardless.
        action = await getNextActionModel().invoke([
          ...messages,
          { role: "assistant", content: JSON.stringify(action) },
          { role: "user", content: `That action (${action.actionType}: ${action.evidenceOrPersonNeeded}) was already attempted. Recommend a different, not-yet-attempted action, or NO_FURTHER_REASONABLE_ACTION if nothing else is realistically obtainable.` },
        ]);
      }
    } catch (error) {
      return pushError(state, "recommendNextBestAction", error);
    }
    return {
      currentNextBestAction: action,
      actionHistory: [
        ...(state.actionHistory || []),
        { actionType: action.actionType, evidenceOrPersonNeeded: action.evidenceOrPersonNeeded, status: "recommended" },
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
  // second line of defense for anything that reaches the graph directly
  // (a test, a future non-HTTP caller). Malformed input does not get
  // silently accepted or blended into case notes.
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

  // Pauses again with a human-readable review packet. Case closure and
  // discipline stay out of scope for this slice — the graph does not
  // autonomously close the case. If this ever resumes, the response is
  // just recorded as an acknowledgment; there is nowhere further to route.
  function readyForHumanReview(state) {
    const ack = interrupt({
      kind: "ready_for_human_review",
      ...buildReviewSummary(state),
      message: "Investigation has reached a review point. This graph does not close the case automatically — a human decides.",
    });
    if (ack === undefined || ack === null) return {};
    return { humanInputs: [...(state.humanInputs || []), { resultType: "review_acknowledgment", text: String(ack), respondingToAction: null, at: new Date().toISOString() }] };
  }

  const graph = new StateGraph(InvestigationState)
    .addNode("openCase", openCaseNode)
    .addNode("analyzeEvidence", runEvidenceAnalysis)
    .addNode("assessSufficiency", assessSufficiency)
    .addNode("recommendNextBestAction", recommendNextBestAction)
    .addNode("humanActionInterrupt", humanActionInterrupt)
    .addNode("ingestHumanResult", ingestHumanResult)
    .addNode("reanalyze", runEvidenceAnalysis)
    .addNode("readyForHumanReview", readyForHumanReview)
    .addEdge(START, "openCase")
    .addEdge("openCase", "analyzeEvidence")
    .addConditionalEdges("analyzeEvidence", afterAnalysisRouter, ["assessSufficiency", END])
    .addConditionalEdges("assessSufficiency", afterSufficiencyRouter, ["recommendNextBestAction", "readyForHumanReview", END])
    .addConditionalEdges("recommendNextBestAction", afterRecommendRouter, ["humanActionInterrupt", END])
    .addEdge("humanActionInterrupt", "ingestHumanResult")
    .addConditionalEdges("ingestHumanResult", afterIngestRouter, ["reanalyze", END])
    .addConditionalEdges("reanalyze", afterAnalysisRouter, ["assessSufficiency", END])
    .addEdge("readyForHumanReview", END);

  return graph;
}

// Pure initialization/defaulting — "load or initialize" state for a caseId.
// Genuine idempotency (never re-running this against an already-open case)
// is guaranteed one level up, by the API route: POST /start checks
// graph.getState() first and only calls invoke() at all for a case that has
// no existing checkpoint. This node's own job is just establishing sane
// defaults from the initial input, which is safe to reason about regardless.
function openCaseNode(state) {
  return {
    caseObjective: state.caseObjective || state.allegations || "Investigate the reported concern.",
    graphStatus: "open",
  };
}
