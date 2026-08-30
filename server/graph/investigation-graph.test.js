// @vitest-environment node
//
// Proves the LangGraph mechanics without needing a real model call: that
// case state is not merely process memory (a fresh checkpointer instance
// pointed at the same file restores it), that interrupt/resume actually
// works across both pause points (next-best-action and ready-for-review),
// that the deterministic anti-repetition guard fires, that a model schema
// failure halts the graph instead of being silently accepted, that
// malformed human input is rejected rather than blended into the case, and
// that evidence invalidation reopens a previously satisfied sufficiency
// check. The semantic "does the AI reason well about real evidence"
// question is covered separately by investigation-graph.live.test.js,
// gated behind a real API key.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Command } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { buildInvestigationGraph } from "./investigation-graph.js";
import { EvidenceAnalysisZ, NextActionZ } from "./schemas.js";

function makeFakeModel({ evidenceAnalysisResponses, nextActionResponses }) {
  let evidenceIdx = 0;
  let actionIdx = 0;
  const evidenceCalls = [];
  const actionCalls = [];
  return {
    withStructuredOutput(schema) {
      if (schema === EvidenceAnalysisZ) {
        return {
          invoke: async (messages) => {
            evidenceCalls.push(messages);
            const i = Math.min(evidenceIdx, evidenceAnalysisResponses.length - 1);
            evidenceIdx += 1;
            const response = evidenceAnalysisResponses[i];
            if (response instanceof Error) throw response;
            return response;
          },
        };
      }
      if (schema === NextActionZ) {
        return {
          invoke: async (messages) => {
            actionCalls.push(messages);
            const i = Math.min(actionIdx, nextActionResponses.length - 1);
            actionIdx += 1;
            const response = nextActionResponses[i];
            if (response instanceof Error) throw response;
            return response;
          },
        };
      }
      throw new Error("makeFakeModel: unexpected schema passed to withStructuredOutput");
    },
    _calls: { evidenceCalls, actionCalls },
  };
}

const unresolvedCheck = (id, overrides = {}) => ({
  id, status: "unresolved", material: true, resolvable: true,
  rationale: `${id} needs more work`, nextAction: `Resolve ${id}`, evidenceIds: [], ...overrides,
});
const satisfiedCheck = (id, overrides = {}) => ({
  id, status: "satisfied", material: true, resolvable: false,
  rationale: `${id} is satisfied`, nextAction: "", evidenceIds: [], ...overrides,
});
const ALL_CHECK_IDS = ["finding_support", "contradictory_evidence", "objective_records", "key_witnesses", "material_inconsistencies", "policy_regulatory_context", "standard_of_proof", "reporting_escalation"];

function evidenceAnalysisResponse({ unresolvedIds = [], evidenceItems = [], findings = [], hypotheses, checkOverrides = {} }) {
  return {
    evidenceItems,
    findings,
    hypotheses: hypotheses || [{ id: "H1", label: "Possible diversion", description: "Access/discrepancy could reflect diversion or a documentation error.", state: "unresolved", supportingEvidenceIds: [], contradictingEvidenceIds: [], unresolvedQuestions: [] }],
    sufficiencyChecks: ALL_CHECK_IDS.map((id) => (unresolvedIds.includes(id) ? unresolvedCheck(id, checkOverrides[id]) : satisfiedCheck(id, checkOverrides[id]))),
    unresolvedQuestions: unresolvedIds.map((id) => `Open question for ${id}`),
  };
}

function nextAction(overrides = {}) {
  return {
    actionType: "INTERVIEW",
    action: "Interview the relevant witness",
    whyThisIsNext: "No witness account exists yet",
    evidenceGapAddressed: "key_witnesses",
    evidenceOrPersonNeeded: "Nurse Alvarez",
    suggestedQuestions: ["Did you administer the second dose?"],
    documentRequest: "",
    expectedInformationGain: "Confirms who administered the dose",
    whatCouldChangeBasedOnResult: "Could confirm or rule out diversion",
    ...overrides,
  };
}

const CASE_NOTES = "Medication count discrepancy on Unit 4B.";

describe("investigation graph — mechanics", () => {
  let dbDir;
  let dbPath;

  beforeEach(() => {
    dbDir = mkdtempSync(path.join(tmpdir(), "investigation-graph-test-"));
    dbPath = path.join(dbDir, "checkpoints.sqlite");
  });

  afterEach(() => {
    rmSync(dbDir, { recursive: true, force: true });
  });

  function invoke(threadId, model, input) {
    const graph = buildInvestigationGraph({ model }).compile({ checkpointer: SqliteSaver.fromConnString(dbPath) });
    return graph.invoke(input, { configurable: { thread_id: threadId } });
  }

  function getState(threadId, model) {
    const graph = buildInvestigationGraph({ model }).compile({ checkpointer: SqliteSaver.fromConnString(dbPath) });
    return graph.getState({ configurable: { thread_id: threadId } });
  }

  it("pauses at humanActionInterrupt with a recommended action when evidence is incomplete", async () => {
    const model = makeFakeModel({
      evidenceAnalysisResponses: [evidenceAnalysisResponse({ unresolvedIds: ["key_witnesses"] })],
      nextActionResponses: [nextAction()],
    });
    await invoke("case-1", model, { caseId: "case-1", caseNotes: CASE_NOTES });
    const snapshot = await getState("case-1", model);

    expect(snapshot.next).toContain("humanActionInterrupt");
    const interrupt = snapshot.tasks.find((t) => t.interrupts.length > 0).interrupts[0];
    expect(interrupt.value.kind).toBe("next_best_action");
    expect(interrupt.value.recommendedAction.actionType).toBe("INTERVIEW");
    expect(interrupt.value.recommendedAction.evidenceOrPersonNeeded).toBe("Nurse Alvarez");
    expect(snapshot.values.investigationStatus).toBe("incomplete");
    expect(snapshot.values.graphStatus).toBe("awaiting_human_action");
  });

  it("case state is not merely process memory: a fresh checkpointer instance restores it", async () => {
    const model = makeFakeModel({
      evidenceAnalysisResponses: [evidenceAnalysisResponse({ unresolvedIds: ["key_witnesses"] })],
      nextActionResponses: [nextAction()],
    });
    // First "process": open the case, let it pause, then let this graph/
    // checkpointer instance go out of scope entirely.
    await invoke("case-2", model, { caseId: "case-2", caseNotes: CASE_NOTES });
    expect(existsSync(dbPath)).toBe(true);

    // Second "process": brand new SqliteSaver instance, brand new compiled
    // graph, pointed at the same file and thread_id. If this restores the
    // paused state, persistence is real, not an in-memory illusion.
    const snapshot = await getState("case-2", model);
    expect(snapshot.next).toContain("humanActionInterrupt");
    expect(snapshot.values.currentNextBestAction.evidenceOrPersonNeeded).toBe("Nurse Alvarez");
    expect(snapshot.values.caseId).toBe("case-2");
  });

  it("resumes the same case, incorporates new evidence, and does not repeat the completed action", async () => {
    const model = makeFakeModel({
      evidenceAnalysisResponses: [
        evidenceAnalysisResponse({ unresolvedIds: ["key_witnesses"] }),
        // After the interview evidence comes in: key_witnesses now
        // satisfied, but a new gap (objective_records) surfaces.
        evidenceAnalysisResponse({
          unresolvedIds: ["objective_records"],
          findings: [{ id: "F1", statement: "Alvarez states she was not the one who administered the final dose.", inference: "Contradicts the assignment log.", evidenceStatus: "single_source", supportingEvidenceIds: [], contradictingEvidenceIds: [] }],
        }),
      ],
      nextActionResponses: [
        nextAction(),
        nextAction({ actionType: "OBTAIN_RECORD", evidenceGapAddressed: "objective_records", evidenceOrPersonNeeded: "dispensing cabinet access log", suggestedQuestions: [], documentRequest: "Cabinet access log for the shift in question" }),
      ],
    });

    await invoke("case-3", model, { caseId: "case-3", caseNotes: CASE_NOTES });

    // New process, new checkpointer instance, same thread_id — same
    // pattern a fresh HTTP request would use (proves API resume by caseId).
    const resumed = await invoke("case-3", model, new Command({ resume: { resultType: "interview_notes", text: "Nurse Alvarez states she was not the one who administered the final dose." } }));

    const snapshot = await getState("case-3", model);
    expect(snapshot.next).toContain("humanActionInterrupt");
    const secondAction = snapshot.values.currentNextBestAction;
    // A genuinely new, different action — not the same completed interview.
    expect(secondAction.actionType).toBe("OBTAIN_RECORD");
    expect(secondAction.evidenceOrPersonNeeded).not.toBe("Nurse Alvarez");
    // The new evidence was actually incorporated into the analysis findings.
    expect(snapshot.values.findings.some((f) => f.statement.includes("Alvarez"))).toBe(true);
    // The completed interview is recorded, not silently dropped.
    expect(snapshot.values.actionHistory.find((a) => a.evidenceOrPersonNeeded === "Nurse Alvarez").status).toBe("completed");
    expect(snapshot.values.completedActions.some((a) => a.evidenceOrPersonNeeded === "Nurse Alvarez")).toBe(true);
    // The raw human input is preserved in the audit trail, not overwritten.
    expect(snapshot.values.humanInputs).toHaveLength(1);
    expect(snapshot.values.humanInputs[0].resultType).toBe("interview_notes");
    expect(resumed).toBeTruthy();
  });

  it("anti-repetition guard: retries with corrective feedback when the model tries to repeat a completed action", async () => {
    const model = makeFakeModel({
      evidenceAnalysisResponses: [
        evidenceAnalysisResponse({ unresolvedIds: ["key_witnesses"] }),
        evidenceAnalysisResponse({ unresolvedIds: ["key_witnesses"] }), // still unresolved after "new" evidence
      ],
      nextActionResponses: [
        nextAction(),
        // Second call's FIRST attempt deliberately repeats the same action —
        // this is what the deterministic guard must catch.
        nextAction(),
        // Retry attempt: a genuinely different action.
        nextAction({ evidenceOrPersonNeeded: "Shift supervisor" }),
      ],
    });

    await invoke("case-4", model, { caseId: "case-4", caseNotes: CASE_NOTES });
    await invoke("case-4", model, new Command({ resume: { resultType: "interview_notes", text: "Alvarez says she was working but did not touch the cart." } }));

    expect(model._calls.actionCalls.length).toBe(3); // 1 first-round + 2 second-round (repeat, then corrected retry)
    const snapshot = await getState("case-4", model);
    expect(snapshot.values.currentNextBestAction.evidenceOrPersonNeeded).toBe("Shift supervisor");
    // The retry prompt actually told the model what was wrong.
    const retryMessage = model._calls.actionCalls[2].find((m) => m.role === "user" && m.content.includes("already attempted"));
    expect(retryMessage).toBeTruthy();
  });

  it("reaches readyForHumanReview once the closure gate is satisfied — no next-best-action call", async () => {
    const model = makeFakeModel({
      evidenceAnalysisResponses: [evidenceAnalysisResponse({ unresolvedIds: [] })], // everything satisfied
      nextActionResponses: [],
    });
    await invoke("case-5", model, { caseId: "case-5", caseNotes: "A fully documented, uncontested case." });

    const snapshot = await getState("case-5", model);
    expect(snapshot.next).toContain("readyForHumanReview");
    const interrupt = snapshot.tasks.find((t) => t.interrupts.length > 0).interrupts[0];
    expect(interrupt.value.kind).toBe("ready_for_human_review");
    expect(interrupt.value.closureAssessment.status).toBe("ready_to_close");
    expect(snapshot.values.investigationStatus).toBe("ready_for_review");
    expect(model._calls.actionCalls.length).toBe(0); // recommendNextBestAction never even called
  });

  it("halts on a model schema failure instead of silently accepting garbage", async () => {
    const model = makeFakeModel({
      evidenceAnalysisResponses: [new Error("structured output failed schema validation after retries")],
      nextActionResponses: [],
    });
    const result = await invoke("case-6", model, { caseId: "case-6", caseNotes: CASE_NOTES });

    expect(result.graphStatus).toBe("error");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].node).toBe("analyzeEvidence");
    // The channel was never written to — nothing fabricated in place of the
    // failed call.
    expect(result.evidenceItems ?? []).toEqual([]);
    const snapshot = await getState("case-6", model);
    expect(snapshot.next).toEqual([]); // graph halted, not paused waiting for a human
  });

  it("rejects malformed human input instead of blending it into the case", async () => {
    const model = makeFakeModel({
      evidenceAnalysisResponses: [evidenceAnalysisResponse({ unresolvedIds: ["key_witnesses"] })],
      nextActionResponses: [nextAction()],
    });
    await invoke("case-7", model, { caseId: "case-7", caseNotes: CASE_NOTES });
    const beforeNotes = (await getState("case-7", model)).values.caseNotes;

    // A malformed resume payload reaching the graph directly (bypassing the
    // API route's own HumanResultZ validation) — e.g. an unknown resultType
    // and empty text — must be caught by ingestHumanResult's own guard, not
    // silently appended to the case.
    const result = await invoke("case-7", model, new Command({ resume: { resultType: "not_a_real_type", text: "" } }));

    expect(result.graphStatus).toBe("error");
    expect(result.errors.at(-1).node).toBe("ingestHumanResult");
    expect(result.errors.at(-1).message).toContain("Malformed human input");
    expect(result.caseNotes).toBe(beforeNotes); // never silently blended in
    expect(result.humanInputs ?? []).toEqual([]); // nothing recorded either
  });

  it("evidence invalidation reopens a previously satisfied sufficiency check", async () => {
    const model = makeFakeModel({
      evidenceAnalysisResponses: [
        // Round 1: objective_records satisfied, citing E1.
        evidenceAnalysisResponse({
          unresolvedIds: ["key_witnesses"],
          evidenceItems: [{ id: "E1", sourceLabel: "Case notes", lineStart: 1, lineEnd: 1, type: "system_record", stance: "supports", summary: "Cabinet log shows the withdrawal." }],
          checkOverrides: { objective_records: { evidenceIds: ["E1"] } },
        }),
        // Round 2 (after new human evidence): the model no longer returns
        // E1 among evidenceItems (superseded/dropped), but still reports
        // objective_records as satisfied citing it. hydrateEvidenceTraceability
        // must reopen that check rather than trust the stale citation.
        evidenceAnalysisResponse({
          unresolvedIds: ["key_witnesses"],
          evidenceItems: [],
          checkOverrides: { objective_records: { evidenceIds: ["E1"] } },
        }),
      ],
      nextActionResponses: [nextAction(), nextAction({ evidenceOrPersonNeeded: "Shift supervisor" })],
    });

    await invoke("case-8", model, { caseId: "case-8", caseNotes: CASE_NOTES });
    const beforeSnapshot = await getState("case-8", model);
    const beforeCheck = beforeSnapshot.values.sufficiencyChecks.find((c) => c.id === "objective_records");
    expect(beforeCheck.status).toBe("satisfied");

    await invoke("case-8", model, new Command({ resume: { resultType: "response", text: "Additional context provided." } }));
    const afterSnapshot = await getState("case-8", model);
    const afterCheck = afterSnapshot.values.sufficiencyChecks.find((c) => c.id === "objective_records");

    expect(afterCheck.status).toBe("unresolved");
    expect(afterCheck.rationale).toMatch(/reopened/i);
    expect(afterCheck.evidenceIds).toEqual([]);
  });

  it("captures a hypothesis contradicted by newly incorporated evidence", async () => {
    const model = makeFakeModel({
      evidenceAnalysisResponses: [
        evidenceAnalysisResponse({
          unresolvedIds: ["key_witnesses"],
          hypotheses: [{ id: "H1", label: "Authorized double administration", description: "The nurse was authorized to give two tablets.", state: "supported", supportingEvidenceIds: [], contradictingEvidenceIds: [], unresolvedQuestions: [] }],
        }),
        // A hypothesis's state is re-derived from actual evidence
        // citations, never trusted from the model's own label — so the
        // contradiction must be grounded in a real evidence item.
        evidenceAnalysisResponse({
          unresolvedIds: [],
          evidenceItems: [{ id: "E2", sourceLabel: "Case notes", lineStart: 1, lineEnd: 1, type: "document", stance: "contradicts", summary: "The medication order authorized only one tablet." }],
          hypotheses: [{ id: "H1", label: "Authorized double administration", description: "The nurse was authorized to give two tablets.", state: "contradicted", supportingEvidenceIds: [], contradictingEvidenceIds: ["E2"], unresolvedQuestions: [] }],
        }),
      ],
      nextActionResponses: [nextAction()],
    });

    await invoke("case-9", model, { caseId: "case-9", caseNotes: CASE_NOTES });
    await invoke("case-9", model, new Command({ resume: { resultType: "document", text: "The order authorized only one tablet; no order for a second exists." } }));

    const snapshot = await getState("case-9", model);
    expect(snapshot.values.hypotheses.find((h) => h.id === "H1").state).toBe("contradicted");
  });
});
