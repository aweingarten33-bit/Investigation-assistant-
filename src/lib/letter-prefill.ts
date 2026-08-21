import { AnalysisResult, Decision, RecommendationTier } from "@/lib/types";
import { Classification } from "@/components/ClassificationSummary";

// Suggests the letter to draft *right now* for a determination, so the AI
// Letter Generator opens pre-selected instead of blank. For a substantiated
// finding that's always the HR Referral Memo first — per the notification
// order, HR gets told before the employee does, and HR (not Compliance)
// sends the actual discipline letter. Shared by the full report flow and
// the standalone AI Recommendation tool.
export function suggestLetterType(classification: { decision: Decision; recommendationTier: RecommendationTier }): string | undefined {
  if (classification.decision === "substantiated") return "hr_referral";
  if (classification.decision === "unsubstantiated") return "not_substantiated";
  return undefined; // needs_more_info — let the user pick once they know more
}

const LETTER_BUTTON_LABEL: Record<string, string> = {
  hr_referral: "Draft HR Referral Memo",
  not_substantiated: "Draft Closure Letter",
};

// Labels the handoff button by what it actually produces, instead of a
// generic "Draft Notification Letter" that doesn't say who it's for.
export function letterButtonLabel(letterType: string | undefined): string {
  return (letterType && LETTER_BUTTON_LABEL[letterType]) || "Draft Notification Letter";
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
