import { z } from "zod";
import {
  EvidenceZ,
  FindingZ,
  HypothesisZ,
} from "../routes/analyze-report.js";

// This is the narrow slice of the legacy classification schema this graph
// actually needs: evidence, findings, hypotheses, sufficiency checks, plus
// the open questions the model could not resolve. No discipline, no report
// fields. The field-level Zod objects themselves (EvidenceZ, FindingZ,
// HypothesisZ) are transplanted unchanged from the legacy schema — same
// validation rules, same domain vocabulary, reused rather than re-specified.
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
  // Same tolerance as the legacy schema: normalizeSufficiencyChecks (in
  // routes/analyze-report.js, transplanted unchanged) reconciles whatever
  // the model returns against the 8 canonical checks regardless of shape,
  // so this only needs to be "something array-like or empty," not strict.
  sufficiencyChecks: z.array(z.unknown()).catch([]),
  unresolvedQuestions: z.array(z.string().min(1).max(500)).max(20).catch([]),
});

// Kept as a bounded enum (not a proliferating free-text taxonomy) so the UI
// can branch "help me do it" behavior (interview questions vs. a document
// request) off actionType, while the free-text fields below carry the
// actual specificity (who, what record, what question).
export const NEXT_ACTION_TYPES = [
  "OBTAIN_RECORD",
  "INTERVIEW",
  "RESOLVE_CONTRADICTION",
  "VERIFY_TIMELINE",
  "VERIFY_ACCESS_LOGS",
  "REVIEW_DOCUMENT",
  "COMPARE_TO_POLICY",
  "DOCUMENT_UNAVAILABLE_EVIDENCE",
  "ESCALATE_FOR_HUMAN_REVIEW",
  "NO_FURTHER_REASONABLE_ACTION",
];

export const NextActionZ = z.object({
  actionType: z.enum(NEXT_ACTION_TYPES),
  action: z.string().min(1).max(500),
  whyThisIsNext: z.string().min(1).max(1000),
  evidenceGapAddressed: z.string().min(1).max(500),
  evidenceOrPersonNeeded: z.string().min(1).max(300),
  // Only populated when actionType implies an interview / document ask —
  // schema stays permissive (catch to []/"") rather than conditionally
  // required, since a model that omits an irrelevant field shouldn't fail
  // validation over it.
  suggestedQuestions: z.array(z.string().min(1).max(300)).max(8).catch([]),
  documentRequest: z.string().max(500).catch(""),
  expectedInformationGain: z.string().min(1).max(500),
  whatCouldChangeBasedOnResult: z.string().min(1).max(500),
});

// What the human supplies on resume. Validated at the API boundary before
// the graph is ever resumed (POST /resume returns 400 on a mismatch) AND
// re-validated inside ingestHumanResult as a second line of defense against
// anything that reaches the graph via a direct Command({resume}) call
// bypassing that boundary (e.g. a test, or a future non-HTTP caller).
export const HUMAN_RESULT_TYPES = [
  "interview_notes",
  "document",
  "response",
  "unavailable",
  "correction",
];

export const HumanResultZ = z.object({
  resultType: z.enum(HUMAN_RESULT_TYPES),
  text: z.string().min(1).max(20_000),
});
