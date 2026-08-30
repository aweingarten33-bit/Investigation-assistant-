// @vitest-environment node
//
// Live, real-model proof of the full ACH-based reasoning loop for a
// controlled-medication-diversion investigation. Gated behind a real
// ANTHROPIC_API_KEY — skipped (not failed) when absent, following the same
// "live tests need a real provider key" convention as
// server/evals/run-live-evals.js. This scenario was authored for this test;
// it is built to exercise the full loop with a real, non-trivial evidence
// set: open -> extract evidence + hypotheses + ACH matrix -> compute
// readiness from the structured analysis -> interrupt with one next best
// action -> checkpoint -> resume with new evidence -> reanalyze -> a new
// (not repeated) action, or a full final-recommendation packet.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ChatAnthropic } from "@langchain/anthropic";
import { Command } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { buildInvestigationGraph } from "./investigation-graph.js";

const hasLiveKey = Boolean(process.env.ANTHROPIC_API_KEY);

const CASE_NOTES = `Unit 4B automated dispensing cabinet (ADC) reconciliation for oxycodone 5mg tablets flagged a discrepancy on the overnight shift.

ADC pull log shows RN Dana Reyes withdrew 2 tablets of oxycodone 5mg at 02:14 for patient in room 412, order authorizing 1 tablet per administration.
Medication administration record (MAR) for the 412 patient shows only 1 tablet documented as administered at 02:20.
No waste/discard documentation exists for the second tablet as of this reconciliation.
Pharmacy diversion-monitoring software flagged the transaction automatically; no prior flags exist for Reyes in the past 12 months per the system export.
Charge nurse note states Reyes was the only RN with ADC access on 412's medication pass during that window.`;

describe.skipIf(!hasLiveKey)("investigation graph — live medication-diversion scenario (ACH reasoning)", () => {
  let dbDir;
  let dbPath;

  beforeEach(() => {
    dbDir = mkdtempSync(path.join(tmpdir(), "investigation-graph-live-test-"));
    dbPath = path.join(dbDir, "checkpoints.sqlite");
  });

  afterEach(() => {
    rmSync(dbDir, { recursive: true, force: true });
  });

  it("proves the full open -> ACH analyze -> interrupt -> checkpoint -> resume -> reanalyze loop against a real model", async () => {
    const model = new ChatAnthropic({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      temperature: 0,
    });
    const threadId = "live-diversion-case-1";
    const config = { configurable: { thread_id: threadId } };

    const graph = buildInvestigationGraph({ model }).compile({ checkpointer: SqliteSaver.fromConnString(dbPath) });
    await graph.invoke(
      { caseId: threadId, caseObjective: "Determine whether the oxycodone count discrepancy reflects diversion, a documentation error, or an authorized administration.", caseNotes: CASE_NOTES },
      config,
    );

    const opened = await graph.getState(config);
    expect(opened.values.graphStatus).not.toBe("error");
    expect(opened.values.hypotheses.length).toBeGreaterThanOrEqual(1);
    expect(opened.values.achMatrix.length).toBeGreaterThan(0);
    expect(opened.values.achResult.ranking.length).toBe(opened.values.hypotheses.length);

    if (opened.next.includes("finalHumanReviewInterrupt")) {
      // Evidence was already judged sufficient on the first pass — still a
      // valid outcome; assert the full recommendation packet is present
      // and does not decide for the human.
      const packet = opened.tasks.find((t) => t.interrupts.length > 0).interrupts[0].value.finalRecommendation;
      expect(packet.humanFinalDetermination).toBe("pending");
      expect(packet.achResult).toBeTruthy();
      return;
    }

    expect(opened.next).toContain("humanActionInterrupt");
    const firstTask = opened.tasks.find((t) => t.interrupts.length > 0);
    const firstAction = firstTask.interrupts[0].value.recommendedAction;
    expect(firstAction).toBeTruthy();
    expect(firstAction.actionType).not.toBe("NO_FURTHER_REASONABLE_ACTION");

    // Checkpoint exists: brand new SqliteSaver instance and compiled graph,
    // pointed at the same file + thread_id, with the in-process instance
    // gone out of scope.
    const reloadGraph = buildInvestigationGraph({ model }).compile({ checkpointer: SqliteSaver.fromConnString(dbPath) });
    const reloaded = await reloadGraph.getState(config);
    expect(reloaded.values.currentNextBestAction.actionType).toBe(firstAction.actionType);

    const newEvidenceText = "RN Dana Reyes states she withdrew 2 tablets because the first tablet was dropped and contaminated on the floor during administration prep. No waste witness co-signed at the time. A used, crushed tablet fragment consistent with oxycodone 5mg was later recovered from the room 412 sharps/waste bin during an environmental check, but it was not logged as formal waste documentation.";
    await reloadGraph.invoke(new Command({ resume: { resultType: "interview_notes", text: newEvidenceText } }), config);

    const resumedSnapshot = await reloadGraph.getState(config);
    const completedEntry = resumedSnapshot.values.actionHistory.find(
      (a) => a.actionType === firstAction.actionType && a.evidenceOrPersonNeeded === firstAction.evidenceOrPersonNeeded,
    );
    expect(completedEntry?.status).toBe("completed");
    expect(resumedSnapshot.values.humanInputs.some((h) => h.text === newEvidenceText)).toBe(true);

    if (resumedSnapshot.next.includes("humanActionInterrupt")) {
      const secondAction = resumedSnapshot.tasks.find((t) => t.interrupts.length > 0).interrupts[0].value.recommendedAction;
      const isRepeat = secondAction.actionType === firstAction.actionType
        && secondAction.evidenceOrPersonNeeded.trim().toLowerCase() === firstAction.evidenceOrPersonNeeded.trim().toLowerCase();
      expect(isRepeat).toBe(false);
    } else {
      expect(resumedSnapshot.next).toContain("finalHumanReviewInterrupt");
      const packet = resumedSnapshot.tasks.find((t) => t.interrupts.length > 0).interrupts[0].value.finalRecommendation;
      expect(packet.humanFinalDetermination).toBe("pending");
    }
  }, 180_000);
});
