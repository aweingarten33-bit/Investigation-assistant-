import { useState } from "react";
import {
  ChevronDown, Scale, Shield, FileText, Users, Phone, BookOpen,
  Lightbulb, AlertTriangle, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  title: string;
  bullets: string[];
  tip?: string;
}

interface Phase {
  id: string;
  title: string;
  icon: LucideIcon;
  timeframe: string;
  tldr: string;
  steps: Step[];
}

const PHASES: Phase[] = [
  {
    id: "intake",
    title: "Phase 1: Intake & Triage",
    icon: Phone,
    timeframe: "Immediately / Day 0–1",
    tldr: "Capture the allegation, identify immediate risk, calendar any legal reporting clock, and preserve evidence before it changes or disappears.",
    steps: [
      {
        title: "Capture the concern neutrally",
        bullets: [
          "Record what was reported, when, through what channel, and by whom if known.",
          "Separate the reporter's allegation from facts already independently verified.",
          "Do not label an allegation 'false,' 'fraud,' 'abuse,' 'retaliation,' or 'a HIPAA breach' before the evidence supports that conclusion.",
        ],
      },
      {
        title: "Triage immediate risk before the full investigation",
        bullets: [
          "Address patient/resident safety, ongoing PHI exposure, system access, controlled-substance security, retaliation risk, evidence destruction, and other active harm immediately.",
          "Determine whether a regulatory or contractual reporting clock has already started. A final investigation report is not required before many initial notices.",
          "Use Regulatory Deadlines for federal/New York clocks that may apply, then verify the exact rule against the facility type and facts.",
        ],
      },
      {
        title: "Decide who should own or co-manage the matter",
        bullets: [
          "Compliance/Privacy may investigate directly, refer, or co-manage with HR, Legal, Risk, Quality, Security, Pharmacy, Medical Staff, Internal Audit, or another function depending on the issue.",
          "A purely performance/interpersonal matter may belong primarily with HR; a patient-safety or professional-practice issue may need Quality/Medical Staff leadership; criminal or major legal exposure may require counsel.",
          "Avoid investigator conflicts or material bias. If your independence is questionable, reassign or add an independent reviewer.",
        ],
      },
      {
        title: "Preserve evidence early",
        bullets: [
          "Preserve the evidence most likely to disappear first: EHR/audit logs, emails/messages, social-media posts, surveillance, call recordings, badge logs, medication-system logs, scheduling/assignment data, and document version history.",
          "Use the organization's legal-hold or preservation process when appropriate; do not issue a 'legal hold' casually if that term is reserved for Legal.",
          "Document what was preserved, by whom, when, and from what system/source.",
        ],
      },
      {
        title: "Privilege: involve counsel when it actually helps",
        bullets: [
          "Counsel involvement can be important for government investigations, False Claims Act/whistleblower exposure, serious patient harm, professional-licensing issues, major financial exposure, or possible criminal conduct.",
          "Do not assume that copying a lawyer or labeling a document 'privileged' automatically makes the investigation privileged. Privilege depends on the purpose, participants, confidentiality, and applicable law.",
          "If counsel is directing a privileged investigation, follow counsel's instructions on interview warnings, documentation, and distribution.",
        ],
      },
    ],
  },
  {
    id: "planning",
    title: "Phase 2: Plan the Investigation",
    icon: FileText,
    timeframe: "Day 0–3",
    tldr: "Define exactly what you are trying to prove or disprove and what evidence would change the answer.",
    steps: [
      {
        title: "Turn the complaint into specific allegations",
        bullets: [
          "Break broad concerns into answerable allegations: who allegedly did what, when, where, involving whom/what, and why it may violate a rule.",
          "For each allegation, identify the applicable policy/regulation and the elements or factual questions that matter.",
          "Do not let one substantiated allegation automatically prove every allegation in the complaint.",
        ],
      },
      {
        title: "Build an evidence plan",
        bullets: [
          "List objective records first: EHR audit trails, patient charts, billing/claims, access logs, emails/texts, schedules, staffing, medication logs, policies, training, surveillance, contracts, and relevant external records.",
          "Identify which source can prove or disprove each key fact and who controls that source.",
          "Plan for contradictory evidence; do not collect only evidence that supports the allegation.",
        ],
      },
      {
        title: "Plan interview order based on the case — not a rigid rule",
        bullets: [
          "Often it makes sense to review objective evidence and interview the reporter/key witnesses before the subject so you can ask focused questions.",
          "But the subject does not always have to be last. An early subject interview may be necessary for safety, containment, preservation, identifying evidence, or resolving a simple factual issue.",
          "Do not delay an urgent interview merely to preserve an artificial sequence.",
        ],
        tip: "A good sequence is the one that protects evidence, avoids witness contamination, and gives you the facts needed for the next interview.",
      },
      {
        title: "Set a working timeline",
        bullets: [
          "Many compliance programs set an internal target to begin an investigation within a few business days of receiving a report — see Regulatory Deadlines for a worked example and why it's an internal target, not a legal deadline.",
          "Use internal target dates for evidence collection, interviews, analysis, report, and corrective action, but do not confuse those targets with legal deadlines.",
          "If a case takes longer than planned, document why and whether interim safeguards remain necessary.",
        ],
      },
    ],
  },
  {
    id: "evidence",
    title: "Phase 3: Collect & Validate Evidence",
    icon: BookOpen,
    timeframe: "Day 1 onward",
    tldr: "Build the case from reliable sources. Preserve provenance and distinguish what a record proves from what you infer from it.",
    steps: [
      {
        title: "Start with objective evidence when available",
        bullets: [
          "Use original records and system-generated data where possible rather than screenshots or summaries alone.",
          "Keep source context: filename/system, date/time, author/user, relevant page or line, and how the item was obtained.",
          "For electronic evidence, preserve metadata/version history when it matters to authenticity or timing.",
        ],
      },
      {
        title: "Read the actual governing rule",
        bullets: [
          "Verify the current regulation/statute, facility policy, payer rule, contract, BAA, accreditation requirement, or professional standard that applies.",
          "Check scope and definitions before citing a deadline or violation; hospital, nursing-home, Part 2, HIPAA, Medicare, Medicaid, state, and professional-reporting rules are not interchangeable.",
        ],
      },
      {
        title: "Test alternative explanations",
        bullets: [
          "Ask what the same evidence would look like if the allegation were false, accidental, authorized, systemic rather than individual, or caused by a different person/process.",
          "Actively look for evidence against your working theory, not just confirming evidence.",
        ],
      },
      {
        title: "Expand scope only when evidence justifies it",
        bullets: [
          "One suspicious chart access may justify checking additional accesses; one coding error may justify a broader sample; one medication discrepancy may justify a pattern review.",
          "Document why you expanded the scope and what population/time period you reviewed.",
          "Do not turn every isolated mistake into a fishing expedition without a defensible reason.",
        ],
      },
    ],
  },
  {
    id: "interviews",
    title: "Phase 4: Interviews",
    icon: Users,
    timeframe: "As soon as useful evidence is available",
    tldr: "Use interviews to fill factual gaps, test explanations, and resolve contradictions — not to replace records that should exist.",
    steps: [
      {
        title: "Prepare for each person separately",
        bullets: [
          "Identify what this person can actually know first-hand and what you need to learn from them.",
          "Start open-ended, then narrow to dates, actions, reasons, records, and contradictions.",
          "Know which documents/logs you may need to show and what follow-up evidence their answer could create.",
        ],
      },
      {
        title: "Give appropriate interview instructions",
        bullets: [
          "Explain the purpose at a level that allows a fair interview without unnecessarily revealing confidential information.",
          "State truthfulness/cooperation and anti-retaliation expectations consistent with policy.",
          "Do not promise absolute confidentiality and do not give an instruction that unlawfully restricts protected reporting or consultation rights.",
          "If Legal directs an Upjohn-type warning, use the approved script rather than improvising it.",
          "You can ask a non-essential person present (e.g. a union representative not needed for that portion) to step out if their presence threatens the integrity of the interview or would require disclosing PHI/confidential business information beyond what's necessary.",
        ],
      },
      {
        title: "Resolve contradictions directly",
        bullets: [
          "When accounts conflict, identify the exact disputed fact instead of calling one witness 'credible' in the abstract.",
          "Look for contemporaneous records, independent witnesses, consistency over time, motive/bias, first-hand knowledge, and objective corroboration.",
          "Give the subject a meaningful opportunity to address material evidence and allegations before a final adverse finding when appropriate to the process.",
        ],
      },
      {
        title: "Write factual interview notes",
        bullets: [
          "Document who participated, date/time, method/location, key questions and answers, documents shown, and follow-up items.",
          "Use neutral attribution: 'Employee stated...' rather than editorial conclusions such as 'Employee lied' unless that conclusion is later supported and separately analyzed.",
          "Avoid presenting paraphrases as verbatim quotations.",
        ],
      },
    ],
  },
  {
    id: "analysis",
    title: "Phase 5: Analyze & Make Findings",
    icon: Scale,
    timeframe: "When material evidence is substantially complete",
    tldr: "Decide each allegation using the governing standard, evidence for and against it, and clearly identified uncertainty.",
    steps: [
      {
        title: "Use the organization's actual finding standard",
        bullets: [
          "Do not assume 'preponderance of the evidence' is always the required standard; use the policy, contractual, regulatory, or legal standard that actually governs the investigation.",
          "If no standard is supplied, document the evidentiary basis and avoid overstating certainty.",
        ],
      },
      {
        title: "Separate evidence from reasoning",
        bullets: [
          "Evidence is what the records/witnesses actually show. Reasoning is the conclusion drawn from those facts.",
          "Example: Evidence — audit log shows six chart openings and the employee was assigned elsewhere. Reasoning — the documented accesses lack an apparent work-related purpose. Final finding still considers the employee's explanation and applicable access rules.",
          "Do not turn an inference into a fake quote, audit result, or source fact.",
        ],
      },
      {
        title: "Analyze every allegation independently",
        bullets: [
          "Identify supporting evidence, contradicting evidence, missing evidence, and alternative explanations.",
          "State whether the evidence supports the alleged conduct and separately whether that conduct violates the applicable law/policy.",
          "Use 'needs more information' when the material evidence is genuinely incomplete rather than forcing a yes/no answer.",
        ],
      },
      {
        title: "Separate compliance risk from corrective action",
        bullets: [
          "Risk level, patient harm, number of events, or regulatory exposure do not mechanically determine employee discipline.",
          "Corrective-action analysis may require intent, role expectations, prior training/history, policy language, precedent, CBA/union rights, cooperation, concealment, personal benefit, patient safety, and HR/Legal review.",
          "System fixes and individual accountability can both be appropriate; one does not exclude the other.",
        ],
      },
    ],
  },
  {
    id: "reporting",
    title: "Phase 6: Report, Escalate & Correct",
    icon: FileText,
    timeframe: "Promptly after findings / earlier if a reporting clock requires it",
    tldr: "Write a defensible record of what was investigated, what the evidence showed, what remains uncertain, and what must happen next.",
    steps: [
      {
        title: "Use a clear report structure",
        bullets: [
          "Nature of the problem and how the matter was received.",
          "A list of all known facts, plus the investigative steps and evidence reviewed.",
          "Findings by allegation, including material contradictory evidence, limitations, and — where warranted for corrective action — the person(s) or process(es) that contributed, and whether that contribution looks deliberate, reckless, or merely an isolated error.",
          "Applicable policies/regulations and analysis.",
          "Corrective actions, process fixes, reporting obligations, and unresolved items; if an overpayment may be involved, loop in Finance for an estimate of scope before you finalize the number.",
        ],
      },
      {
        title: "Distribute on a need-to-know basis",
        bullets: [
          "Do not use a universal 'always send to CCO + Legal + HR + leadership' list. Distribution should match the issue, governance structure, privilege strategy, and decision authority.",
          "Limit sensitive investigation material to people who need it for oversight, legal advice, corrective action, quality/credentialing, reporting, or decision-making.",
          "Do not label the final report 'privileged' unless counsel has determined privilege applies.",
        ],
      },
      {
        title: "Handle external reporting separately from the internal report",
        bullets: [
          "Determine what must be reported, to whom, by when, and in what form. The deadline may arise before the internal report is complete.",
          "Examples can include HHS/OCR, NYSDOH/NYPORTS, CMS/State Survey Agency, NYS Office of the Medicaid Inspector General (OMIG), NYS Attorney General, NYS Office of Mental Health, NYS Education Department, NYS Office of Professional Medical Conduct, DEA, DOJ, law enforcement, managed care organizations/private payers, or self-disclosure channels depending on the case.",
          "Verify the source rule each time; do not rely on remembered timing for high-stakes filings.",
        ],
      },
      {
        title: "Build corrective action that can be tested",
        bullets: [
          "Immediate containment: stop ongoing harm/exposure and protect patients/evidence.",
          "Root-cause correction: fix the policy, workflow, training, access control, staffing, documentation, billing, or supervision issue that allowed the problem.",
          "Individual action: use the organization's actual HR/Medical Staff/discipline process and precedent.",
          "Assign an owner, due date, evidence of completion, and a retest date.",
        ],
      },
    ],
  },
  {
    id: "followup",
    title: "Phase 7: Close, Retest & Monitor",
    icon: Shield,
    timeframe: "After immediate response through sustained-compliance review",
    tldr: "An investigation is not really closed until required actions are completed and you know the fix worked.",
    steps: [
      {
        title: "Close the investigative record deliberately",
        bullets: [
          "Record the final status of each allegation, outstanding reporting, corrective-action owners, and any follow-up monitoring.",
          "Retain the record according to the applicable investigation, legal, compliance, medical-staff, quality, privacy, or records-retention policy — a common internal baseline is a minimum 10-year retention period, see Regulatory Deadlines.",
          "Reporter/subject communications should follow policy and confidentiality limits; do not disclose personnel details merely because a reporter asks for the outcome.",
          "Feed a summary of the report and outcome into your organization's periodic Compliance Committee / Board of Trustees reporting cadence, not just this one case file.",
        ],
      },
      {
        title: "TEST → FIND → FIX → RETEST",
        bullets: [
          "TEST: identify the control failure or condition that should not recur.",
          "FIND: document the root cause and scope supported by evidence.",
          "FIX: implement the corrective action.",
          "RETEST: use data/audits/observations to verify the fix actually works and remains effective.",
        ],
      },
      {
        title: "Monitor retaliation and recurrence",
        bullets: [
          "Where retaliation risk exists, use proportionate follow-up with the reporter/witnesses and review objective employment/action data as appropriate.",
          "Trend similar allegations, audit findings, privacy incidents, adverse events, billing issues, and corrective-action failures for systemic patterns.",
        ],
      },
      {
        title: "Escalate lessons learned",
        bullets: [
          "Report trends and material matters through the organization's established Compliance, Quality, Privacy, Medical Staff, Risk, Audit, executive, or board governance structure.",
          "Self-disclosure or government reporting should be a fact- and program-specific decision, usually coordinated with Legal/Compliance; do not assume disclosure always reduces penalties or is always required.",
        ],
      },
    ],
  },
];

export default function InvestigationGuide() {
  const [expandedPhase, setExpandedPhase] = useState<string | null>("intake");
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const toggleStep = (key: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Scale className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Investigation Guide</h2>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-prose -mt-3">
        A practical hospital/compliance investigation sequence. Use the phases as a framework, not a rigid script; urgent safety, preservation, and reporting duties can change the order.
      </p>

      <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 max-w-prose">
        <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
        <p className="text-sm text-foreground leading-relaxed">
          <strong>Important:</strong> no single workflow fits every privacy, billing, patient-safety, employment, medical-staff, or criminal matter. Follow the applicable law/policy and involve the right function when the facts require it.
        </p>
      </div>

      <div className="space-y-2">
        {PHASES.map((phase, phaseIdx) => {
          const isOpen = expandedPhase === phase.id;
          const Icon = phase.icon;
          return (
            <div key={phase.id} className={cn("rounded-lg border border-border overflow-hidden transition-shadow", isOpen && "shadow-sm")}>
              <button
                onClick={() => setExpandedPhase(isOpen ? null : phase.id)}
                className="w-full flex items-center gap-3 p-3.5 hover:bg-secondary/20 transition-colors text-left border-l-[3px] border-l-transparent"
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", isOpen ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground">{phaseIdx + 1}. {phase.title}</h3>
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold tracking-wide bg-secondary text-muted-foreground">{phase.timeframe}</span>
                  </div>
                  {!isOpen && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{phase.tldr}</p>}
                </div>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
              </button>

              {isOpen && (
                <div className="border-t border-border">
                  <div className="px-4 py-3 bg-primary/5 border-b border-border/50">
                    <p className="text-sm text-foreground font-medium leading-relaxed max-w-prose">{phase.tldr}</p>
                  </div>
                  <div className="divide-y divide-border/50">
                    {phase.steps.map((step, i) => {
                      const stepKey = `${phase.id}-${i}`;
                      const stepOpen = expandedSteps.has(stepKey);
                      return (
                        <div key={i}>
                          <button
                            type="button"
                            onClick={() => toggleStep(stepKey)}
                            className="w-full flex items-start gap-2.5 px-4 py-3 text-left hover:bg-secondary/20 transition-colors"
                          >
                            <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                            </div>
                            <p className="flex-1 min-w-0 text-sm font-semibold text-foreground">{step.title}</p>
                            <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5 transition-transform duration-200", stepOpen && "rotate-180")} />
                          </button>
                          {stepOpen && (
                            <div className="flex items-start gap-2.5 px-4 pb-4">
                              <div className="w-5 shrink-0" />
                              <div className="flex-1 min-w-0 max-w-prose">
                                <ul className="space-y-2">
                                  {step.bullets.map((bullet, j) => (
                                    <li key={j} className="flex items-start gap-2 text-sm text-foreground/90 leading-relaxed">
                                      <span className="text-muted-foreground mt-0.5 shrink-0">•</span>
                                      <span>{bullet}</span>
                                    </li>
                                  ))}
                                </ul>
                                {step.tip && (
                                  <div className="flex items-start gap-2 mt-3 px-3 py-2.5 bg-warning/10 border border-warning/30 rounded-md">
                                    <Lightbulb className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                                    <p className="text-sm text-foreground leading-relaxed">{step.tip}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
