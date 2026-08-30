import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command, INTERRUPT, isInterrupted } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { buildInvestigationGraph } from "../graph/investigation-graph.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// V1 persistence note: SqliteSaver writes to a local file. On Render (or
// any platform without a persistent disk attached), this file lives on the
// instance's ephemeral filesystem — it survives process restarts on the
// SAME instance, but NOT a deploy or an instance replacement, which get a
// fresh filesystem. This proves LangGraph pause/resume/checkpointing works
// correctly; it does not by itself prove deploy-level durability. Attaching
// a Render persistent disk (or moving to a hosted Postgres checkpointer
// later) is the production-hardening step, deliberately out of scope here.
const DB_PATH = process.env.INVESTIGATION_GRAPH_DB_PATH || path.join(__dirname, "..", "..", "data", "investigation-graph.sqlite");

function checkpointer() {
  return SqliteSaver.fromConnString(DB_PATH);
}

function respondFromInvoke(res, result) {
  if (isInterrupted(result)) {
    const payload = result[INTERRUPT][0].value;
    return res.json({ status: "paused", ...payload });
  }
  return res.json({
    status: "complete",
    closureAssessment: result.closureAssessment,
    evidenceItems: result.evidenceItems,
    findings: result.findings,
    hypotheses: result.hypotheses,
    sufficiencyChecks: result.sufficiencyChecks,
    actionHistory: result.actionHistory,
  });
}

const router = express.Router();
router.use(express.json({ limit: "2mb" }));

router.post("/case", async (req, res) => {
  try {
    const { caseId, caseNotes } = req.body;
    if (typeof caseId !== "string" || !caseId.trim()) {
      return res.status(400).json({ error: "caseId is required" });
    }
    if (typeof caseNotes !== "string" || !caseNotes.trim()) {
      return res.status(400).json({ error: "caseNotes is required" });
    }
    const graph = buildInvestigationGraph().compile({ checkpointer: checkpointer() });
    const result = await graph.invoke({ caseNotes }, { configurable: { thread_id: caseId } });
    respondFromInvoke(res, result);
  } catch (error) {
    console.error("investigation-graph /case error:", error);
    res.status(error.status || 500).json({ error: error.message || "Failed to open case" });
  }
});

router.post("/case/:caseId/resume", async (req, res) => {
  try {
    const { caseId } = req.params;
    const { newEvidenceText } = req.body;
    if (typeof newEvidenceText !== "string" || !newEvidenceText.trim()) {
      return res.status(400).json({ error: "newEvidenceText is required" });
    }
    const graph = buildInvestigationGraph().compile({ checkpointer: checkpointer() });
    const result = await graph.invoke(new Command({ resume: newEvidenceText }), { configurable: { thread_id: caseId } });
    respondFromInvoke(res, result);
  } catch (error) {
    console.error("investigation-graph /resume error:", error);
    res.status(error.status || 500).json({ error: error.message || "Failed to resume case" });
  }
});

router.use((req, res) => res.status(405).json({ error: "Method not allowed" }));
export default router;
