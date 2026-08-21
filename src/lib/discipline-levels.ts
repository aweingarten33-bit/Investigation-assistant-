import { RecommendationTier } from "@/lib/types";

export interface DisciplineLevel {
  level: 1 | 2 | 3 | 4;
  tier: RecommendationTier;
  title: string;
  subtitle: string;
  color: string;
  bg: string;
  border: string;
  when: string;
  whatToDo: string[];
  whoDoesWhat: { who: string; does: string }[];
}

// Shared by the Decision Framework wizard and the AI Recommendation tool so
// a given tier always means the same concrete actions in both places.
export const DISCIPLINE_LEVELS: DisciplineLevel[] = [
  {
    level: 1,
    tier: "re-education",
    title: "Level 1 — Re-education",
    subtitle: "Verbal counseling, not in personnel file",
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
    when: "First time, didn't know, no harm, no history.",
    whatToDo: [
      "Have a coaching conversation with them (their supervisor does this)",
      "Give them targeted retraining on the specific thing they violated",
      "Have them sign an acknowledgment that they understand",
      "Monitor them for 30 days to make sure it sticks",
      "This does NOT go in their personnel file — it stays in the compliance file",
    ],
    whoDoesWhat: [
      { who: "You (Compliance)", does: "Draft the talking points and identify the retraining needed" },
      { who: "Their Supervisor", does: "Has the coaching conversation and documents it" },
      { who: "HR", does: "Gets a copy for the compliance file (NOT the personnel file)" },
    ],
  },
  {
    level: 2,
    tier: "written_warning",
    title: "Level 2 — Written Warning",
    subtitle: "Formal warning, goes in personnel file",
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    when: "Second offense, or first time but they should have known better. No intentional wrongdoing.",
    whatToDo: [
      "Formal written warning — this one goes in the personnel file",
      "Mandatory retraining with a test they have to pass",
      "Performance improvement plan with clear expectations",
      "60–90 day monitoring period",
      "Tell them clearly: next time is worse",
    ],
    whoDoesWhat: [
      { who: "You (Compliance)", does: "Draft the written warning with specific findings" },
      { who: "HR", does: "Review it for consistency with past practice, sit in on the meeting" },
      { who: "Their Supervisor", does: "Deliver the warning with HR present" },
    ],
  },
  {
    level: 3,
    tier: "consider_termination",
    title: "Level 3 — Final Warning / Suspension",
    subtitle: "Consider termination. Last chance.",
    color: "text-orange-600",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    when: "Serious violation, or they've been warned before and did it again. Real harm potential.",
    whatToDo: [
      "Present BOTH a final written warning and termination as options",
      "Immediate access suspension pending review",
      "Comprehensive audit of records accessed in the relevant period",
      "Breach risk assessment if PHI was involved",
      "May need to reassign them or restrict access",
      "Report to Compliance Committee, consider board notification",
    ],
    whoDoesWhat: [
      { who: "You (Compliance)", does: "Present findings to CCO/Committee, draft the recommendation" },
      { who: "HR + Legal", does: "Review everything, approve the action" },
      { who: "HR + Supervisor", does: "Deliver it together" },
    ],
  },
  {
    level: 4,
    tier: "recommend_termination",
    title: "Level 4 — Recommend Termination",
    subtitle: "They're done. Fired.",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    when: "Intentional fraud, patient harm, retaliation, willful pattern, or they already got a final warning and did it again.",
    whatToDo: [
      "Recommend termination — effective immediately upon HR approval",
      "Revoke ALL system access BEFORE the meeting (coordinate with IT)",
      "Collect badge, keys, laptop, phone, everything",
      "Figure out if you need to report to law enforcement, OCR, or licensing boards",
      "Brief the Compliance Committee and Board",
      "Make sure their patients/cases are safely transferred",
    ],
    whoDoesWhat: [
      { who: "You (Compliance)", does: "Present findings + recommendation to CCO, Legal, HR" },
      { who: "Legal", does: "Review for wrongful termination risk" },
      { who: "HR", does: "Handle the logistics. HR leads the termination meeting — NOT Compliance" },
    ],
  },
];

export function disciplineLevelForTier(tier: RecommendationTier): DisciplineLevel {
  return DISCIPLINE_LEVELS.find((d) => d.tier === tier) ?? DISCIPLINE_LEVELS[1];
}
