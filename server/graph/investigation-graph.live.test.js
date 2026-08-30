// @vitest-environment node
//
// Live, real-model proof of the full acceptance loop for a controlled-
// medication-diversion investigation. Gated behind a real ANTHROPIC_API_KEY
// — skipped (not failed) when absent, following the same "live tests need a
// real provider key" convention as server/evals/run-live-evals.js. This
// scenario was authored for this test; it was not transcribed from an
// existing fixture, but it is built to exercise the full loop with a real,
// non-trivial evidence set:
//   1. start case -> analyze current evidence
//   2. identify unresolved material question -> recommend ONE next best action
//   3. graph interrupts (humanActionInterrupt)
//   4. checkpoint exists for the case (fresh checkpointer instance reload)
//   5. submit human result / new evidence -> resume SAME case
//   6. evidence is incorporated; findings/hypotheses reassessed
//   7. sufficiency reassessed
//   8. a NEW next best action is produced, or the case reaches
//      human-review readiness — and the prior action is not repeated
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ChatAnthropic } from "@langchain/anthropic";
import { Command } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { buildInvestigationGraph } from "./investigation-graph.js";

const hasLiveKey = Boolean(process.env.ANTHROPIC_API_KEY);

// A controlled-substance diversion scenario: a discrepancy in a Pyxis-style
// automated dispensing cabinet count for oxycodone on a med-surg unit,
// with an incomplete initial record (no witness statement, no waste
// co-sign yet) so the first pass should surface an unresolved gap rather
// than a clean closure.
const CASE_NOTES = `Unit 4B automated dispensing cabinet (ADC) reconciliation for oxycodone 5mg tablets flagged a discrepancy on the overnight shift.

ADC pull log shows RN Dana Reyes withdrew 2 tablets of oxycodone 5mg at 02:14 for patient in room 412, order authorizing 1 tablet per administration.
Medication administration record (MAR) for the 412 patient shows only 1 tablet documented as administered at 02:20.
No waste/discard documentation exists for the second tablet as of this reconciliation.
Pharmacy diversion-monitoring software flagged the transaction automatically; no prior flags exist for Reyes in the past 12 months per the system export.
Charge nurse note states Reyes was the only RN with ADC access on 412's medication pass during that window.`;

describe.skipIf(!hasLiveKey)("investigation graph — live medication-diversion scenario", () => {
  let dbDir;
  let dbPath;

  beforeEach(() => {
    dbDir = mkdtempSync(path.join(tmpdir(), "investigation-graph-live-test-"));
    dbPath = path.join(dbDir, "checkpoints.sqlite");
  });

  afterEach(() => {
    rmSync(dbDir, { recursive: true, force: true });
  });

  it("proves the full open -> analyze -> interrupt -> checkpoint -> resume -> reanalyze -> new-action loop", async () => {
    const model = new ChatAnthropic({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      temperature: 0,
    });
    const threadId = "live-diversion-case-1";
    const config = { configurable: { thread_id: threadId } };

    // --- 1/2/3. Open the case, analyze evidence, recommend one action,
    // interrupt.
    const graph = buildInvestigationGraph({ model }).compile({ checkpointer: SqliteSaver.fromConnString(dbPath) });
    await graph.invoke(
      { caseId: threadId, caseObjective: "Determine whether the oxycodone count discrepancy reflects diversion, a documentation error, or an authorized administration.", caseNotes: CASE_NOTES },
      config,
    );

    const opened = await graph.getState(config);
    expect(opened.next).toContain("humanActionInterrupt");
    expect(opened.values.graphStatus).not.toBe("error");
    const firstTask = opened.tasks.find((t) => t.interrupts.length > 0);
    const firstAction = firstTask.interrupts[0].value.recommendedAction;

    expect(firstAction).toBeTruthy();
    expect(typeof firstAction.actionType).toBe("string");
    expect(firstAction.actionType).not.toBe("NO_FURTHER_REASONABLE_ACTION");
    expect(firstAction.evidenceOrPersonNeeded?.length).toBeGreaterThan(0);

    // --- 4. checkpoint exists for the case: brand new SqliteSaver instance
    // and compiled graph, pointed at the same file + thread_id, with the
    // in-process graph/model instance gone out of scope.
    const reloadGraph = buildInvestigationGraph({ model }).compile({ checkpointer: SqliteSaver.fromConnString(dbPath) });
    const reloaded = await reloadGraph.getState(config);
    expect(reloaded.next).toContain("humanActionInterrupt");
    expect(reloaded.values.currentNextBestAction.actionType).toBe(firstAction.actionType);
    expect(reloaded.values.currentNextBestAction.evidenceOrPersonNeeded).toBe(firstAction.evidenceOrPersonNeeded);

    // --- 5. submit human result / new evidence, resume the SAME case.
    const newEvidenceText = "RN Dana Reyes states she withdrew 2 tablets because the first tablet was dropped and contaminated on the floor during administration prep. No waste witness co-signed at the time. A used, crushed tablet fragment consistent with oxycodone 5mg was later recovered from the room 412 sharps/waste bin during an environmental check, but it was not logged as formal waste documentation.";
    await reloadGraph.invoke(
      new Command({ resume: { resultType: "interview_notes", text: newEvidenceText } }),
      config,
    );

    const resumedSnapshot = await reloadGraph.getState(config);

    // --- 6. evidence is incorporated: a finding referencing the new
    // account/waste-fragment detail should now exist.
    const incorporatesNewEvidence = resumedSnapshot.values.findings.some((f) =>
      /reyes|dropped|contaminat|waste|fragment/i.test(f.statement),
    );
    expect(incorporatesNewEvidence).toBe(true);

    // The completed first action must be recorded as completed, not lost.
    const completedEntry = resumedSnapshot.values.actionHistory.find(
      (a) => a.actionType === firstAction.actionType && a.evidenceOrPersonNeeded === firstAction.evidenceOrPersonNeeded,
    );
    expect(completedEntry?.status).toBe("completed");
    expect(resumedSnapshot.values.humanInputs.some((h) => h.text === newEvidenceText)).toBe(true);

    // --- 7/8. sufficiency reassessed; either a new, different action, or
    // the case has reached human-review readiness — both are valid
    // outcomes given the case moved forward, but a repeated first action
    // is not.
    expect(["incomplete", "provisional", "ready_for_review"]).toContain(resumedSnapshot.values.investigationStatus);

    if (resumedSnapshot.next.includes("humanActionInterrupt")) {
      const secondAction = resumedSnapshot.tasks.find((t) => t.interrupts.length > 0).interrupts[0].value.recommendedAction;
      const isRepeat = secondAction.actionType === firstAction.actionType
        && secondAction.evidenceOrPersonNeeded.trim().toLowerCase() === firstAction.evidenceOrPersonNeeded.trim().toLowerCase();
      expect(isRepeat).toBe(false);
      expect(secondAction.evidenceOrPersonNeeded?.length).toBeGreaterThan(0);
    } else {
      expect(resumedSnapshot.next).toContain("readyForHumanReview");
    }
  }, 120_000);
});
