import { z } from "zod";
import {
  EvidenceZ,
  FindingZ,
  HypothesisZ,
} from "../routes/analyze-report.js";

// This is the narrow slice of the legacy classification schema this graph
// actually needs: evidence, findings, hypotheses, sufficiency checks. No
// discipline, no report fields. The field-level Zod objects themselves
// (EvidenceZ, FindingZ, HypothesisZ) are transplanted unchanged from the
// legacy schema — same validation rules, same domain vocabulary, reused
// rather than re-specified.
//
// No parallel JSON schema here on purpose. The legacy path had to
// hand-maintain a JSON-schema twin of every Zod object because the
// provider layer took a raw input_schema and manually parsed tool_use.input.
// withStructuredOutput(zodSchema) takes the Zod schema directly and derives
// the tool schema itself — that hand-maintained duplication is exactly the
// plumbing this migration is supposed to delete, not recreate here.
export const EvidenceAnalysisZ = z.object({
  evidenceItems: z.array(EvidenceZ).max(100),
  findings: z.array(FindingZ).max(50),
  hypotheses: z.array(HypothesisZ).min(1).max(6),
  // Same tolerance as the legacy schema: normalizeSufficiencyChecks (below,
  // transplanted unchanged from analyze-report.js) reconciles whatever the
  // model returns against the 8 canonical checks regardless of shape, so
  // this only needs to be "something array-like or empty," not strict.
  sufficiencyChecks: z.array(z.unknown()).catch([]),
});

// The 8-value taxonomy from the architecture review, collapsed from the
// original 17-candidate brainstorm: specificity (who, what record) belongs
// in whatToDo/evidenceOrPersonNeeded text, not in a proliferating enum.
export const NEXT_ACTION_TYPES = [
  "OBTAIN_RECORD",
  "INTERVIEW",
  "RESOLVE_CONTRADICTION",
  "VERIFY_TIMELINE",
  "REVIEW_DOCUMENT",
  "DOCUMENT_UNAVAILABLE_EVIDENCE",
  "ESCALATE_FOR_HUMAN_REVIEW",
  "NO_FURTHER_REASONABLE_ACTION",
];

export const NextActionZ = z.object({
  actionType: z.enum(NEXT_ACTION_TYPES),
  objective: z.string().min(1).max(500),
  whatToDo: z.string().min(1).max(1000),
  whyThisIsNext: z.string().min(1).max(1000),
  issueBeingResolved: z.string().min(1).max(500),
  evidenceOrPersonNeeded: z.string().min(1).max(300),
  ifConfirmed: z.string().max(500).catch(""),
  ifNotConfirmed: z.string().max(500).catch(""),
  ifUnavailable: z.string().max(500).catch(""),
});
