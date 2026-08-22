import { RecommendationTier } from "@/lib/types";

export interface DisciplineLevel {
  level: 1 | 2 | 3 | 4;
  tier: Exclude<RecommendationTier, "policy_review">;
  title: string;
  subtitle: string;
  color: string;
  bg: string;
  border: string;
  when: string;
  whatToDo: string[];
  whoDoesWhat: { who: string; does: string }[];
}

// These are example action bands for the MANUAL framework, not universal
// healthcare rules and not a severity-to-punishment formula. Organization
// policy, precedent, prior history, CBA/union obligations and HR/Legal review
// control the final action. The AI path uses a factor-by-factor action range.
export const DISCIPLINE_LEVELS: DisciplineLevel[] = [
  {
    level: 1,
    tier: "re-education",
    title: "Band 1 — Coaching / Re-education",
    subtitle: "Potential low-end corrective action",
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
    when: "Potential fit where policy and precedent support coaching, especially for low-harm, non-deliberate conduct with no relevant history.",
    whatToDo: [
      "Confirm organization policy permits coaching for these facts",
      "Use targeted retraining on the specific requirement involved",
      "Document expectations and acknowledgment as required by policy",
      "Use proportionate follow-up monitoring if appropriate",
      "Do not assume where documentation belongs — follow HR/policy requirements",
    ],
    whoDoesWhat: [
      { who: "Compliance", does: "Documents findings and the compliance rationale" },
      { who: "Supervisor", does: "Handles coaching if assigned by HR/policy" },
      { who: "HR", does: "Confirms consistency with policy and past practice" },
    ],
  },
  {
    level: 2,
    tier: "written_warning",
    title: "Band 2 — Formal Corrective Action",
    subtitle: "Potential written-warning range",
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    when: "Potential fit where the conduct warrants formal documentation under policy or where aggravating factors/history move the matter beyond coaching.",
    whatToDo: [
      "Check comparable precedent and progressive-discipline rules",
      "Consider a written warning or equivalent formal corrective action",
      "Assign targeted retraining/competency validation if relevant",
      "Define a proportionate monitoring period and expectations",
      "Document what would trigger further review under policy",
    ],
    whoDoesWhat: [
      { who: "Compliance", does: "Provides findings, evidence and compliance considerations" },
      { who: "HR", does: "Checks consistency, employee-relations requirements and documentation" },
      { who: "Supervisor", does: "Delivers action if designated by HR/policy" },
    ],
  },
  {
    level: 3,
    tier: "consider_termination",
    title: "Band 3 — Serious Corrective Action",
    subtitle: "Final warning, suspension, restrictions, or termination consideration",
    color: "text-orange-600",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    when: "Potential fit for serious conduct or a relevant repeated pattern after policy, precedent, intent, harm, training and prior history are reviewed.",
    whatToDo: [
      "Present a range of serious options rather than treating termination as automatic",
      "Consider interim access restrictions only when justified by ongoing risk",
      "Expand audit/review scope when facts indicate broader exposure",
      "Complete any required breach, patient-safety, or regulatory assessment",
      "Route through HR/Legal and any required labor/CBA process before final action",
    ],
    whoDoesWhat: [
      { who: "Compliance", does: "Presents evidence, risk and corrective-action considerations" },
      { who: "HR + Legal", does: "Review policy, precedent, labor/CBA and employment-law considerations" },
      { who: "Leadership", does: "Approves/escalates as required by governance policy" },
    ],
  },
  {
    level: 4,
    tier: "recommend_termination",
    title: "Band 4 — Most Serious Action Range",
    subtitle: "Termination may be considered; never automatic",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    when: "Reserved for facts that may justify the most serious action under the organization's actual policy and precedent after meaningful HR/Legal review.",
    whatToDo: [
      "Verify the evidence and all material contradictory evidence",
      "Confirm policy language, precedent, prior history and required approvals",
      "Confirm CBA/union or due-process obligations where applicable",
      "Address access, patient-safety, reporting and evidence-preservation needs separately from discipline",
      "Have HR/Legal determine and execute any termination process",
    ],
    whoDoesWhat: [
      { who: "Compliance", does: "Provides the substantiated evidence and compliance-risk analysis" },
      { who: "Legal", does: "Reviews legal, consistency and due-process risk" },
      { who: "HR", does: "Determines/implements employment action with leadership as required" },
    ],
  },
];
