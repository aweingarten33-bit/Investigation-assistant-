import express from "express";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { Command } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { buildInvestigationGraph } from "../graph/investigation-graph.js";
import { HumanResultZ } from "../graph/schemas.js";

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

// A fresh deploy has no data/ directory, and SQLite will not create it.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

function checkpointer() {
  return SqliteSaver.fromConnString(DB_PATH);
}

function compiledGraph() {
  return buildInvestigationGraph().compile({ checkpointer: checkpointer() });
}

const StartBodyZ = z.object({
  caseObjective: z.string().max(1000).catch(""),
  allegations: z.string().max(2000).catch(""),
  organizationContext: z.string().max(40_000).catch(""),
  caseNotes: z.string().min(1, "caseNotes is required").max(100_000),
});

// Exported so validation can be unit tested directly (repo convention:
// analyze-report.js exports describeZodIssues/callStructuredWithRetry for
// the same reason — no need for an HTTP-level test harness).
export function parseStartBody(body) {
  return StartBodyZ.safeParse(body ?? {});
}

export function parseResumeBody(body) {
  return HumanResultZ.safeParse(body ?? {});
}

// A case "exists" once any invoke has run against this thread_id — the
// default state has an empty caseId, so a populated one is proof a
// checkpoint is already there. This is what makes POST /start idempotent:
// an existing case is never re-invoked (which would either re-run the AI
// or collide with LangGraph's resume semantics for an interrupted thread);
// it just gets its current state read back.
function caseExists(snapshot) {
  return Boolean(snapshot?.values?.caseId);
}

function interruptPayload(snapshot) {
  const task = (snapshot.tasks || []).find((t) => (t.interrupts || []).length > 0);
  return task ? task.interrupts[0].value : null;
}

const PUBLIC_FIELDS = [
  "caseId", "caseObjective", "allegations", "organizationContext",
  "evidenceItems", "findings", "hypotheses", "sufficiencyChecks",
  "closureAssessment", "unresolvedQuestions", "investigationStatus",
  "currentNextBestAction", "actionHistory", "completedActions", "humanInputs",
  "lastAnalysisAt", "graphStatus", "errors", "warnings",
];

function publicState(values) {
  const out = {};
  for (const key of PUBLIC_FIELDS) out[key] = values?.[key];
  return out;
}

function describeSnapshot(snapshot) {
  if (!caseExists(snapshot)) return null;
  const paused = (snapshot.next || []).length > 0;
  if (paused) {
    return { status: "paused", interrupt: interruptPayload(snapshot), ...publicState(snapshot.values) };
  }
  const values = snapshot.values;
  return { status: values?.graphStatus === "error" ? "error" : "complete", ...publicState(values) };
}

// Access control. Set INVESTIGATIONS_API_KEY and every request must send it
// (Authorization: Bearer <key> or X-API-Key). Fails closed: wrong or missing
// key is a 401. If the key is NOT set, production (NODE_ENV=production or on
// Render) refuses all requests with a 503; only local dev stays open.
export function requireInvestigationsKey(req, res, next) {
  const expected = process.env.INVESTIGATIONS_API_KEY;
  if (!expected) {
    if (process.env.NODE_ENV === "production" || process.env.RENDER) {
      return res.status(503).json({ error: "INVESTIGATIONS_API_KEY is not configured on the server." });
    }
    return next();
  }
  const auth = req.get("authorization") || "";
  const provided = req.get("x-api-key") || (auth.startsWith("Bearer ") ? auth.slice(7) : "");
  const hash = (v) => crypto.createHash("sha256").update(v).digest();
  if (!provided || !crypto.timingSafeEqual(hash(provided), hash(expected))) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Case IDs must be long and unguessable (client uses crypto.randomUUID).
export const CASE_ID_PATTERN = /^[A-Za-z0-9_-]{24,128}$/;

const router = express.Router();
router.use(requireInvestigationsKey);
router.use(express.json({ limit: "2mb" }));

router.post("/:caseId/start", async (req, res) => {
  try {
    const { caseId } = req.params;
    if (!caseId || !caseId.trim()) return res.status(400).json({ error: "caseId is required" });
    if (!CASE_ID_PATTERN.test(caseId)) {
      return res.status(400).json({ error: "caseId must be 24-128 characters (letters, digits, - or _)" });
    }

    const parsed = parseStartBody(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    }

    const config = { configurable: { thread_id: caseId } };
    const graph = compiledGraph();

    const existing = await graph.getState(config);
    if (caseExists(existing)) {
      return res.json(describeSnapshot(existing));
    }

    const { caseObjective, allegations, organizationContext, caseNotes } = parsed.data;
    await graph.invoke({ caseId, caseObjective, allegations, organizationContext, caseNotes }, config);
    const snapshot = await graph.getState(config);
    res.json(describeSnapshot(snapshot));
  } catch (error) {
    console.error("investigations /start error:", error);
    res.status(500).json({ error: error.message || "Failed to start case" });
  }
});

router.post("/:caseId/resume", async (req, res) => {
  try {
    const { caseId } = req.params;
    if (!caseId || !caseId.trim()) return res.status(400).json({ error: "caseId is required" });

    const parsed = parseResumeBody(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    }

    const config = { configurable: { thread_id: caseId } };
    const graph = compiledGraph();

    const existing = await graph.getState(config);
    if (!caseExists(existing)) return res.status(404).json({ error: "No case found for this caseId" });
    if ((existing.next || []).length === 0) {
      return res.status(409).json({ error: "This case is not currently paused for human input" });
    }

    await graph.invoke(new Command({ resume: parsed.data }), config);
    const snapshot = await graph.getState(config);
    res.json(describeSnapshot(snapshot));
  } catch (error) {
    console.error("investigations /resume error:", error);
    res.status(500).json({ error: error.message || "Failed to resume case" });
  }
});

router.get("/:caseId/state", async (req, res) => {
  try {
    const { caseId } = req.params;
    if (!caseId || !caseId.trim()) return res.status(400).json({ error: "caseId is required" });

    const config = { configurable: { thread_id: caseId } };
    const graph = compiledGraph();
    const snapshot = await graph.getState(config);
    const described = describeSnapshot(snapshot);
    if (!described) return res.status(404).json({ error: "No case found for this caseId" });
    res.json(described);
  } catch (error) {
    console.error("investigations /state error:", error);
    res.status(500).json({ error: error.message || "Failed to load case state" });
  }
});

router.use((req, res) => res.status(405).json({ error: "Method not allowed" }));
export default router;
