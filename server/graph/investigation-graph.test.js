// @vitest-environment node
//
// Proves the LangGraph mechanics without needing a real model call: that
// case state is not merely process memory (a fresh checkpointer instance
// pointed at the same file restores it), that interrupt/resume actually
// works, and that the deterministic anti-repetition guard fires. The
// semantic "does the AI reason well about real evidence" question is
// covered separately by investigation-graph.live.test.js, gated behind a
// real API key.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Command, INTERRUPT, isInterrupted } from "@langchain/langgraph";
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
            return evidenceAnalysisResponses[i];
          },
        };
      }
      if (schema === NextActionZ) {
        return {
          invoke: async (messages) => {
            actionCalls.push(messages);
            const i = Math.min(actionIdx, nextActionResponses.length - 1);
            actionIdx += 1;
            return nextActionResponses[i];
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
const satisfiedCheck = (id) => ({
  id, status: "satisfied", material: true, resolvable: false,
  rationale: `${id} is satisfied`, nextAction: "", evidenceIds: [],
});
const ALL_CHECK_IDS = ["finding_support", "contradictory_evidence", "objective_records", "key_witnesses", "material_inconsistencies", "policy_regulatory_context", "standard_of_proof", "reporting_escalation"];

function evidenceAnalysisResponse({ unresolvedIds = [], evidenceItems = [], findings = [] }) {
  return {
    evidenceItems,
    findings,
    hypotheses: [{ id: "H1", label: "Possible diversion", description: "Access/discrepancy could reflect diversion or a documentation error.", state: "unresolved", supportingEvidenceIds: [], contradictingEvidenceIds: [], unresolvedQuestions: [] }],
    sufficiencyChecks: ALL_CHECK_IDS.map((id) => (unresolvedIds.includes(id) ? unresolvedCheck(id) : satisfiedCheck(id))),
  };
}

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

  it("pauses at the first interrupt with a recommended action when evidence is incomplete", async () => {
    const model = makeFakeModel({
      evidenceAnalysisResponses: [evidenceAnalysisResponse({ unresolvedIds: ["key_witnesses"] })],
      nextActionResponses: [{
        actionType: "INTERVIEW", objective: "Establish who directed the access", whatToDo: "Interview Nurse Alvarez",
        whyThisIsNext: "No witness account exists yet", issueBeingResolved: "key_witnesses",
        evidenceOrPersonNeeded: "Nurse Alvarez", ifConfirmed: "", ifNotConfirmed: "", ifUnavailable: "",
      }],
    });
    const graph = buildInvestigationGraph({ model }).compile({ checkpointer: SqliteSaver.fromConnString(dbPath) });
    const result = await graph.invoke({ caseNotes: "Medication count discrepancy on Unit 4B." }, { configurable: { thread_id: "case-1" } });

    expect(isInterrupted(result)).toBe(true);
    const payload = result[INTERRUPT][0].value;
    expect(payload.recommendedAction.actionType).toBe("INTERVIEW");
    expect(payload.recommendedAction.evidenceOrPersonNeeded).toBe("Nurse Alvarez");
  });

  it("case state is not merely process memory: a fresh checkpointer instance restores it", async () => {
    const model = makeFakeModel({
      evidenceAnalysisResponses: [evidenceAnalysisResponse({ unresolvedIds: ["key_witnesses"] })],
      nextActionResponses: [{
        actionType: "INTERVIEW", objective: "o", whatToDo: "w", whyThisIsNext: "y", issueBeingResolved: "key_witnesses",
        evidenceOrPersonNeeded: "Nurse Alvarez", ifConfirmed: "", ifNotConfirmed: "", ifUnavailable: "",
      }],
    });
    // First "process": open the case, let it pause, then let this graph/
    // checkpointer instance go out of scope entirely.
    {
      const graph = buildInvestigationGraph({ model }).compile({ checkpointer: SqliteSaver.fromConnString(dbPath) });
      await graph.invoke({ caseNotes: "Medication count discrepancy on Unit 4B." }, { configurable: { thread_id: "case-2" } });
    }

    expect(existsSync(dbPath)).toBe(true);

    // Second "process": brand new SqliteSaver instance, brand new compiled
    // graph, pointed at the same file and thread_id. If this restores the
    // paused state, persistence is real, not an in-memory illusion.
    const freshGraph = buildInvestigationGraph({ model }).compile({ checkpointer: SqliteSaver.fromConnString(dbPath) });
    const snapshot = await freshGraph.getState({ configurable: { thread_id: "case-2" } });
    expect(snapshot.next).toContain("pauseForHuman");
    expect(snapshot.values.nextAction.evidenceOrPersonNeeded).toBe("Nurse Alvarez");
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
        { actionType: "INTERVIEW", objective: "o", whatToDo: "w", whyThisIsNext: "y", issueBeingResolved: "key_witnesses", evidenceOrPersonNeeded: "Nurse Alvarez", ifConfirmed: "", ifNotConfirmed: "", ifUnavailable: "" },
        { actionType: "OBTAIN_RECORD", objective: "o2", whatToDo: "w2", whyThisIsNext: "y2", issueBeingResolved: "objective_records", evidenceOrPersonNeeded: "dispensing cabinet access log", ifConfirmed: "", ifNotConfirmed: "", ifUnavailable: "" },
      ],
    });

    const graph = buildInvestigationGraph({ model }).compile({ checkpointer: SqliteSaver.fromConnString(dbPath) });
    const opened = await graph.invoke({ caseNotes: "Medication count discrepancy on Unit 4B." }, { configurable: { thread_id: "case-3" } });
    expect(isInterrupted(opened)).toBe(true);
    expect(opened[INTERRUPT][0].value.recommendedAction.actionType).toBe("INTERVIEW");

    // New process, new checkpointer instance, same thread_id — same
    // pattern a fresh HTTP request would use.
    const resumeGraph = buildInvestigationGraph({ model }).compile({ checkpointer: SqliteSaver.fromConnString(dbPath) });
    const resumed = await resumeGraph.invoke(
      new Command({ resume: "Nurse Alvarez states she was not the one who administered the final dose." }),
      { configurable: { thread_id: "case-3" } },
    );

    expect(isInterrupted(resumed)).toBe(true);
    const secondAction = resumed[INTERRUPT][0].value.recommendedAction;
    // A genuinely new, different action — not the same completed interview.
    expect(secondAction.actionType).toBe("OBTAIN_RECORD");
    expect(secondAction.evidenceOrPersonNeeded).not.toBe("Nurse Alvarez");
    // The new evidence was actually incorporated into the analysis findings.
    expect(resumed.findings.some((f) => f.statement.includes("Alvarez"))).toBe(true);
    // The completed interview is recorded, not silently dropped.
    expect(resumed.actionHistory.find((a) => a.evidenceOrPersonNeeded === "Nurse Alvarez").status).toBe("completed");
  });

  it("anti-repetition guard: retries with corrective feedback when the model tries to repeat a completed action", async () => {
    const model = makeFakeModel({
      evidenceAnalysisResponses: [
        evidenceAnalysisResponse({ unresolvedIds: ["key_witnesses"] }),
        evidenceAnalysisResponse({ unresolvedIds: ["key_witnesses"] }), // still unresolved after "new" evidence
      ],
      nextActionResponses: [
        { actionType: "INTERVIEW", objective: "o", whatToDo: "w", whyThisIsNext: "y", issueBeingResolved: "key_witnesses", evidenceOrPersonNeeded: "Nurse Alvarez", ifConfirmed: "", ifNotConfirmed: "", ifUnavailable: "" },
        // Second call's FIRST attempt deliberately repeats the same action —
        // this is what the deterministic guard must catch.
        { actionType: "INTERVIEW", objective: "o", whatToDo: "w", whyThisIsNext: "y", issueBeingResolved: "key_witnesses", evidenceOrPersonNeeded: "Nurse Alvarez", ifConfirmed: "", ifNotConfirmed: "", ifUnavailable: "" },
        // Retry attempt: a genuinely different action.
        { actionType: "INTERVIEW", objective: "o3", whatToDo: "w3", whyThisIsNext: "y3", issueBeingResolved: "key_witnesses", evidenceOrPersonNeeded: "Shift supervisor", ifConfirmed: "", ifNotConfirmed: "", ifUnavailable: "" },
      ],
    });

    const graph = buildInvestigationGraph({ model }).compile({ checkpointer: SqliteSaver.fromConnString(dbPath) });
    await graph.invoke({ caseNotes: "Medication count discrepancy on Unit 4B." }, { configurable: { thread_id: "case-4" } });

    const resumeGraph = buildInvestigationGraph({ model }).compile({ checkpointer: SqliteSaver.fromConnString(dbPath) });
    const resumed = await resumeGraph.invoke(
      new Command({ resume: "Alvarez says she was working but did not touch the cart." }),
      { configurable: { thread_id: "case-4" } },
    );

    expect(model._calls.actionCalls.length).toBe(3); // 1 first-round + 2 second-round (repeat, then corrected retry)
    const secondAction = resumed[INTERRUPT][0].value.recommendedAction;
    expect(secondAction.evidenceOrPersonNeeded).toBe("Shift supervisor");
    // The retry prompt actually told the model what was wrong.
    const retryMessage = model._calls.actionCalls[2].find((m) => m.role === "user" && m.content.includes("already completed"));
    expect(retryMessage).toBeTruthy();
  });

  it("stops without pausing once the closure gate is satisfied — no interrupt, no recommendation", async () => {
    const model = makeFakeModel({
      evidenceAnalysisResponses: [evidenceAnalysisResponse({ unresolvedIds: [] })], // everything satisfied
      nextActionResponses: [],
    });
    const graph = buildInvestigationGraph({ model }).compile({ checkpointer: SqliteSaver.fromConnString(dbPath) });
    const result = await graph.invoke({ caseNotes: "A fully documented, uncontested case." }, { configurable: { thread_id: "case-5" } });

    expect(isInterrupted(result)).toBe(false);
    expect(result.closureAssessment.status).not.toBe("not_ready_to_close");
    expect(model._calls.actionCalls.length).toBe(0); // recommendNextAction never even called
  });
});
