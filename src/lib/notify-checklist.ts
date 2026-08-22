export interface NotifyItem {
  who: string;
  always: boolean;
  onlyIf?: string;
  what: string;
  letterType?: string;
}

// Decision-support checklist, not a universal legal notification order.
// Actual routing depends on organization policy, privilege strategy, labor
// requirements, incident type, regulatory duties, and authorized leadership.
export const NOTIFICATION_CHECKLIST: NotifyItem[] = [
  {
    who: "HR / Employee Relations",
    always: false,
    onlyIf: "A substantiated finding may lead to employment action",
    what: "Route the evidence, material contradictions, policy questions, and corrective-action range through the organization's required HR/Employee Relations process before serious employment action. Compliance supplies the investigation record; authorized management/HR applies employment policy.",
    letterType: "hr_referral",
  },
  {
    who: "The person investigated",
    always: false,
    onlyIf: "Required by policy, due process, labor/CBA terms, or the chosen closure/discipline process",
    what: "Provide the level of outcome notice required by policy and law. HR/supervision should handle employment-action communications where appropriate. Do not disclose privileged or unrelated confidential investigation material.",
  },
  {
    who: "The reporter / complainant",
    always: false,
    onlyIf: "A status/closure update is appropriate and permitted",
    what: "Acknowledge that the concern was reviewed and provide only the status information your policy permits. Do not disclose confidential personnel discipline or promise confidentiality that cannot be guaranteed.",
    letterType: "reporter_update",
  },
  {
    who: "Subject's leadership / supervisor",
    always: false,
    onlyIf: "Needed to implement approved corrective action or operational controls",
    what: "Share only the information necessary for the supervisor's role, consistent with HR/Legal guidance and need-to-know principles.",
  },
  {
    who: "Compliance / Privacy Committee",
    always: false,
    onlyIf: "Required by governance policy or the matter is significant/trend-relevant",
    what: "Use the level of detail required for oversight, trends, corrective action, and accountability; avoid unnecessary personnel detail.",
  },
  {
    who: "Board / Audit or Compliance Committee",
    always: false,
    onlyIf: "Required by governance policy or significance warrants escalation",
    what: "Escalate matters such as material breaches, government-program exposure, significant patient-safety events, self-disclosures, or major control failures according to the organization's governance framework.",
  },
  {
    who: "Regulators / State agencies / Law enforcement / Licensing bodies",
    always: false,
    onlyIf: "A verified legal, regulatory, contractual, or reporting obligation applies",
    what: "Verify the exact authority, scope, recipient, deadline, and required content before reporting. Coordinate with Legal/Privacy/Compliance as the organization requires; do not infer a reporting duty solely from an AI risk label.",
  },
];
