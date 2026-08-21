import { useState } from "react";
import { ChevronDown, Copy, Check, CheckCircle2, AlertTriangle, Users, FileText, Scale, Gavel, Eye, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";

const COI_TYPES = [
  {
    type: "💰 Financial",
    description: "Employee or family member has a financial stake in a vendor, competitor, or business partner.",
    examples: [
      "Owns stock in a vendor the org contracts with",
      "Spouse owns a company that provides services to the org",
      "Receives consulting fees from a pharma/device company",
    ],
    redFlags: [
      "Employee always pushes for the same vendor with no clear reason",
      "Contracts awarded without competitive bidding",
      "Unusual pricing or payment terms",
    ],
  },
  {
    type: "👥 Nepotism / Relationships",
    description: "Employee can influence decisions about a family member or close relationship.",
    examples: [
      "Manager hires their spouse/child/sibling",
      "Supervisor evaluates a family member's performance",
      "Employee approves timesheets for a relative",
    ],
    redFlags: [
      "New hires share a last name with their supervisor",
      "Promotions that bypass normal process",
      "Reluctance to discipline a specific employee",
    ],
  },
  {
    type: "🏢 Outside Employment",
    description: "Employee has outside work that conflicts with their job duties.",
    examples: [
      "Works part-time for a competitor",
      "Uses org resources for outside work",
      "Clinical staff moonlighting at a competitor facility",
    ],
    redFlags: [
      "Declining performance or excessive absences",
      "Using org email/systems for non-org business",
      "IP showing up at a competitor",
    ],
  },
  {
    type: "🎁 Gifts / Hospitality",
    description: "Employee accepts gifts or benefits from vendors or referral sources.",
    examples: [
      "Vendor provides expensive meals/tickets/travel",
      "Pharma rep gives gifts above the threshold",
      "Vendor pays for conference registration during a bid",
    ],
    redFlags: [
      "Employee always recommends the same vendor",
      "Undisclosed entertainment expenses",
      "Gifts during procurement cycles",
    ],
  },
  {
    type: "🔬 Research / Academic",
    description: "Researcher has interests that could bias outcomes.",
    examples: [
      "Holds equity in a company whose product they're studying",
      "Receives consulting fees from study sponsor",
      "Enrolls patients in a trial where they have financial interest",
    ],
    redFlags: [
      "Selective reporting of research outcomes",
      "Unusual patient enrollment patterns",
      "Failure to disclose sponsor relationships",
    ],
  },
];

const COI_STEPS = [
  {
    phase: "Phase 1: Assess (Day 0–2)",
    steps: [
      "How did this come up? (disclosure form, hotline, manager, audit, self-report)",
      "What type of COI? (financial, nepotism, outside work, gifts, research)",
      "Check applicable policies: org COI policy, Stark/Anti-Kickback (if physician), IRS 990 (if tax-exempt), state laws, accreditation standards",
      "Risk level? HIGH = large contracts, patient care, government programs. LOW = no decision-making authority over the matter.",
      "Are they actively making conflicted decisions RIGHT NOW? If yes → recuse them immediately. Don't wait.",
    ],
  },
  {
    phase: "Phase 2: Investigate (Day 2–14)",
    steps: [
      "Pull their COI disclosure forms for the past 3–5 years. Did they disclose this?",
      "Map the relationships: Who → Who? What's the financial interest? What decisions did they touch?",
      "Review all decisions they made involving the conflicted entity: contracts, hires, referrals, vendor selections",
      "Interview the employee (use the COI interview template below)",
      "Interview affected parties: committee members, HR, procurement, colleagues",
      "Quantify financial impact: Was the org overcharged? Was a better option passed over?",
    ],
  },
  {
    phase: "Phase 3: Decide (Day 14–21)",
    steps: [
      "Answer 3 questions: (1) Does a COI exist? (2) Was it disclosed? (3) Did it influence decisions?",
      "Pick a management strategy (escalating severity): DISCLOSE & MONITOR → RECUSE → DIVEST → SEPARATE/TERMINATE",
      "Create a written COI management plan: what the conflict is, what they must do, monitoring plan, consequences, review date",
      "Get their written acknowledgment",
    ],
  },
];

const COI_MATRIX = [
  { disclosed: "Yes", influenced: "No", result: "Level 1 — Re-education", note: "The system worked. Disclose & monitor." },
  { disclosed: "Yes", influenced: "Yes", result: "Level 2–3", note: "Why were they still in the room? Review the process." },
  { disclosed: "No", influenced: "No", result: "Level 2 — Written Warning", note: "Failure to disclose IS the violation." },
  { disclosed: "No", influenced: "Yes", result: "Level 3", note: "Undisclosed + influenced decisions = serious." },
  { disclosed: "No", influenced: "Yes + Personal Gain", result: "Level 4 — Recommend Termination", note: "Self-dealing. Evaluate for fraud." },
];

const COI_DISCIPLINE = [
  {
    level: "Level 1 — Re-education",
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
    when: "COI exists, was disclosed, no decisions influenced, employee cooperated.",
    actions: [
      "Coaching conversation about COI policy",
      "Update disclosure form",
      "Create a management plan (disclose & monitor)",
      "No formal discipline — stays in compliance file, NOT personnel file",
    ],
  },
  {
    level: "Level 2 — Written Warning",
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    when: "Failed to disclose a known COI, but no decisions were influenced.",
    actions: [
      "Formal written warning → personnel file",
      "Mandatory COI retraining with competency test",
      "Updated disclosure form",
      "COI management plan with recusal requirements",
      "60-day monitoring",
    ],
  },
  {
    level: "Level 3 — Final Warning / Suspension",
    color: "text-orange-600",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    when: "Undisclosed COI that actually influenced decisions (but no/minimal personal gain), OR violated a prior management plan.",
    actions: [
      "Final written warning + suspension without pay",
      "Permanent removal from conflicted decisions",
      "May need to divest interest or end outside employment",
      "May need to transfer/reassign",
      "90–180 day monitoring",
      "Report to Compliance Committee",
      "Review all affected decisions for bias",
    ],
  },
  {
    level: "Level 4 — Recommend Termination",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    when: "Intentionally concealed COI for personal gain. Self-dealing. Fraud. OR violated a management plan after final warning.",
    actions: [
      "Recommend immediate termination",
      "Revoke all access (coordinate with IT BEFORE the meeting)",
      "Review all their decisions for the past 3–5 years",
      "Quantify financial harm, consider recovery/legal action",
      "Evaluate reporting to OCR, state AG, law enforcement",
      "If tax-exempt: check IRS excess benefit rules",
      "Report to Committee and Board",
    ],
  },
];

const COI_INTERVIEW_SECTIONS = [
  {
    heading: "Opening — Read This Out Loud",
    content: `Thanks for meeting with me. I'm reviewing a potential conflict of interest matter.

• This is an internal review — I'm gathering facts.
• This is confidential — don't discuss with coworkers.
• There's no presumption of wrongdoing. Many COIs can be managed once identified.
• Your cooperation is expected.
• Be completely truthful — failing to disclose is itself a violation.

Do you understand? Any questions?`,
  },
  {
    heading: "Disclosure & Awareness",
    content: `• Are you familiar with the COI policy? When did you last review it?
• Have you completed the annual COI disclosure form? [Show their most recent form]
• Did you disclose [the specific interest/relationship]?
• If not: Were you aware this needed to be disclosed? Why wasn't it?
• If yes: What steps were taken after you disclosed it?
• Has anyone from Compliance or management discussed this with you?`,
  },
  {
    heading: "Nature of the Interest",
    content: `• Describe your [financial interest in / relationship with / outside work at] [entity/person].
• When did it begin?
• What's the financial arrangement? (Ownership %, compensation, consulting fees, gifts)
• Does any immediate family member also have a relationship with [entity/person]?
• Have you received any compensation, gifts, meals, or travel from them?
• Do you have any written agreements with them?`,
  },
  {
    heading: "Decision-Making & Influence",
    content: `• Describe your role in [specific decisions: vendor selection, hiring, contracting, referrals].
• Were you involved in any decisions that affected [entity/person]?
• Were you part of the committee that selected [vendor/candidate]?
• Did you advocate for or against [entity/person]?
• Did you recuse yourself from any decisions? How was that documented?
• Did anyone direct you to participate despite the conflict?`,
  },
  {
    heading: "Closing",
    content: `• Any context you'd like to provide?
• Anything I should know that I haven't asked?
• Any documents that would clarify things?
• Other people I should talk to?
• Any questions for me?

[Remind about confidentiality. Do NOT share the outcome or preliminary conclusions.]`,
  },
];

export default function ConflictOfInterest() {
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
  const [showInterview, setShowInterview] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(key);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <Handshake className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Conflict of Interest</h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-4">
        How to spot, investigate, and handle COIs. Includes interview templates and discipline guidance.
      </p>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground px-1 flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" /> Types of COI
        </h3>
        {COI_TYPES.map((coi) => {
          const isOpen = expandedType === coi.type;
          return (
            <div key={coi.type} className={cn("rounded-lg border border-border overflow-hidden", isOpen && "shadow-sm")}>
              <button
                onClick={() => setExpandedType(isOpen ? null : coi.type)}
                className="w-full flex items-start gap-3 p-3.5 hover:bg-secondary/20 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">{coi.type}</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{coi.description}</p>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 mt-1 transition-transform", !isOpen && "-rotate-90")} />
              </button>
              {isOpen && (
                <div className="border-t border-border p-4 space-y-3 bg-card">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Examples</p>
                    <ul className="space-y-1">
                      {coi.examples.map((ex, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                          <span className="text-muted-foreground mt-0.5">•</span> {ex}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-md bg-warning/10 border border-warning/30 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-warning font-semibold mb-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Red Flags
                    </p>
                    <ul className="space-y-1">
                      {coi.redFlags.map((flag, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                          <span className="mt-0.5">⚠</span> {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground px-1 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" /> How to Investigate a COI
        </h3>
        {COI_STEPS.map((phase, pi) => (
          <div key={pi} className="rounded-lg border border-border bg-card p-4">
            <h4 className="text-sm font-semibold text-foreground mb-2">{phase.phase}</h4>
            <ul className="space-y-1.5">
              {phase.steps.map((step, si) => (
                <li key={si} className="flex items-start gap-2.5 text-xs text-foreground/80">
                  <div className="w-4 h-4 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] font-bold text-primary">{si + 1}</span>
                  </div>
                  {step}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground px-1 flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" /> Quick Decision Matrix
        </h3>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-secondary/30">
                  <th className="text-left p-2.5 font-semibold text-foreground">Disclosed?</th>
                  <th className="text-left p-2.5 font-semibold text-foreground">Influenced?</th>
                  <th className="text-left p-2.5 font-semibold text-foreground">Result</th>
                  <th className="text-left p-2.5 font-semibold text-foreground hidden sm:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {COI_MATRIX.map((row, i) => (
                  <tr key={i}>
                    <td className="p-2.5 text-foreground/80">{row.disclosed}</td>
                    <td className="p-2.5 text-foreground/80">{row.influenced}</td>
                    <td className="p-2.5 font-semibold text-foreground">{row.result}</td>
                    <td className="p-2.5 text-muted-foreground hidden sm:table-cell">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground px-1 flex items-center gap-2">
          <Gavel className="w-4 h-4 text-primary" /> Consequences
        </h3>
        {COI_DISCIPLINE.map((level) => {
          const isOpen = expandedLevel === level.level;
          return (
            <div key={level.level} className={cn("rounded-lg border overflow-hidden", level.border)}>
              <button
                onClick={() => setExpandedLevel(isOpen ? null : level.level)}
                className="w-full flex items-start gap-3 p-3.5 hover:bg-secondary/20 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <h4 className={cn("text-sm font-semibold", level.color)}>{level.level}</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{level.when}</p>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 mt-1 transition-transform", !isOpen && "-rotate-90")} />
              </button>
              {isOpen && (
                <div className={cn("border-t p-4", level.border)}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">What to Do</p>
                  <ul className="space-y-1.5">
                    {level.actions.map((action, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                        <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground px-1 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> COI Interview Template
        </h3>
        <div className="rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setShowInterview(!showInterview)}
            className="w-full flex items-center gap-3 p-3.5 hover:bg-secondary/20 transition-colors text-left"
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              showInterview ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            )}>
              <Users className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">COI Subject Interview Script</p>
              <p className="text-[11px] text-muted-foreground">Copy-ready script for interviewing the employee with the potential conflict</p>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", !showInterview && "-rotate-90")} />
          </button>
          {showInterview && (
            <div className="border-t border-border divide-y divide-border/50">
              {COI_INTERVIEW_SECTIONS.map((section, i) => {
                const copyKey = `coi-interview-${i}`;
                return (
                  <div key={i} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {section.heading}
                      </h4>
                      <button
                        onClick={() => copyText(section.content, copyKey)}
                        className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        {copiedSection === copyKey ? (
                          <><Check className="w-3 h-3 text-success" /> Copied</>
                        ) : (
                          <><Copy className="w-3 h-3" /> Copy</>
                        )}
                      </button>
                    </div>
                    <pre className="text-[12px] sm:text-[13px] text-foreground/85 whitespace-pre-wrap font-sans leading-[1.6] bg-secondary/20 p-3 rounded-md border border-border/50 overflow-x-hidden">
                      {section.content}
                    </pre>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
