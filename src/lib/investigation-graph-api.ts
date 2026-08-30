// Thin fetch wrapper for the LangGraph-backed /api/investigations routes —
// kept separate from src/lib/api.ts's callApi because that helper's route
// union assumes a single fixed POST /api/<route> path, not a caseId-scoped
// REST surface (start/resume/state).
import type { EvidenceItem, TraceableFinding } from "@/lib/types";

export type NextBestActionType =
  | "OBTAIN_RECORD" | "INTERVIEW" | "RESOLVE_CONTRADICTION" | "VERIFY_TIMELINE"
  | "VERIFY_ACCESS_LOGS" | "REVIEW_DOCUMENT" | "COMPARE_TO_POLICY"
  | "DOCUMENT_UNAVAILABLE_EVIDENCE" | "ESCALATE_FOR_HUMAN_REVIEW" | "NO_FURTHER_REASONABLE_ACTION";

export interface NextBestAction {
  targetGapId: string;
  actionType: NextBestActionType;
  action: string;
  whyThisIsNext: string;
  evidenceOrPersonNeeded: string;
  suggestedQuestions: string[];
  documentRequest: string;
  expectedInformationGain: string;
  whatCouldChangeBasedOnResult: string;
}

// incomplete: a resolvable material gap remains. ready_with_limitations:
// material uncertainty remains but nothing further is reasonably
// obtainable. ready_for_review: no material, resolvable gap remains.
export type InvestigationStatus = "incomplete" | "ready_with_limitations" | "ready_for_review";

export interface ActionHistoryEntry {
  actionType: NextBestActionType;
  evidenceOrPersonNeeded: string;
  targetGapId?: string;
  status: "recommended" | "completed" | "unavailable";
}

export interface HumanInputEntry {
  resultType: string;
  text: string;
  respondingToAction: NextBestAction | null;
  at: string;
}

// One row of the Analysis of Competing Hypotheses matrix.
export interface AchMatrixRow {
  evidenceId: string;
  marks: Record<string, "strongly_consistent" | "consistent" | "neutral" | "inconsistent" | "strongly_inconsistent" | "not_applicable">;
}

export interface AchHypothesis {
  id: string;
  label: string;
  description: string;
}

export interface AchRankingEntry {
  hypothesisId: string;
  label: string;
  weightedInconsistency: number;
  rawInconsistencyCount: number;
}

export interface AchResult {
  ranking: AchRankingEntry[];
  diagnosticity: { evidenceId: string; spread: number; flag: string | null }[];
  mostDiagnosticEvidenceIds: string[];
  mostDiagnosticSpread: number;
}

export interface SensitivityResult {
  currentLeaderId: string | null;
  pivotalEvidenceIds: string[];
  flips: { evidenceId: string; newLeaderId: string }[];
}

export interface KeyAssumption {
  id: string;
  statement: string;
  assumptionType: "implicit" | "boundary" | "absence_of_evidence" | "explicit";
  grounding: "weak" | "partial" | "strong";
  sensitivity: "low" | "medium" | "high";
  disposition: "re-source" | "test" | "bound" | "flag";
  dispositionNote: string;
  category: "basically_solid" | "correct_with_caveats" | "unsupported_questionable" | "deprioritize";
}

export interface InvestigativeGap {
  id: string;
  gapType: "pivotal_evidence_needs_corroboration" | "unresolved_contradiction" | "unresolved_key_assumption" | "discriminating_evidence_missing";
  description: string;
  relatedEvidenceIds?: string[];
  relatedHypothesisIds?: string[];
  relatedAssumptionIds?: string[];
  resolvable: boolean;
}

export interface FinalRecommendation {
  recommendedDetermination: "substantiated" | "unsubstantiated" | "inconclusive" | "not_applicable";
  leadingHypothesis: AchHypothesis | null;
  competingHypotheses: AchHypothesis[];
  evidenceSupporting: string[];
  evidenceContradicting: string[];
  mostDiagnosticEvidenceIds: string[];
  achResult: AchResult;
  sensitivity: SensitivityResult;
  keyAssumptions: KeyAssumption[];
  remainingLimitations: InvestigativeGap[];
  whatCouldChangeThis: string;
  aiRationale: string;
  humanFinalDetermination: "pending";
}

export interface InvestigationCaseState {
  status: "paused" | "complete" | "error";
  interrupt?: { kind: string; message: string; recommendedAction?: NextBestAction; finalRecommendation?: FinalRecommendation; [key: string]: unknown } | null;
  caseId?: string;
  caseObjective?: string;
  allegations?: string;
  organizationContext?: string;
  evidenceItems?: EvidenceItem[];
  findings?: TraceableFinding[];
  hypotheses?: AchHypothesis[];
  achMatrix?: AchMatrixRow[];
  achResult?: AchResult;
  sensitivity?: SensitivityResult;
  keyAssumptions?: KeyAssumption[];
  unresolvedQuestions?: string[];
  investigativeGaps?: InvestigativeGap[];
  investigationStatus?: InvestigationStatus;
  currentNextBestAction?: NextBestAction | null;
  actionHistory?: ActionHistoryEntry[];
  completedActions?: ActionHistoryEntry[];
  humanInputs?: HumanInputEntry[];
  finalRecommendation?: FinalRecommendation | null;
  lastAnalysisAt?: string | null;
  graphStatus?: string;
  errors?: { node: string; message: string; at: string }[];
}

async function post<T>(path: string, body: unknown): Promise<{ data: T | null; error: Error | null }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const message = json && typeof json.error === "string" ? json.error : `Request failed (${res.status})`;
      return { data: null, error: new Error(message) };
    }
    return { data: json, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error("Network error") };
  }
}

export function startInvestigationCase(caseId: string, body: { caseObjective?: string; allegations?: string; organizationContext?: string; caseNotes: string }) {
  return post<InvestigationCaseState>(`/api/investigations/${encodeURIComponent(caseId)}/start`, body);
}

export function resumeInvestigationCase(caseId: string, body: { resultType: string; text: string }) {
  return post<InvestigationCaseState>(`/api/investigations/${encodeURIComponent(caseId)}/resume`, body);
}

export async function getInvestigationCaseState(caseId: string): Promise<{ data: InvestigationCaseState | null; error: Error | null }> {
  try {
    const res = await fetch(`/api/investigations/${encodeURIComponent(caseId)}/state`);
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const message = json && typeof json.error === "string" ? json.error : `Request failed (${res.status})`;
      return { data: null, error: new Error(message) };
    }
    return { data: json, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error("Network error") };
  }
}
