// Thin fetch wrapper for the LangGraph-backed /api/investigations routes —
// kept separate from src/lib/api.ts's callApi because that helper's route
// union assumes a single fixed POST /api/<route> path, not a caseId-scoped
// REST surface (start/resume/state).
import type {
  ClosureAssessment,
  EvidenceItem,
  InvestigationHypothesis,
  SufficiencyCheck,
  TraceableFinding,
} from "@/lib/types";

export type NextBestActionType =
  | "OBTAIN_RECORD" | "INTERVIEW" | "RESOLVE_CONTRADICTION" | "VERIFY_TIMELINE"
  | "VERIFY_ACCESS_LOGS" | "REVIEW_DOCUMENT" | "COMPARE_TO_POLICY"
  | "DOCUMENT_UNAVAILABLE_EVIDENCE" | "ESCALATE_FOR_HUMAN_REVIEW" | "NO_FURTHER_REASONABLE_ACTION";

export interface NextBestAction {
  actionType: NextBestActionType;
  action: string;
  whyThisIsNext: string;
  evidenceGapAddressed: string;
  evidenceOrPersonNeeded: string;
  suggestedQuestions: string[];
  documentRequest: string;
  expectedInformationGain: string;
  whatCouldChangeBasedOnResult: string;
}

export type InvestigationStatus = "incomplete" | "provisional" | "ready_for_review";

export interface ActionHistoryEntry {
  actionType: NextBestActionType;
  evidenceOrPersonNeeded: string;
  status: "recommended" | "completed" | "unavailable";
}

export interface HumanInputEntry {
  resultType: string;
  text: string;
  respondingToAction: NextBestAction | null;
  at: string;
}

export interface InvestigationCaseState {
  status: "paused" | "complete" | "error";
  interrupt?: { kind: string; message: string; recommendedAction?: NextBestAction; [key: string]: unknown } | null;
  caseId?: string;
  caseObjective?: string;
  allegations?: string;
  organizationContext?: string;
  evidenceItems?: EvidenceItem[];
  findings?: TraceableFinding[];
  hypotheses?: InvestigationHypothesis[];
  sufficiencyChecks?: SufficiencyCheck[];
  closureAssessment?: ClosureAssessment;
  unresolvedQuestions?: string[];
  investigationStatus?: InvestigationStatus;
  currentNextBestAction?: NextBestAction | null;
  actionHistory?: ActionHistoryEntry[];
  completedActions?: ActionHistoryEntry[];
  humanInputs?: HumanInputEntry[];
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
