// @vitest-environment node
//
// Proves the ACH/Key-Assumptions-Check reasoning end to end, including the
// four correctness fixes made after the initial ACH pass: (1) the final
// recommendation model call happens exactly once, before interrupt(), never
// replayed on resume; (2) a malformed ACH matrix (missing cell, invalid
// mark, duplicate row, unknown hypothesis, invalid evidence reference)
// fails closed through the same error path as a schema violation, never
// silently repaired; (3) a gap that has already been attempted is not
// recommended forever — reanalysis determines whether it resolved or
// remains open; (4) the final recommendation is grounded in actual
// validated evidence content, with any invented citedEvidenceIds stripped.
// Uses the controlled-medication-diversion fixture throughout as the
// primary end-to-end case. No live model call is made or faked here — see
// investigation-graph.live.test.js for that, gated on a real API key.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Command } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { buildInvestigationGraph } from "./investigation-graph.js";
import { EvidenceExtractionZ, KeyAssumptionsCheckZ, NextActionZ, FinalRecommendationZ } from "./schemas.js";
import { slugify } from "../lib/investigative-gaps.js";

function makeFakeModel({ evidenceResponses = [], assumptionsResponses = [], actionResponses = [], finalRecommendationResponses = [] } = {}) {
  const idx = { evidence: 0, assumptions: 0, action: 0, final: 0 };
  const calls = { evidenceCalls: [], assumptionsCalls: [], actionCalls: [], finalCalls: [] };
  function next(list, counterKey, fallback) {
    if (list.length === 0) return fallback;
    const i = Math.min(idx[counterKey], list.length - 1);
    idx[counterKey] += 1;
    return list[i];
  }
  return {
    withStructuredOutput(schema) {
      if (schema === EvidenceExtractionZ) {
        return { invoke: async (messages) => { calls.evidenceCalls.push(messages); const r = next(evidenceResponses, "evidence"); if (r instanceof Error) throw r; return r; } };
      }
      if (schema === KeyAssumptionsCheckZ) {
        return { invoke: async (messages) => { calls.assumptionsCalls.push(messages); const r = next(assumptionsResponses, "assumptions", { keyAssumptions: [] }); if (r instanceof Error) throw r; return r; } };
      }
      if (schema === NextActionZ) {
        return { invoke: async (messages) => { calls.actionCalls.push(messages); const r = next(actionResponses, "action"); if (r instanceof Error) throw r; return r; } };
      }
      if (schema === FinalRecommendationZ) {
        return { invoke: async (messages) => { calls.finalCalls.push(messages); const r = next(finalRecommendationResponses, "final", { recommendedDetermination: "not_applicable", rationale: "No standard supplied.", citedEvidenceIds: [], whatCouldChangeThis: "New material evidence." }); if (r instanceof Error) throw r; return r; } };
      }
      throw new Error("makeFakeModel: unexpected schema passed to withStructuredOutput");
    },
    _calls: calls,
  };
}

const hyp = (id, label) => ({ id, label, description: label });
const ev = (id, lineStart, lineEnd, overrides = {}) => ({
  id, sourceLabel: "Case notes", lineStart, lineEnd, evidenceType: "system_record",
  summary: `Evidence ${id}`, ...overrides,
});
const row = (evidenceId, marks) => ({ evidenceId, marks });
const questionGapId = (text) => `question:${slugify(text)}`;

function extraction({ evidenceItems = [], findings = [], hypotheses, achMatrix = [], unresolvedQuestions = [] }) {
  return { evidenceItems, findings, hypotheses, achMatrix, unresolvedQuestions };
}

function action(overrides = {}) {
  return {
    targetGapId: "placeholder",
    actionType: "INTERVIEW",
    action: "Interview the relevant witness",
    whyThisIsNext: "Closes the open question",
    evidenceOrPersonNeeded: "Nurse Alvarez",
    suggestedQuestions: ["What happened during the medication pass?"],
    documentRequest: "",
    expectedInformationGain: "Confirms who administered the dose",
    whatCouldChangeBasedOnResult: "Could confirm or rule out diversion",
    ...overrides,
  };
}

// 5 lines, deliberately short so out-of-range citations (line 99) are easy
// to construct for the invalidation test.
const CASE_NOTES = `Unit 4B automated dispensing cabinet (ADC) reconciliation for oxycodone 5mg tablets flagged a discrepancy on the overnight shift.
ADC pull log shows RN Dana Reyes withdrew 2 tablets of oxycodone 5mg at 02:14 for patient in room 412, order authorizing 1 tablet per administration.
Medication administration record (MAR) for the 412 patient shows only 1 tablet documented as administered at 02:20.
No waste/discard documentation exists for the second tablet as of this reconciliation.
Charge nurse note states Reyes was the only RN with ADC access on 412's medication pass during that window.`;

describe("investigation graph — ACH reasoning", () => {
  let dbDir;
  let dbPath;

  beforeEach(() => {
    dbDir = mkdtempSync(path.join(tmpdir(), "investigation-graph-ach-test-"));
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

  it("1. multiple plausible hypotheses produce a real ACH evidence x hypothesis matrix", async () => {
    const hypotheses = [hyp("H1", "Diversion by Reyes"), hyp("H2", "Documentation/waste error"), hyp("H3", "Authorized double dose")];
    const model = makeFakeModel({
      evidenceResponses: [extraction({
        evidenceItems: [ev("E1", 2, 2), ev("E2", 3, 3), ev("E3", 5, 5)],
        hypotheses,
        achMatrix: [
          row("E1", { H1: "consistent", H2: "neutral", H3: "inconsistent" }),
          row("E2", { H1: "consistent", H2: "consistent", H3: "inconsistent" }),
          row("E3", { H1: "consistent", H2: "neutral", H3: "not_applicable" }),
        ],
        unresolvedQuestions: ["Was the second tablet ever accounted for?"],
      })],
      actionResponses: [action()],
    });
    await invoke("case-1", model, { caseId: "case-1", caseNotes: CASE_NOTES });
    const snapshot = await getState("case-1", model);

    expect(snapshot.values.achMatrix).toHaveLength(3);
    expect(snapshot.values.achMatrix.every((r) => Object.keys(r.marks).length === 3)).toBe(true);
    expect(snapshot.values.achResult.ranking).toHaveLength(3);
    expect(snapshot.values.hypotheses.map((h) => h.id).sort()).toEqual(["H1", "H2", "H3"]);
  });

  it("2. a hypothesis with more confirming marks can still lose to one with fewer, more serious inconsistencies", async () => {
    const hypotheses = [hyp("H1", "Diversion"), hyp("H2", "Documentation error")];
    const model = makeFakeModel({
      evidenceResponses: [extraction({
        evidenceItems: [ev("E1", 1, 1), ev("E2", 2, 2), ev("E3", 3, 3), ev("E4", 4, 4)],
        hypotheses,
        achMatrix: [
          // H1 racks up three confirmations but one strongly_inconsistent mark.
          row("E1", { H1: "strongly_consistent", H2: "neutral" }),
          row("E2", { H1: "consistent", H2: "neutral" }),
          row("E3", { H1: "consistent", H2: "consistent" }),
          row("E4", { H1: "strongly_inconsistent", H2: "consistent" }),
        ],
        unresolvedQuestions: [],
      })],
      actionResponses: [action()],
    });
    await invoke("case-2", model, { caseId: "case-2", caseNotes: CASE_NOTES });
    const snapshot = await getState("case-2", model);

    // H1 has 3 confirmations vs H2's 2, but H1 also carries the only
    // inconsistency (weighted 2.0) — ACH must rank H2 first regardless.
    expect(snapshot.values.achResult.ranking[0].hypothesisId).toBe("H2");
  });

  it("3. contradictory evidence remains visible rather than being dropped because it disagrees with the leader", async () => {
    const hypotheses = [hyp("H1", "Diversion"), hyp("H2", "Documentation error")];
    const model = makeFakeModel({
      evidenceResponses: [extraction({
        evidenceItems: [ev("E1", 1, 1), ev("E2", 2, 2), ev("E3", 3, 3)],
        hypotheses,
        achMatrix: [
          row("E1", { H1: "consistent", H2: "inconsistent" }),
          row("E2", { H1: "inconsistent", H2: "consistent" }), // a loose end against the leader
          row("E3", { H1: "consistent", H2: "inconsistent" }),
        ],
      })],
      actionResponses: [action()],
    });
    await invoke("case-3", model, { caseId: "case-3", caseNotes: CASE_NOTES });
    const snapshot = await getState("case-3", model);

    // H1: one inconsistency (E2, weighted 1). H2: two inconsistencies (E1,
    // E3, weighted 2) — H1 leads despite carrying a visible loose end.
    const leaderId = snapshot.values.achResult.ranking[0].hypothesisId;
    expect(leaderId).toBe("H1");
    const contradictingRow = snapshot.values.achMatrix.find((r) => r.evidenceId === "E2");
    expect(contradictingRow.marks.H1).toBe("inconsistent"); // still there, not silently dropped
  });

  it("4. removing pivotal evidence changes the ranking, and sensitivity analysis reports it", async () => {
    const hypotheses = [hyp("H1", "Diversion"), hyp("H2", "Documentation error")];
    const model = makeFakeModel({
      evidenceResponses: [extraction({
        evidenceItems: [ev("E1", 1, 1), ev("E2", 2, 2)],
        hypotheses,
        achMatrix: [
          row("E1", { H1: "consistent", H2: "consistent" }), // non-diagnostic, doesn't matter
          row("E2", { H1: "inconsistent", H2: "consistent" }), // the only inconsistency — pivotal
        ],
      })],
      actionResponses: [action()],
    });
    await invoke("case-4", model, { caseId: "case-4", caseNotes: CASE_NOTES });
    const snapshot = await getState("case-4", model);

    expect(snapshot.values.achResult.ranking[0].hypothesisId).toBe("H2");
    expect(snapshot.values.sensitivity.pivotalEvidenceIds).toContain("E2");
    const flip = snapshot.values.sensitivity.flips.find((f) => f.evidenceId === "E2");
    expect(flip.newLeaderId).toBe("H1");
  });

  it("5. a weak, high-sensitivity key assumption creates an unresolved investigative gap", async () => {
    const hypotheses = [hyp("H1", "Diversion")];
    const model = makeFakeModel({
      evidenceResponses: [extraction({
        evidenceItems: [ev("E1", 1, 1)],
        hypotheses,
        achMatrix: [row("E1", { H1: "consistent" })],
        unresolvedQuestions: [],
      })],
      assumptionsResponses: [{
        keyAssumptions: [{
          id: "A1", statement: "Only Reyes had ADC access during the window",
          assumptionType: "implicit", grounding: "weak", sensitivity: "high",
          disposition: "re-source", dispositionNote: "Verify the ADC access log independently.",
        }],
      }],
      actionResponses: [action({ targetGapId: "assumption:A1" })],
    });
    await invoke("case-5", model, { caseId: "case-5", caseNotes: CASE_NOTES });
    const snapshot = await getState("case-5", model);

    expect(snapshot.values.keyAssumptions[0].category).toBe("unsupported_questionable");
    const gap = snapshot.values.investigativeGaps.find((g) => g.gapType === "unresolved_key_assumption");
    expect(gap).toBeTruthy();
    expect(gap.resolvable).toBe(true);
    expect(snapshot.values.investigationStatus).toBe("incomplete");
  });

  it("6. new human evidence can flip the leading hypothesis", async () => {
    const hypotheses = [hyp("H1", "Diversion"), hyp("H2", "Documentation error")];
    const model = makeFakeModel({
      evidenceResponses: [
        extraction({
          evidenceItems: [ev("E1", 1, 1)],
          hypotheses,
          achMatrix: [row("E1", { H1: "consistent", H2: "inconsistent" })],
          unresolvedQuestions: ["Was there a witness to the medication pass?"],
        }),
        // After human evidence: a new record contradicts H1 more seriously
        // than it contradicts H2.
        extraction({
          evidenceItems: [ev("E1", 1, 1), ev("E2", 2, 2)],
          hypotheses,
          achMatrix: [
            row("E1", { H1: "consistent", H2: "inconsistent" }),
            row("E2", { H1: "strongly_inconsistent", H2: "consistent" }),
          ],
        }),
      ],
      actionResponses: [action()],
    });

    await invoke("case-6", model, { caseId: "case-6", caseNotes: CASE_NOTES });
    const before = await getState("case-6", model);
    expect(before.values.achResult.ranking[0].hypothesisId).toBe("H1");

    await invoke("case-6", model, new Command({ resume: { resultType: "document", text: "The access log shows Reyes was not the only nurse with cabinet access that shift." } }));
    const after = await getState("case-6", model);
    expect(after.values.achResult.ranking[0].hypothesisId).toBe("H2");
  });

  it("7. an ACH matrix row citing invalidated evidence fails closed instead of being silently dropped", async () => {
    const hypotheses = [hyp("H1", "Diversion"), hyp("H2", "Documentation error")];
    const model = makeFakeModel({
      evidenceResponses: [
        extraction({
          evidenceItems: [ev("E1", 1, 1)],
          hypotheses,
          achMatrix: [row("E1", { H1: "inconsistent", H2: "consistent" })],
          unresolvedQuestions: ["Was there a witness to the medication pass?"],
        }),
        // Round 2: the model cites E1 again but with an impossible line
        // range (line 99 doesn't exist in a 5-line case) — validateEvidenceItems
        // strips it, so the matrix row citing it now references evidence
        // that isn't in the validated set. That is a malformed matrix, not
        // something to quietly patch around.
        extraction({
          evidenceItems: [ev("E1", 99, 99)],
          hypotheses,
          achMatrix: [row("E1", { H1: "inconsistent", H2: "consistent" })],
        }),
      ],
      actionResponses: [action()],
    });

    await invoke("case-7", model, { caseId: "case-7", caseNotes: CASE_NOTES });
    const before = await getState("case-7", model);
    expect(before.values.evidenceItems.map((e) => e.id)).toContain("E1");

    const result = await invoke("case-7", model, new Command({ resume: { resultType: "response", text: "Additional context." } }));

    expect(result.graphStatus).toBe("error");
    expect(result.errors.at(-1).node).toBe("analyzeEvidence");
    expect(result.errors.at(-1).message).toMatch(/not a validated evidence item/);
    // The graph halted before committing anything from the failed round —
    // round 1's committed evidence/matrix are untouched, not silently
    // altered.
    const after = await getState("case-7", model);
    expect(after.values.evidenceItems.map((e) => e.id)).toContain("E1");
    expect(after.next).toEqual([]);
  });

  it("8. Next Best Action targets the most diagnostic gap rather than a generic one", async () => {
    const hypotheses = [hyp("H1", "Diversion"), hyp("H2", "Documentation error")];
    const model = makeFakeModel({
      evidenceResponses: [extraction({
        evidenceItems: [ev("E1", 1, 1), ev("E2", 2, 2)],
        hypotheses,
        achMatrix: [
          row("E1", { H1: "consistent", H2: "consistent" }),
          row("E2", { H1: "inconsistent", H2: "consistent" }), // pivotal — highest priority gap
        ],
        unresolvedQuestions: ["Some generic open question unrelated to the matrix"],
      })],
      actionResponses: [action({ targetGapId: "pivot:E2" })],
    });
    await invoke("case-8", model, { caseId: "case-8", caseNotes: CASE_NOTES });

    // The candidate list handed to the model must rank the pivotal gap
    // ahead of the generic unresolved question.
    const promptContent = model._calls.actionCalls[0].find((m) => m.role === "user").content;
    const pivotIndex = promptContent.indexOf("pivot:E2");
    const questionIndex = promptContent.indexOf("discriminating_evidence_missing");
    expect(pivotIndex).toBeGreaterThan(-1);
    expect(pivotIndex).toBeLessThan(questionIndex);

    const snapshot = await getState("case-8", model);
    expect(snapshot.values.currentNextBestAction.targetGapId).toBe("pivot:E2");
  });

  it("9. no reasonable remaining action + unavoidable uncertainty produces READY_WITH_LIMITATIONS", async () => {
    const hypotheses = [hyp("H1", "Diversion")];
    const model = makeFakeModel({
      evidenceResponses: [extraction({
        evidenceItems: [ev("E1", 1, 1)],
        hypotheses,
        achMatrix: [row("E1", { H1: "consistent" })],
        unresolvedQuestions: [],
      })],
      assumptionsResponses: [{
        keyAssumptions: [{
          id: "A1", statement: "The ADC log timestamp is accurate",
          assumptionType: "implicit", grounding: "weak", sensitivity: "high",
          disposition: "bound", dispositionNote: "No further verification is realistically obtainable.",
        }],
      }],
    });
    const result = await invoke("case-9", model, { caseId: "case-9", caseNotes: CASE_NOTES });

    expect(result.investigationStatus).toBe("ready_with_limitations");
    expect(model._calls.actionCalls).toHaveLength(0); // no next-action call — nothing resolvable to recommend
    const snapshot = await getState("case-9", model);
    expect(snapshot.next).toContain("finalHumanReviewInterrupt");
  });

  it("10. material resolvable uncertainty prevents READY_FOR_HUMAN_REVIEW", async () => {
    const hypotheses = [hyp("H1", "Diversion")];
    const question = "Was a waste witness available for the second tablet?";
    const model = makeFakeModel({
      evidenceResponses: [extraction({
        evidenceItems: [ev("E1", 1, 1)],
        hypotheses,
        achMatrix: [row("E1", { H1: "consistent" })],
        unresolvedQuestions: [question],
      })],
      actionResponses: [action({ targetGapId: questionGapId(question) })],
    });
    const result = await invoke("case-10", model, { caseId: "case-10", caseNotes: CASE_NOTES });

    expect(result.investigationStatus).toBe("incomplete");
    const snapshot = await getState("case-10", model);
    expect(snapshot.next).toContain("humanActionInterrupt");
    expect(snapshot.next).not.toContain("finalHumanReviewInterrupt");
  });

  it("11. READY_FOR_HUMAN_REVIEW produces the full AI recommendation packet but never decides for the human", async () => {
    const hypotheses = [hyp("H1", "Diversion"), hyp("H2", "Documentation error")];
    const model = makeFakeModel({
      evidenceResponses: [extraction({
        evidenceItems: [ev("E1", 1, 1)],
        hypotheses,
        achMatrix: [row("E1", { H1: "consistent", H2: "neutral" })],
        unresolvedQuestions: [],
      })],
      finalRecommendationResponses: [{
        recommendedDetermination: "substantiated",
        rationale: "The pull log and MAR discrepancy is unexplained and no alternative explanation survives.",
        citedEvidenceIds: ["E1", "E-does-not-exist"],
        whatCouldChangeThis: "A waste-witness statement corroborating a dropped tablet.",
      }],
    });
    const result = await invoke("case-11", model, { caseId: "case-11", caseNotes: CASE_NOTES });

    expect(result.investigationStatus).toBe("ready_for_review");
    const snapshot = await getState("case-11", model);
    const interruptTask = snapshot.tasks.find((t) => t.interrupts.length > 0);
    const packet = interruptTask.interrupts[0].value.finalRecommendation;

    expect(packet.recommendedDetermination).toBe("substantiated");
    expect(packet.leadingHypothesis.id).toBe("H1");
    expect(packet.achResult.ranking).toBeTruthy();
    expect(packet.sensitivity).toBeTruthy();
    expect(packet.keyAssumptions).toBeTruthy();
    expect(packet.aiRationale).toContain("pull log");
    // Grounded evidence content (fix 4), not bare ids.
    expect(packet.evidenceSupporting[0]).toMatchObject({ evidenceId: "E1", summary: expect.any(String) });
    // Invented citation stripped, real one kept (fix 4).
    expect(packet.citedEvidenceIds).toEqual(["E1"]);
    // The AI never makes the call itself, no matter what it recommended.
    expect(packet.humanFinalDetermination).toBe("pending");
  });

  it("12. interrupt/checkpoint/resume still works: fresh checkpointer instance restores paused state", async () => {
    const hypotheses = [hyp("H1", "Diversion"), hyp("H2", "Documentation error")];
    const model = makeFakeModel({
      evidenceResponses: [extraction({
        evidenceItems: [ev("E1", 1, 1)],
        hypotheses,
        achMatrix: [row("E1", { H1: "consistent", H2: "neutral" })],
        unresolvedQuestions: ["Open question"],
      })],
      actionResponses: [action()],
    });
    await invoke("case-12", model, { caseId: "case-12", caseNotes: CASE_NOTES });
    expect(existsSync(dbPath)).toBe(true);

    const snapshot = await getState("case-12", model);
    expect(snapshot.next).toContain("humanActionInterrupt");
    expect(snapshot.values.currentNextBestAction.evidenceOrPersonNeeded).toBe("Nurse Alvarez");
    expect(snapshot.values.caseId).toBe("case-12");
  });

  it("13. the final recommendation model call happens exactly once — resuming the review interrupt does not replay it", async () => {
    const hypotheses = [hyp("H1", "Diversion")];
    const model = makeFakeModel({
      evidenceResponses: [extraction({
        evidenceItems: [ev("E1", 1, 1)],
        hypotheses,
        achMatrix: [row("E1", { H1: "consistent" })],
        unresolvedQuestions: [],
      })],
      finalRecommendationResponses: [{
        recommendedDetermination: "not_applicable",
        rationale: "First and only draft.",
        citedEvidenceIds: ["E1"],
        whatCouldChangeThis: "New material evidence.",
      }],
    });

    await invoke("case-13", model, { caseId: "case-13", caseNotes: CASE_NOTES });
    expect(model._calls.finalCalls).toHaveLength(1);
    const beforeSnapshot = await getState("case-13", model);
    const beforeRationale = beforeSnapshot.values.finalRecommendation.aiRationale;

    // Resume the review interrupt with an acknowledgment — this re-enters
    // finalHumanReviewInterrupt from the top (LangGraph's interrupt
    // re-execution semantics), which must NOT re-invoke the model since
    // nothing before interrupt() in that node calls it.
    await invoke("case-13", model, new Command({ resume: "Acknowledged, reviewing now." }));

    expect(model._calls.finalCalls).toHaveLength(1); // still exactly one call
    const afterSnapshot = await getState("case-13", model);
    expect(afterSnapshot.values.finalRecommendation.aiRationale).toBe(beforeRationale); // same object, not regenerated
    expect(afterSnapshot.values.humanInputs.some((h) => h.resultType === "review_acknowledgment")).toBe(true);
  });

  it("14. a malformed ACH matrix (missing cell) fails closed through the graph, not just the unit-level validator", async () => {
    const hypotheses = [hyp("H1", "Diversion"), hyp("H2", "Documentation error")];
    const model = makeFakeModel({
      evidenceResponses: [extraction({
        evidenceItems: [ev("E1", 1, 1)],
        hypotheses,
        achMatrix: [row("E1", { H1: "consistent" })], // missing H2 mark
      })],
    });
    const result = await invoke("case-14a", model, { caseId: "case-14a", caseNotes: CASE_NOTES });

    expect(result.graphStatus).toBe("error");
    expect(result.errors[0].node).toBe("analyzeEvidence");
    expect(result.errors[0].message).toMatch(/missing a mark/);
    const snapshot = await getState("case-14a", model);
    expect(snapshot.next).toEqual([]); // halted, not paused
  });

  it("15. gap lifecycle: a gap that remains open after reanalysis is not recommended forever, and one that resolves disappears", async () => {
    const hypotheses = [hyp("H1", "Diversion"), hyp("H2", "Documentation error")];
    const model = makeFakeModel({
      evidenceResponses: [
        // Round 1: E2 is pivotal — the only inconsistency, against H1.
        extraction({
          evidenceItems: [ev("E1", 1, 1), ev("E2", 2, 2)],
          hypotheses,
          achMatrix: [
            row("E1", { H1: "consistent", H2: "consistent" }),
            row("E2", { H1: "inconsistent", H2: "consistent" }),
          ],
        }),
        // Round 2 (after "corroboration"): E2 is STILL the only
        // inconsistency and still pivotal — the human's corroboration did
        // not actually change the picture. The same gap must not be
        // treated as freshly resolvable.
        extraction({
          evidenceItems: [ev("E1", 1, 1), ev("E2", 2, 2)],
          hypotheses,
          achMatrix: [
            row("E1", { H1: "consistent", H2: "consistent" }),
            row("E2", { H1: "inconsistent", H2: "consistent" }),
          ],
        }),
      ],
      actionResponses: [action({ targetGapId: "pivot:E2" })],
    });

    await invoke("case-15", model, { caseId: "case-15", caseNotes: CASE_NOTES });
    const round1 = await getState("case-15", model);
    expect(round1.values.investigativeGaps.find((g) => g.id === "pivot:E2").lifecycleStatus).toBe("unresolved");
    expect(round1.values.gapHistory["pivot:E2"].status).toBe("attempted");

    await invoke("case-15", model, new Command({ resume: { resultType: "document", text: "Corroborating record obtained, but it does not change the picture." } }));
    const round2 = await getState("case-15", model);

    const gap = round2.values.investigativeGaps.find((g) => g.id === "pivot:E2");
    expect(gap.lifecycleStatus).toBe("remains_open");
    expect(gap.resolvable).toBe(false); // no longer offered as a fresh candidate
    // Ready-with-limitations, not stuck recommending the same thing again:
    // only H2 was consistent-only, but H1 is still pivotal-via-E2 with no
    // OTHER resolvable gap, so the case is ready with the limitation
    // documented, not looping back into recommendNextBestAction for E2.
    expect(round2.values.investigationStatus).toBe("ready_with_limitations");
    expect(model._calls.actionCalls).toHaveLength(1); // recommendNextBestAction was never called a second time
  });

  it("16. gap lifecycle: a gap that disappears after reanalysis is marked resolved, not carried forward", async () => {
    const hypotheses = [hyp("H1", "Diversion"), hyp("H2", "Documentation error")];
    const model = makeFakeModel({
      evidenceResponses: [
        extraction({
          evidenceItems: [ev("E1", 1, 1), ev("E2", 2, 2)],
          hypotheses,
          achMatrix: [
            row("E1", { H1: "consistent", H2: "consistent" }),
            row("E2", { H1: "inconsistent", H2: "consistent" }),
          ],
        }),
        // Round 2: new evidence resolves the discrepancy — E2 is no longer
        // inconsistent with H1, so it is no longer pivotal and the gap
        // disappears from the freshly computed structural gaps.
        extraction({
          evidenceItems: [ev("E1", 1, 1), ev("E2", 2, 2), ev("E3", 3, 3)],
          hypotheses,
          achMatrix: [
            row("E1", { H1: "consistent", H2: "consistent" }),
            row("E2", { H1: "consistent", H2: "consistent" }),
            row("E3", { H1: "consistent", H2: "consistent" }),
          ],
        }),
      ],
      actionResponses: [action({ targetGapId: "pivot:E2" })],
    });

    await invoke("case-16", model, { caseId: "case-16", caseNotes: CASE_NOTES });
    await invoke("case-16", model, new Command({ resume: { resultType: "document", text: "Corroborating record resolves the discrepancy." } }));
    const round2 = await getState("case-16", model);

    expect(round2.values.gapHistory["pivot:E2"].status).toBe("resolved");
    expect(round2.values.investigativeGaps.find((g) => g.id === "pivot:E2")).toBeUndefined();
  });

  it("17. the final recommendation prompt is grounded in actual evidence content, not just ids", async () => {
    const hypotheses = [hyp("H1", "Diversion")];
    const model = makeFakeModel({
      evidenceResponses: [extraction({
        evidenceItems: [ev("E1", 2, 2, { summary: "ADC pull log shows two tablets withdrawn." })],
        hypotheses,
        achMatrix: [row("E1", { H1: "consistent" })],
      })],
    });
    await invoke("case-17", model, { caseId: "case-17", caseNotes: CASE_NOTES });

    const promptContent = model._calls.finalCalls[0].find((m) => m.role === "user").content;
    expect(promptContent).toContain("ADC pull log shows two tablets withdrawn.");
  });

  it("keeps the anti-repetition guard: retries with corrective feedback when the model tries to repeat a completed action", async () => {
    const hypotheses = [hyp("H1", "Diversion")];
    const model = makeFakeModel({
      evidenceResponses: [
        extraction({ evidenceItems: [ev("E1", 1, 1)], hypotheses, achMatrix: [row("E1", { H1: "consistent" })], unresolvedQuestions: ["Q1"] }),
        // A genuinely new, different open question — round 1's gap was
        // resolved by the human's response, so this is a fresh candidate
        // (not the gap-lifecycle "remains_open" case tests 15/16 cover).
        extraction({ evidenceItems: [ev("E1", 1, 1)], hypotheses, achMatrix: [row("E1", { H1: "consistent" })], unresolvedQuestions: ["Q2"] }),
      ],
      actionResponses: [
        action({ targetGapId: questionGapId("Q1") }),
        // The model's FIRST attempt at the new gap still mistakenly names
        // the same person/action as before — the guard must catch this by
        // content, regardless of which gap it claims to target.
        action({ targetGapId: questionGapId("Q2") }),
        action({ targetGapId: questionGapId("Q2"), evidenceOrPersonNeeded: "Shift supervisor" }), // corrected retry
      ],
    });
    await invoke("case-18", model, { caseId: "case-18", caseNotes: CASE_NOTES });
    await invoke("case-18", model, new Command({ resume: { resultType: "interview_notes", text: "Alvarez did not see the second tablet administered." } }));

    expect(model._calls.actionCalls).toHaveLength(3);
    const snapshot = await getState("case-18", model);
    expect(snapshot.values.currentNextBestAction.evidenceOrPersonNeeded).toBe("Shift supervisor");
  });

  it("halts on a model schema failure instead of silently accepting garbage", async () => {
    const model = makeFakeModel({ evidenceResponses: [new Error("structured output failed schema validation after retries")] });
    const result = await invoke("case-19", model, { caseId: "case-19", caseNotes: CASE_NOTES });

    expect(result.graphStatus).toBe("error");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].node).toBe("analyzeEvidence");
    const snapshot = await getState("case-19", model);
    expect(snapshot.next).toEqual([]);
  });

  it("rejects malformed human input instead of blending it into the case", async () => {
    const hypotheses = [hyp("H1", "Diversion")];
    const model = makeFakeModel({
      evidenceResponses: [extraction({ evidenceItems: [ev("E1", 1, 1)], hypotheses, achMatrix: [row("E1", { H1: "consistent" })], unresolvedQuestions: ["Q1"] })],
      actionResponses: [action({ targetGapId: questionGapId("Q1") })],
    });
    await invoke("case-20", model, { caseId: "case-20", caseNotes: CASE_NOTES });
    const beforeNotes = (await getState("case-20", model)).values.caseNotes;

    const result = await invoke("case-20", model, new Command({ resume: { resultType: "not_a_real_type", text: "" } }));

    expect(result.graphStatus).toBe("error");
    expect(result.errors.at(-1).node).toBe("ingestHumanResult");
    expect(result.errors.at(-1).message).toContain("Malformed human input");
    expect(result.caseNotes).toBe(beforeNotes);
    expect(result.humanInputs ?? []).toEqual([]);
  });
});
