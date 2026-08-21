import { AnalysisResult, Decision, RecommendationTier } from "@/lib/types";
import { Classification } from "@/components/ClassificationSummary";

const TIER_TO_LETTER_TYPE: Record<RecommendationTier, string> = {
  "re-education": "verbal_counseling",
  "written_warning": "written_warning",
  "consider_termination": "final_warning",
  "recommend_termination": "termination",
};

// Suggests the closest-matching letter type for a determination so the AI
// Letter Generator opens pre-selected instead of blank. Shared by the full
// report flow and the standalone AI Recommendation tool.
export function suggestLetterType(classification: { decision: Decision; recommendationTier: RecommendationTier }): string | undefined {
  if (classification.decision === "substantiated") {
    return TIER_TO_LETTER_TYPE[classification.recommendationTier];
  }
  if (classification.decision === "unsubstantiated") return "not_substantiated";
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

// Same idea, but for the standalone AI Recommendation tool — there's no
// generated report narrative yet, only a classification and the raw facts
// the user typed in. The letter prompt already falls back to bracketed
// placeholders for anything not given.
export function buildLetterPrefillFromClassification(classification: Classification, caseFacts: string): string {
  const lines: string[] = [
    `Decision: ${classification.decision.replace(/_/g, " ")}`,
    `Risk Level: ${classification.riskLevel}`,
    `Violation Type: ${classification.violationType}`,
    `Violation Count: ${classification.violationCount}`,
  ];
  if (classification.aggravatingFactors.length > 0) {
    lines.push(`Aggravating Factors: ${classification.aggravatingFactors.join("; ")}`);
  }
  if (classification.mitigatingFactors.length > 0) {
    lines.push(`Mitigating Factors: ${classification.mitigatingFactors.join("; ")}`);
  }
  lines.push("", "Case Facts:", caseFacts.trim());
  return lines.join("\n");
}
