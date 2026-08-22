export type Decision = "substantiated" | "unsubstantiated" | "needs_more_info";
export type RiskLevel = "low" | "moderate" | "high" | "critical";
export type RecommendationTier = "re-education" | "written_warning" | "consider_termination" | "recommend_termination" | "policy_review";
export type EvidenceType = "document" | "interview" | "audit" | "system_record" | "policy" | "other";
export type EvidenceStance = "supports" | "contradicts" | "context";
export type EvidenceStatus = "corroborated" | "supported" | "single_source" | "contradicted" | "insufficient";
export type DisciplineImpact = "mitigating" | "neutral" | "aggravating" | "unknown";
export type HumanReviewStatus = "approved" | "approved_with_changes" | "needs_more_info" | "rejected";

export interface Source {
  url: string;
  title: string;
}

export interface EvidenceItem {
  id: string;
  sourceLabel: string;
  lineStart: number;
  lineEnd: number;
  evidenceType: EvidenceType;
  stance: EvidenceStance;
  summary: string;
  reference: string;
  excerpt: string;
}

export interface TraceableFinding {
  id: string;
  statement: string;
  inference: string;
  evidenceStatus: EvidenceStatus;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
}

export interface DisciplineFactor {
  factor:
    | "intent" | "role_expectations" | "sensitivity" | "actual_harm" | "potential_harm"
    | "concealment" | "cooperation" | "prior_discipline" | "prior_training" | "policy_language"
    | "precedent" | "cba_union" | "leadership_role" | "retaliation" | "personal_benefit"
    | "fraud" | "patient_safety" | "regulatory_reporting";
  assessment: string;
  impact: DisciplineImpact;
  evidenceIds: string[];
}

export interface DisciplineRange {
  minimum: string;
  maximum: string;
  recommended: string;
  rationale: string;
  policyDependent: boolean;
  requiresHrLegalReview: boolean;
}

export interface HumanReviewRecord {
  reviewerName: string;
  reviewerRole: string;
  status: HumanReviewStatus;
  finalFinding: string;
  finalAction: string;
  rationale: string;
  reviewedAt: string;
}

export interface AnalysisMetadata {
  analysisVersion: string;
  generatedAt: string;
  sourceFingerprint: string;
  organizationContextApplied: boolean;
  researchTopic: string | null;
  evidenceCount: number;
  findingCount: number;
}

export interface AnalysisResult {
  // Classification / decision support
  decision: Decision;
  confidenceScore: number;
  riskLevel: RiskLevel;
  violationType: string;
  violationCount: string;
  recommendationTier: RecommendationTier;
  aggravatingFactors: string[];
  mitigatingFactors: string[];
  notesCompleteness: "complete" | "partial" | "insufficient";
  sources?: Source[];
  evidenceItems: EvidenceItem[];
  findings: TraceableFinding[];
  disciplineFactors: DisciplineFactor[];
  disciplineRange: DisciplineRange;
  policyQuestions: string[];

  // Report
  introduction: string;
  incidentOverview: string;
  incidentDetails: string;
  investigationFindings: string[];
  regulationsCited: string[];
  recommendations: string;
  conclusion: string;
  missingInfo: string[] | null;

  // Provenance / human review. This demo keeps these in the current result
  // and export only; a production case store should persist immutable events.
  analysisMetadata?: AnalysisMetadata;
  humanReview?: HumanReviewRecord;

  // Client-side
  caseId: string;
}
