import { AnalysisResult, RecommendationTier } from "@/lib/types";

const TIER_TO_LETTER_TYPE: Record<RecommendationTier, string> = {
  "re-education": "verbal_counseling",
  "written_warning": "written_warning",
  "consider_termination": "final_warning",
  "recommend_termination": "termination",
};

// Suggests the closest-matching letter type for a completed report so the
// AI Letter Generator opens pre-selected instead of blank.
export function suggestLetterType(result: AnalysisResult): string | undefined {
  if (result.decision === "substantiated") {
    return TIER_TO_LETTER_TYPE[result.recommendationTier];
  }
  if (result.decision === "unsubstantiated") return "not_substantiated";
  return undefined; // needs_more_info — let the user pick once they know more
}

// Builds a case-details summary from a completed report so the Letter
// Generator has real facts to work from instead of an empty textarea.
export function buildLetterPrefillDetails(result: AnalysisResult): string {
  const lines: string[] = [
    `Case: ${result.caseId}`,
    `Decision: ${result.decision.replace(/_/g, " ")}`,
    `Risk Level: ${result.riskLevel}`,
    `Violation Type: ${result.violationType}`,
    `Violation Count: ${result.violationCount}`,
  ];
  if (result.aggravatingFactors.length > 0) {
    lines.push(`Aggravating Factors: ${result.aggravatingFactors.join("; ")}`);
  }
  if (result.mitigatingFactors.length > 0) {
    lines.push(`Mitigating Factors: ${result.mitigatingFactors.join("; ")}`);
  }
  lines.push(
    "",
    "Incident Overview:",
    result.incidentOverview,
    "",
    "Incident Details:",
    result.incidentDetails,
  );
  if (result.investigationFindings.length > 0) {
    lines.push("", "Investigation Findings:", ...result.investigationFindings.map((f) => `- ${f}`));
  }
  lines.push("", "Recommendations:", result.recommendations);
  return lines.join("\n");
}
