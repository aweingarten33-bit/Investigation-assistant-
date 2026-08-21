import { useState } from "react";
import { ChevronDown, Scale, Shield, FileText, Users, Phone, BookOpen, Lightbulb, type LucideIcon } from "lucide-react";
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
  color: string;
  accent: string;
  timeframe: string;
  tldr: string;
  steps: Step[];
}

const PHASES: Phase[] = [
  {
    id: "intake",
    title: "Phase 1: Intake",
    icon: Phone,
    color: "text-blue-600",
    accent: "border-l-blue-500",
    timeframe: "Day 0–1",
    tldr: "A complaint came in. Log it, assess it, and decide if it needs a formal investigation.",
    steps: [
      {
        title: "Log the complaint — TODAY",
        bullets: [
          "Write down exactly what was reported, by whom, when, and how (hotline, email, walk-in, etc.)",
          "Don't editorialize — capture it word for word",
          "Even a hallway conversation counts as receiving a complaint",
        ],
      },
      {
        title: "Does this need a formal investigation?",
        bullets: [
          "YES if it involves: PHI/privacy exposure, patient harm, fraud, abuse, or regulatory non-compliance",
          "NO if it's purely a performance or interpersonal issue with no compliance angle → send to HR",
          "When in doubt → investigate. Better to find nothing than to miss something real.",
        ],
      },
      {
        title: "How urgent is this?",
        bullets: [
          "🔴 HIGH (same-day action): active HIPAA breach, patient safety, fraud, government payer issues",
          "🟡 MEDIUM (start within 48 hours): policy violations, non-urgent complaints",
          "Is it a single incident or a pattern? Does it involve a large volume of records?",
        ],
      },
      {
        title: "Check for conflicts of interest",
        bullets: [
          "The investigator can NOT be: the subject, in the subject's chain of command, or personally connected to them",
          "If you have a conflict → escalate to your supervisor, compliance committee, or legal",
        ],
        tip: "Use the Conflict of Interest toolkit (next section) to work through types, red flags, and how to handle it if you find one.",
      },
      {
        title: "Issue a document preservation hold",
        bullets: [
          "Tell relevant departments to preserve ALL documents, emails, records, and EHR audit trails related to this",
          "Send it in writing. Keep a copy. Follow up to confirm they got it.",
          "Destroying evidence — even accidentally — turns a manageable problem into a catastrophe",
        ],
      },
      {
        title: "Do you need legal counsel?",
        bullets: [
          "YES if: possible government investigation, whistleblower lawsuit, significant financial exposure, or criminal liability",
          "Attorney-client privilege only works if counsel is directing the investigation",
        ],
      },
    ],
  },
  {
    id: "planning",
    title: "Phase 2: Plan",
    icon: FileText,
    color: "text-indigo-600",
    accent: "border-l-indigo-500",
    timeframe: "Day 1–3",
    tldr: "Before you talk to anyone, make a plan. Winging it = missed evidence and conclusions that don't hold up.",
    steps: [
      {
        title: "Write a 1–2 page investigation plan",
        bullets: [
          "What are the specific allegations?",
          "What laws/regulations/policies could be violated?",
          "What evidence do you need?",
          "Who do you need to interview?",
          "What's your timeline?",
        ],
        tip: "Not sure what you're dealing with yet? Run the facts through AI Case Analysis for a quick preliminary read on regulations and risk while you build this plan.",
      },
      {
        title: "List all the evidence you need",
        bullets: [
          "Think broadly: EHR access logs, emails, texts, badge logs, training records, BAAs, surveillance",
          "Write down who controls each piece of evidence",
        ],
      },
      {
        title: "Build your witness list",
        bullets: [
          "Start with the complainant → then witnesses → then the subject LAST",
          "Interview the subject last so you have facts to work with",
          "Ask: Who was there? Who supervises the area? Who would've seen the records?",
        ],
        tip: "Always interview the subject LAST. You want all the facts before you sit down with them.",
      },
      {
        title: "Create a key allegations worksheet",
        bullets: [
          "For each allegation, write: the specific claim, the relevant law/policy, what proves it, what disproves it, and who has knowledge",
          "This worksheet guides your entire investigation",
        ],
      },
      {
        title: "Set up your investigation file",
        bullets: [
          "Sections: Complaint → Plan → Evidence → Interviews → Analysis → Final Report",
          "Everything goes in this file. Physical or digital — just keep it organized and secure.",
        ],
      },
    ],
  },
  {
    id: "evidence",
    title: "Phase 3: Collect Evidence",
    icon: BookOpen,
    color: "text-emerald-600",
    accent: "border-l-emerald-500",
    timeframe: "Day 2–14",
    tldr: "Get the evidence BEFORE you interview anyone. You want facts in hand before asking questions.",
    steps: [
      {
        title: "Pull all documents first",
        bullets: [
          "EHR audit trails, policies, emails, training records, access logs — everything relevant",
          "Note inconsistencies, gaps, or red flags",
          "Build a timeline of events from the documents",
          "Date-stamp everything: when you received it and from whom",
        ],
      },
      {
        title: "Read the actual rules",
        bullets: [
          "Before you can say something violated a rule, you need to know what the rule says",
          "Pull the relevant policies, 45 CFR sections, state laws, and guidance documents",
        ],
      },
      {
        title: "Check for prior issues",
        bullets: [
          "Search for previous complaints, investigations, audits, or corrective actions involving the same person/department/issue",
          "A single incident might be a mistake. A pattern is a systemic problem.",
        ],
      },
      {
        title: "Secure electronic evidence",
        bullets: [
          "Work with IT to preserve emails and system access logs",
          "Screenshot or export anything that could be modified or deleted",
          "For HIPAA investigations, the EHR audit trail is the single most important piece of evidence",
        ],
      },
      {
        title: "Build a detailed timeline",
        bullets: [
          "Dates, times, people involved, what happened — in chronological order",
          "This timeline is the backbone of your investigation and makes your final report way easier to write",
        ],
      },
    ],
  },
  {
    id: "interviews",
    title: "Phase 4: Interviews",
    icon: Users,
    color: "text-amber-600",
    accent: "border-l-amber-500",
    timeframe: "Day 5–21",
    tldr: "Interviews win or lose investigations. Prepare for each one. Never go in without a plan.",
    steps: [
      {
        title: "Prepare for EACH interview separately",
        bullets: [
          "Write out specific questions (open-ended first, then specific)",
          "Know what documents you want to show them",
          "Know what you need to learn from THIS person specifically",
          "Know what facts you want to verify",
        ],
        tip: "The Interview Templates section has copy-ready scripts for witness, subject, Upjohn, and HIPAA-specific interviews — start from those instead of a blank page.",
      },
      {
        title: "Upjohn Warning (if legal counsel is directing)",
        bullets: [
          "You represent the organization, NOT the employee",
          "The privilege belongs to the organization and can be waived",
          "The employee must keep the interview confidential",
          "READ THIS FROM A SCRIPT — don't wing it",
          "Document that you gave it: date, time, that they acknowledged understanding",
        ],
      },
      {
        title: "Interview structure: Opening → Questions → Closing",
        bullets: [
          "OPENING: Explain the purpose (general terms), expect honest answers, no retaliation, keep it confidential",
          "QUESTIONS: Start broad ('Walk me through what happened…') → narrow down ('You mentioned X…') → save tough questions for last",
          "CLOSING: Summarize what they said, let them correct you, remind about confidentiality, say you may follow up",
        ],
      },
      {
        title: "Always ask these 5 questions at the end",
        bullets: [
          "'Is there anyone else I should talk to?'",
          "'Are there any documents I should look at?'",
          "'Has this happened before?'",
          "'Is there anything else I should know?'",
          "'Any concerns about retaliation?'",
        ],
        tip: "These catch things you didn't think to ask about.",
      },
      {
        title: "Write up notes IMMEDIATELY after",
        bullets: [
          "Do it within an hour — don't rely on memory",
          "Include: date, time, location, who was present, key statements (close to verbatim), your observations",
          "Notes should be FACTUAL: 'Employee stated she was never trained' NOT 'Employee was clearly lying about training'",
        ],
      },
    ],
  },
  {
    id: "analysis",
    title: "Phase 5: Make the Call",
    icon: Scale,
    color: "text-purple-600",
    accent: "border-l-purple-500",
    timeframe: "Day 14–30",
    tldr: "You have all the evidence. Now decide: did it happen, and was it a violation?",
    steps: [
      {
        title: "Organize evidence by allegation",
        bullets: [
          "For each allegation: separate evidence FOR from evidence AGAINST",
          "Lay out: documents, interview summaries, timeline, relevant rules",
        ],
      },
      {
        title: "Pick your finding",
        bullets: [
          "SUBSTANTIATED: More likely than not it happened",
          "UNSUBSTANTIATED: Can't prove it (doesn't mean it didn't happen)",
          "NEEDS MORE INFO: Notes/evidence are too sparse to call it either way",
        ],
        tip: "Not sure what to recommend? Paste your findings into AI Recommendation above and it will tell you — or use the Decision Framework to walk through it yourself, step by step.",
      },
      {
        title: "If substantiated — was a rule actually broken?",
        bullets: [
          "What's the specific law, regulation, or policy?",
          "Did the conduct violate it?",
          "Was there a valid exception (e.g., HIPAA treatment/payment/operations purpose)?",
          "Was the person trained on the requirement?",
          "Individual failure or systemic problem?",
        ],
      },
      {
        title: "How bad was it?",
        bullets: [
          "INTENT: Honest mistake → negligent → reckless → intentional",
          "SCOPE: One incident or widespread pattern?",
          "HARM: Patients affected? Records exposed? Government program impact?",
          "DURATION: One-time or ongoing?",
        ],
      },
      {
        title: "Sanity check before you finalize",
        bullets: [
          "Did you review ALL relevant evidence?",
          "Did you consider evidence both for AND against?",
          "Did the subject get a chance to respond?",
          "Is your conclusion supported by evidence, not assumptions?",
          "Did you consider alternative explanations?",
          "Did you consult legal if needed?",
        ],
      },
    ],
  },
  {
    id: "reporting",
    title: "Phase 6: Write the Report",
    icon: FileText,
    color: "text-rose-600",
    accent: "border-l-rose-500",
    timeframe: "Day 21–35",
    tldr: "Write it so that someone reading it 3 years from now understands exactly what happened.",
    steps: [
      {
        title: "Report structure (follow this order)",
        bullets: [
          "1. INTRODUCTION — Who reported, when, how",
          "2. INCIDENT OVERVIEW — What the notes say, summarized",
          "3. INCIDENT DETAILS — Investigation steps and evidence, explicitly from the notes",
          "4. INVESTIGATION FINDINGS — What was determined",
          "5. RECOMMENDATIONS — The determination and recommended action",
          "6. CONCLUSION — Summary of decision and risk level",
        ],
        tip: "Paste your investigation notes into the Report Generator on the home page — it drafts this structure automatically.",
      },
      {
        title: "Writing rules",
        bullets: [
          "Write in third person ('The Compliance and Privacy Department found…' not 'I found…')",
          "Be specific ('7 accesses on March 15' not 'multiple accesses')",
          "No loaded language ('stated' not 'admitted' or 'claimed')",
          "Every conclusion needs evidence backing it up",
          "Note limitations ('Unable to interview Employee C who separated from employment')",
        ],
      },
      {
        title: "Who gets the report?",
        bullets: [
          "ALWAYS: CCO, Legal Counsel, person who assigned the investigation",
          "IF SUBSTANTIATED: + department leadership, HR, Compliance Committee, possibly Board",
          "EXTERNAL (if required): OCR, State AG, CMS, accreditor, law enforcement",
          "Mark it CONFIDENTIAL and PRIVILEGED (if applicable). Keep a distribution log.",
        ],
        tip: "Check Regulatory Deadlines for exact filing windows (HIPAA's 60-day clock, self-disclosure), then use the AI Letter Generator to draft the subject, reporter, and any regulatory notifications.",
      },
      {
        title: "Create the corrective action plan",
        bullets: [
          "IMMEDIATE: Stop the harm now (suspend access, contain the breach)",
          "SHORT-TERM: Fix it (retrain, revise processes, discipline)",
          "LONG-TERM: Prevent it from happening again (policy changes, system changes, monitoring)",
          "Each action needs: responsible person + deadline + follow-up date",
        ],
      },
      {
        title: "Close the investigation",
        bullets: [
          "Update the case status",
          "Store all evidence per retention policy",
          "Notify complainant: 'The matter was investigated and appropriate action was taken' — no details",
        ],
      },
    ],
  },
  {
    id: "post",
    title: "Phase 7: Follow-Up",
    icon: Shield,
    color: "text-teal-600",
    accent: "border-l-teal-500",
    timeframe: "Day 30–90+",
    tldr: "The investigation isn't done when the report is done. Follow up or the problem comes back.",
    steps: [
      {
        title: "Track corrective actions to completion",
        bullets: [
          "Don't just check it was done — verify it was done effectively",
          "If the fix was retraining, did they pass the assessment?",
          "If the fix was a policy revision, was it actually distributed?",
        ],
      },
      {
        title: "Watch for retaliation",
        bullets: [
          "Follow up with the complainant and witnesses periodically",
          "Watch for subtle retaliation: schedule changes, exclusion from meetings, changed responsibilities",
          "Document your anti-retaliation follow-up",
        ],
        tip: "Retaliation can turn a successful investigation into a major liability. Take it seriously.",
      },
      {
        title: "Lessons learned",
        bullets: [
          "Were your policies adequate?",
          "Did training cover this?",
          "Did your monitoring catch it, or was it externally reported?",
          "Use these insights to improve your compliance program",
        ],
      },
      {
        title: "Report to leadership",
        bullets: [
          "Include investigation outcomes in regular compliance reporting",
          "Board and Compliance Committee need trends: how many, what types, corrective actions, recurring themes",
        ],
      },
      {
        title: "Consider self-disclosure (for government program issues)",
        bullets: [
          "Self-disclosure = significantly reduced penalties vs. a regulator finding it themselves",
          "This MUST involve legal counsel — don't do this alone",
        ],
      },
    ],
  },
];

export default function InvestigationGuide() {
  const [expandedPhase, setExpandedPhase] = useState<string | null>("intake");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Scale className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Investigation Guide</h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-3">
        7 phases. Follow them in order. Each step tells you exactly what to do.
      </p>

      <div className="space-y-2">
        {PHASES.map((phase, phaseIdx) => {
          const isOpen = expandedPhase === phase.id;
          return (
            <div key={phase.id} className={cn(
              "rounded-lg border border-border overflow-hidden transition-shadow",
              isOpen && "shadow-sm"
            )}>
              <button
                onClick={() => setExpandedPhase(isOpen ? null : phase.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3.5 hover:bg-secondary/20 transition-colors text-left border-l-[3px]",
                  isOpen ? phase.accent : "border-l-transparent"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold",
                  isOpen ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                )}>
                  {phaseIdx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{phase.title}</h3>
                    <span className={cn(
                      "text-[9px] px-2 py-0.5 rounded-full font-semibold tracking-wide",
                      isOpen ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                    )}>{phase.timeframe}</span>
                  </div>
                  {!isOpen && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{phase.tldr}</p>}
                </div>
                <ChevronDown className={cn(
                  "w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200",
                  !isOpen && "-rotate-90"
                )} />
              </button>

              {isOpen && (
                <div className="border-t border-border">
                  <div className="px-4 py-2.5 bg-primary/5 border-b border-border/50">
                    <p className="text-xs text-foreground font-medium">{phase.tldr}</p>
                  </div>

                  <div className="divide-y divide-border/50">
                    {phase.steps.map((step, i) => (
                      <div key={i} className="px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground mb-1.5">{step.title}</p>
                            <ul className="space-y-1">
                              {step.bullets.map((bullet, j) => (
                                <li key={j} className="flex items-start gap-2 text-xs text-foreground/80">
                                  <span className="text-muted-foreground mt-0.5 shrink-0">•</span>
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ul>
                            {step.tip && (
                              <div className="flex items-start gap-2 mt-2 px-3 py-2 bg-warning/10 border border-warning/30 rounded-md">
                                <Lightbulb className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                                <p className="text-[11px] text-foreground/90">{step.tip}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
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
