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
    `AI Decision Support Finding: ${result.decision.replace(/_/g, " ")}`,
    `Risk Level: ${result.riskLevel}`,
    `Violation Type: ${result.violationType}`,
    `Violation Count: ${result.violationCount}`,
    `AI Corrective-Action Range: ${result.disciplineRange.minimum} to ${result.disciplineRange.maximum}`,
    `AI Recommended for Review: ${result.disciplineRange.recommended}`,
    `Policy Dependent: ${result.disciplineRange.policyDependent ? "yes" : "no"}`,
  ];

  if (result.humanReview) {
    lines.push(
      "",
      "HUMAN REVIEW RECORD — controls over AI recommendation:",
      `Reviewer: ${result.humanReview.reviewerName} (${result.humanReview.reviewerRole})`,
      `Review Status: ${result.humanReview.status.replace(/_/g, " ")}`,
      `Final Human Finding: ${result.humanReview.finalFinding}`,
      `Final Human Action / Disposition: ${result.humanReview.finalAction}`,
      `Human Rationale: ${result.humanReview.rationale}`,
      `Reviewed At: ${result.humanReview.reviewedAt}`,
    );
  } else {
    lines.push("", "HUMAN REVIEW RECORD: No final human decision has been recorded. Do not treat the AI corrective-action range as an authorized employment decision.");
  }

  if (result.aggravatingFactors.length > 0) lines.push(`Aggravating Factors: ${result.aggravatingFactors.join("; ")}`);
  if (result.mitigatingFactors.length > 0) lines.push(`Mitigating Factors: ${result.mitigatingFactors.join("; ")}`);
  if (result.policyQuestions.length > 0) lines.push("", "Questions before final action:", ...result.policyQuestions.map((q) => `- ${q}`));

  lines.push("", "Incident Overview:", result.incidentOverview, "", "Incident Details:", result.incidentDetails);
  if (result.investigationFindings.length > 0) lines.push("", "Investigation Findings:", ...result.investigationFindings.map((f) => `- ${f}`));
  lines.push("", "AI Recommendations / Decision Support:", result.recommendations);
  return lines.join("\n");
}

export function buildLetterPrefillFromClassification(classification: Classification, caseFacts: string): string {
  const lines: string[] = [
    `AI Decision Support Finding: ${classification.decision.replace(/_/g, " ")}`,
    `Risk Level: ${classification.riskLevel}`,
    `Violation Type: ${classification.violationType}`,
    `Violation Count: ${classification.violationCount}`,
    `AI Corrective-Action Range: ${classification.disciplineRange.minimum} to ${classification.disciplineRange.maximum}`,
    `AI Recommended for Review: ${classification.disciplineRange.recommended}`,
    `Policy Dependent: ${classification.disciplineRange.policyDependent ? "yes" : "no"}`,
    "Human Review Record: Not yet recorded — AI output is not a final employment decision.",
  ];
  if (classification.aggravatingFactors.length > 0) lines.push(`Aggravating Factors: ${classification.aggravatingFactors.join("; ")}`);
  if (classification.mitigatingFactors.length > 0) lines.push(`Mitigating Factors: ${classification.mitigatingFactors.join("; ")}`);
  if (classification.policyQuestions.length > 0) lines.push("", "Questions before final action:", ...classification.policyQuestions.map((q) => `- ${q}`));
  lines.push("", "Case Facts:", caseFacts.trim());
  return lines.join("\n");
}
