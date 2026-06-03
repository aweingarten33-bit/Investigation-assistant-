export type Decision = "substantiated" | "unsubstantiated" | "needs_more_info";
export type RiskLevel = "low" | "moderate" | "high" | "critical";
export type RecommendationTier = "re-education" | "written_warning" | "consider_termination" | "recommend_termination";

export interface AnalysisResult {
  // Classification
  decision: Decision;
  confidenceScore: number;
  riskLevel: RiskLevel;
  violationType: string;
  violationCount: string;
  recommendationTier: RecommendationTier;
  aggravatingFactors: string[];
  mitigatingFactors: string[];
  notesCompleteness: string;

  // Report
  introduction: string;
  incidentOverview: string;
  incidentDetails: string;
  investigationFindings: string[];
  regulationsCited: string[];
  recommendations: string;
  conclusion: string;
  missingInfo: string[] | null;

  // Client-side
  caseId: string;
}
