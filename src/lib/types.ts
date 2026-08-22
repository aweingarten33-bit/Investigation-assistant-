export type Decision = "substantiated" | "unsubstantiated" | "needs_more_info";
export type RiskLevel = "low" | "moderate" | "high" | "critical";
export type RecommendationTier = "re-education" | "written_warning" | "consider_termination" | "recommend_termination" | "policy_review";
export type EvidenceType = "document" | "interview" | "audit" | "system_record" | "policy" | "other";
export type EvidenceStance = "supports" | "contradicts" | "context";
export type EvidenceStatus = "corroborated" | "supported" | "single_source" | "contradicted" | "insufficient";
export type DisciplineImpact = "mitigating" | "neutral" | "aggravating" | "unknown";
export type HumanReviewStatus = "approved" | "approved_with_changes" | "needs_more_info" | "rejected";
export type HypothesisState = "supported" | "partially_supported" | "weakened" | "unresolved" | "contradicted";
export type SufficiencyCheckStatus = "satisfied" | "unresolved" | "not_applicable";
export type ClosureStatus = "ready_to_close" | "not_ready_to_close" | "ready_with_unresolved_limitations";

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

export interface InvestigationHypothesis {
  id: string;
  label: string;
  description: string;
  state: HypothesisState;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  unresolvedQuestions: string[];
}

export interface SufficiencyCheck {
  id:
    | "finding_support"
    | "contradictory_evidence"
    | "objective_records"
    | "key_witnesses"
    | "material_inconsistencies"
    | "policy_regulatory_context"
    | "standard_of_proof"
    | "reporting_escalation";
  status: SufficiencyCheckStatus;
  material: boolean;
  resolvable: boolean;
  rationale: string;
  nextAction: string;
}

export interface ConclusionChangeFactor {
  description: string;
  evidenceNeeded: string;
  impact: string;
}

export interface ClosureAssessment {
  status: ClosureStatus;
  rationale: string;
  unresolvedMaterialIssues: string[];
  whatWouldChangeConclusion: ConclusionChangeFactor[];
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
  researchBrief?: string | null;
  researchProfile?: string | null;
  evidenceItems: EvidenceItem[];
  findings: TraceableFinding[];
  hypotheses: InvestigationHypothesis[];
  sufficiencyChecks: SufficiencyCheck[];
  closureAssessment: ClosureAssessment;
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

  // Provenance / human review. This personal-use build keeps these in the
  // current result and export rather than maintaining an enterprise case DB.
  analysisMetadata?: AnalysisMetadata;
  humanReview?: HumanReviewRecord;

  // Client-side
  caseId: string;
}