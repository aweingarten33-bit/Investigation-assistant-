export interface NotifyItem {
  who: string;
  always: boolean;
  onlyIf?: string;
  what: string;
  // Which AI Letter Generator template to point at for this handoff, if any.
  letterType?: string;
}

// Shared by the Decision Framework wizard, AI Recommendation, and the full
// report results — who gets told what, and in what order, is the same
// answer everywhere. HR comes first: for a substantiated finding, HR is who
// you tell before anyone else — Compliance recommends, HR decides and acts.
export const NOTIFICATION_CHECKLIST: NotifyItem[] = [
  {
    who: "HR",
    always: false,
    onlyIf: "Substantiated finding",
    what: "Tell them first, before anyone else. Send your findings and recommended action — HR reviews it, makes the final call, and typically delivers it to the employee. You're recommending; HR decides and executes.",
    letterType: "hr_referral",
  },
  {
    who: "The person who was investigated (the subject)",
    always: true,
    what: "They get told the outcome. If substantiated, their supervisor and HR handle the actual discipline conversation — that's not on you.",
  },
  {
    who: "The person who reported it (the complainant)",
    always: true,
    what: "Tell them it was investigated and \"appropriate action was taken.\" Never tell them what happened to the other person — that part is confidential.",
    letterType: "reporter_update",
  },
  {
    who: "The subject's supervisor",
    always: false,
    onlyIf: "Substantiated finding",
    what: "Summary of findings + corrective action plan. NOT the full investigation file.",
  },
  {
    who: "Compliance Committee",
    always: false,
    onlyIf: "Substantiated or significant",
    what: "Summary at next meeting. Trends and patterns. Significant cases in detail.",
  },
  {
    who: "Board / Audit Committee",
    always: false,
    onlyIf: "Large breach, termination, self-disclosure, government program issues",
    what: "Summary only. No operational details.",
  },
  {
    who: "OCR / State AG",
    always: false,
    onlyIf: "Required by law — ALWAYS check with Legal first",
    what: "Only when legally required. See the Regulatory Deadlines section for exact windows.",
  },
];
