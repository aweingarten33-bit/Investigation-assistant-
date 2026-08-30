import { z } from "zod";
import { EVIDENCE_TYPES } from "../routes/analyze-report.js";
import { ACH_MARKS } from "../lib/ach.js";
import { ASSUMPTION_GROUNDING, ASSUMPTION_SENSITIVITY } from "../lib/key-assumptions-check.js";
import { SOURCE_RELIABILITY_GRADES, INFORMATION_CREDIBILITY_GRADES } from "../lib/admiralty.js";

// evidenceType is reused from the legacy schema deliberately — it is a
// vocabulary/data enum (document/interview/audit/...), not part of the old
// sufficiency-check reasoning this graph no longer depends on.
export const AchEvidenceZ = z.object({
  id: z.string().min(1).max(80),
  sourceLabel: z.string().min(1).max(120),
  lineStart: z.number().int().positive(),
  lineEnd: z.number().int().positive(),
  evidenceType: z.enum(EVIDENCE_TYPES),
  summary: z.string().min(1).max(1000),
  // Admiralty grading is optional and model-supplied only when it has an
  // actual basis — never auto-computed, never a stand-in for witness
  // credibility. See server/lib/admiralty.js.
  sourceReliability: z.enum(SOURCE_RELIABILITY_GRADES).nullable().catch(null),
  informationCredibility: z.enum(INFORMATION_CREDIBILITY_GRADES).nullable().catch(null),
});

export const AchFindingZ = z.object({
  id: z.string().max(80).catch(""),
  statement: z.string().min(1).max(2000),
  supportingEvidenceIds: z.array(z.string().max(80)).max(50).catch([]),
  contradictingEvidenceIds: z.array(z.string().max(80)).max(50).catch([]),
});

export const AchHypothesisZ = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
});

// marks is keyed by hypothesis id, which is model-chosen per case, so it
// cannot be a fixed Zod object shape. Cell values are validated/defaulted
// against ACH_MARKS defensively in server/lib/ach.js (an unknown or missing
// mark reads as not_applicable, Heuer's "does not bear on this
// hypothesis") rather than failing the whole call over one cell — the same
// graduated-tolerance posture normalizeSufficiencyChecks used to use, kept
// here at the cell level instead of the check level.
export const AchMatrixRowZ = z.object({
  evidenceId: z.string().min(1).max(80),
  marks: z.record(z.string(), z.string()),
});

export const EvidenceExtractionZ = z.object({
  evidenceItems: z.array(AchEvidenceZ).max(100),
  findings: z.array(AchFindingZ).max(50),
  hypotheses: z.array(AchHypothesisZ).min(1).max(7),
  achMatrix: z.array(AchMatrixRowZ).max(150),
  unresolvedQuestions: z.array(z.string().min(1).max(500)).max(20).catch([]),
});

export const KeyAssumptionZ = z.object({
  id: z.string().min(1).max(40),
  statement: z.string().min(1).max(1000),
  assumptionType: z.enum(["implicit", "boundary", "absence_of_evidence", "explicit"]),
  grounding: z.enum(ASSUMPTION_GROUNDING),
  sensitivity: z.enum(ASSUMPTION_SENSITIVITY),
  disposition: z.enum(["re-source", "test", "bound", "flag"]),
  dispositionNote: z.string().max(500).catch(""),
});

export const KeyAssumptionsCheckZ = z.object({
  keyAssumptions: z.array(KeyAssumptionZ).max(15),
});

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
  targetGapId: z.string().min(1).max(80),
  actionType: z.enum(NEXT_ACTION_TYPES),
  action: z.string().min(1).max(500),
  whyThisIsNext: z.string().min(1).max(1000),
  evidenceOrPersonNeeded: z.string().min(1).max(300),
  suggestedQuestions: z.array(z.string().min(1).max(300)).max(8).catch([]),
  documentRequest: z.string().max(500).catch(""),
  expectedInformationGain: z.string().min(1).max(500),
  whatCouldChangeBasedOnResult: z.string().min(1).max(500),
});

export const FinalRecommendationZ = z.object({
  recommendedDetermination: z.enum(["substantiated", "unsubstantiated", "inconclusive", "not_applicable"]),
  rationale: z.string().min(1).max(3000),
  whatCouldChangeThis: z.string().min(1).max(1000),
});

// What the human supplies on resume. Validated at the API boundary before
// the graph is ever resumed (POST /resume returns 400 on a mismatch) AND
// re-validated inside ingestHumanResult as a second line of defense against
// anything that reaches the graph via a direct Command({resume}) call
// bypassing that boundary.
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
