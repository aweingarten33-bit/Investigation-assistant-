import { AnalysisResult, Decision, RecommendationTier } from "@/lib/types";
import { Classification } from "@/components/ClassificationSummary";

export function suggestLetterType(classification: { decision: Decision; recommendationTier: RecommendationTier }): string | undefined {
  if (classification.decision === "substantiated") return "hr_referral";
  if (classification.decision === "unsubstantiated") return "not_substantiated";
  return undefined;
}

const LETTER_BUTTON_LABEL: Record<string, string> = {
  hr_referral: "Draft HR Referral Memo",
  not_substantiated: "Draft Closure Letter",
};

export function letterButtonLabel(letterType: string | undefined): string {
  return (letterType && LETTER_BUTTON_LABEL[letterType]) || "Draft Notification Letter";
}

export function buildLetterPrefillDetails(result: AnalysisResult): string {
  const lines: string[] = [
    `Case: ${result.caseId}`,
    `Decision: ${result.decision.replace(/_/g, " ")}`,
    `Risk Level: ${result.riskLevel}`,
    `Violation Type: ${result.violationType}`,
    `Violation Count: ${result.violationCount}`,
    `Corrective-Action Range: ${result.disciplineRange.minimum} to ${result.disciplineRange.maximum}`,
    `Recommended for Review: ${result.disciplineRange.recommended}`,
    `Policy Dependent: ${result.disciplineRange.policyDependent ? "yes" : "no"}`,
  ];
  if (result.aggravatingFactors.length > 0) lines.push(`Aggravating Factors: ${result.aggravatingFactors.join("; ")}`);
  if (result.mitigatingFactors.length > 0) lines.push(`Mitigating Factors: ${result.mitigatingFactors.join("; ")}`);
  if (result.policyQuestions.length > 0) lines.push("", "Questions before final action:", ...result.policyQuestions.map((q) => `- ${q}`));

  lines.push("", "Incident Overview:", result.incidentOverview, "", "Incident Details:", result.incidentDetails);
  if (result.investigationFindings.length > 0) lines.push("", "Investigation Findings:", ...result.investigationFindings.map((f) => `- ${f}`));
  lines.push("", "Recommendations:", result.recommendations);
  return lines.join("\n");
}

export function buildLetterPrefillFromClassification(classification: Classification, caseFacts: string): string {
  const lines: string[] = [
    `Decision: ${classification.decision.replace(/_/g, " ")}`,
    `Risk Level: ${classification.riskLevel}`,
    `Violation Type: ${classification.violationType}`,
    `Violation Count: ${classification.violationCount}`,
    `Corrective-Action Range: ${classification.disciplineRange.minimum} to ${classification.disciplineRange.maximum}`,
    `Recommended for Review: ${classification.disciplineRange.recommended}`,
    `Policy Dependent: ${classification.disciplineRange.policyDependent ? "yes" : "no"}`,
  ];
  if (classification.aggravatingFactors.length > 0) lines.push(`Aggravating Factors: ${classification.aggravatingFactors.join("; ")}`);
  if (classification.mitigatingFactors.length > 0) lines.push(`Mitigating Factors: ${classification.mitigatingFactors.join("; ")}`);
  if (classification.policyQuestions.length > 0) lines.push("", "Questions before final action:", ...classification.policyQuestions.map((q) => `- ${q}`));
  lines.push("", "Case Facts:", caseFacts.trim());
  return lines.join("\n");
}
