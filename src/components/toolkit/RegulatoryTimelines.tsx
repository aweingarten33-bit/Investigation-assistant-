import { useState } from "react";
import { Clock, AlertTriangle, ChevronDown, Scale, Shield, FileText, Gavel, Timer, Ban, Lightbulb, ExternalLink, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_REF = [
  { deadline: "2 HOURS", what: "Immediate jeopardy → State survey agency", color: "bg-red-600" },
  { deadline: "24–72 HRS", what: "State adverse event reporting (varies by state)", color: "bg-red-500" },
  { deadline: "60 DAYS", what: "HIPAA breach → notify individuals + HHS (if 500+)", color: "bg-red-500" },
  { deadline: "60 DAYS", what: "Return identified Medicare/Medicaid overpayments", color: "bg-orange-500" },
  { deadline: "30–45 DAYS", what: "Complete routine investigation (best practice)", color: "bg-amber-500" },
  { deadline: "45 DAYS", what: "Joint Commission RCA due (sentinel events)", color: "bg-amber-500" },
  { deadline: "ASAP", what: "OCR/OIG self-disclosure (no hard deadline, but sooner = better outcome)", color: "bg-blue-500" },
];

interface Deadline {
  timeframe: string;
  title: string;
  whatToDo: string[];
  ifYouMiss: string;
  source: string;
}

interface TimelineSection {
  id: string;
  title: string;
  icon: LucideIcon;
  color: string;
  accent: string;
  deadlines: Deadline[];
}

const TIMELINE_SECTIONS: TimelineSection[] = [
  {
    id: "internal",
    title: "Internal Investigation Deadlines",
    icon: Clock,
    color: "text-blue-600",
    accent: "border-l-blue-500",
    deadlines: [
      {
        timeframe: "Day 0 (Immediately)",
        title: "Log the complaint",
        whatToDo: [
          "Document the complaint in your tracking system — same day",
          "Acknowledge receipt to the reporter (if not anonymous) within 24 hours",
          "Issue a document preservation hold immediately",
        ],
        ifYouMiss: "Regulators examine response speed when evaluating your compliance program. Delayed response is an aggravating factor in settlements.",
        source: "OIG General Compliance Program Guidance (2023), Element 7",
      },
      {
        timeframe: "Within 48 Hours",
        title: "Assess and assign",
        whatToDo: [
          "Decide if this needs a formal investigation",
          "Set priority level (high/medium/low)",
          "Check for conflicts of interest",
          "Decide if legal counsel is needed",
          "Assign an investigator",
          "HIGH-RISK matters (PHI exposure, patient safety) → start within 24 hours",
        ],
        ifYouMiss: "Every day of delay = ongoing exposure, destroyed evidence, and coordinated stories.",
        source: "HCCA Compliance Essentials; OIG GCPG",
      },
      {
        timeframe: "30–45 Days",
        title: "Complete the investigation",
        whatToDo: [
          "Routine matters: 30 days",
          "Complex matters: 45–60 days",
          "Highly complex (multi-department, large-scale exposure): up to 90 days",
          "If going past 90 days → document WHY and put interim protections in place",
          "Target: preliminary findings by day 14, interviews done by day 30, report by day 45",
        ],
        ifYouMiss: "Extended investigations without documented justification read as an ineffective compliance program to regulators.",
        source: "HCCA Compliance Essentials; OIG GCPG",
      },
      {
        timeframe: "Ongoing",
        title: "Interim protective measures",
        whatToDo: [
          "🔴 Active patient harm → corrective action SAME DAY",
          "🔴 Active HIPAA breach → contain it, stop unauthorized access, revoke access if needed",
          "🟡 Employee safety risk → consider admin leave or reassignment",
          "Don't wait for the report to act on known harm",
        ],
        ifYouMiss: "Additional violations, increased exposure, and potential liability for harm you knew about and didn't stop.",
        source: "OIG GCPG (2023); CMS Conditions of Participation",
      },
    ],
  },
  {
    id: "hipaa",
    title: "HIPAA Breach Deadlines",
    icon: Shield,
    color: "text-rose-600",
    accent: "border-l-rose-500",
    deadlines: [
      {
        timeframe: "60 Calendar Days",
        title: "Notify affected individuals",
        whatToDo: [
          "Clock starts when breach is DISCOVERED (not when investigation is complete)",
          "'Discovered' = when anyone in the org knew or should have known",
          "Send written notification by first-class mail",
          "Include: what happened, what info was involved, what they should do, what you're doing, contact info",
          "500+ people affected → also notify 'prominent media outlets' in the state",
        ],
        ifYouMiss: "Penalties range $100–$50,000 per violation; willful neglect is $50,000 per violation with an annual cap around $2M. Late notification is treated as an aggravating factor in settlements.",
        source: "45 CFR §164.404; HITECH Act §13402",
      },
      {
        timeframe: "60 Calendar Days",
        title: "Notify HHS/OCR (if 500+ people)",
        whatToDo: [
          "Report via HHS Breach Portal: ocrportal.hhs.gov",
          "Concurrent with individual notification",
          "This goes on the public breach portal — searchable by anyone",
        ],
        ifYouMiss: "Multi-million dollar settlements have followed large breaches with delayed or incomplete notification.",
        source: "45 CFR §164.408",
      },
      {
        timeframe: "60 Days After Year-End",
        title: "Notify HHS/OCR (if under 500 people)",
        whatToDo: [
          "Small breaches can be batched annually",
          "Due 60 days after Dec 31 of the year the breach was discovered",
          "Individual notification is still due within 60 days of discovery — this is just the HHS report",
        ],
        ifYouMiss: "OCR tracks patterns. Multiple small breaches invite a compliance review.",
        source: "45 CFR §164.408(c)",
      },
      {
        timeframe: "60 Calendar Days",
        title: "Business Associate → Covered Entity notification",
        whatToDo: [
          "Your BAA probably says faster (24–72 hours) — check it",
          "BA must include: affected individuals (if known) + info the CE needs",
          "The CE's clock starts when the BA discovers it — not when the BA tells you",
        ],
        ifYouMiss: "The CE's responsibility doesn't wait for the BA. If your BA knew, your clock started.",
        source: "45 CFR §164.410",
      },
    ],
  },
  {
    id: "overpayment",
    title: "Overpayment / False Claims Act",
    icon: Gavel,
    color: "text-purple-600",
    accent: "border-l-purple-500",
    deadlines: [
      {
        timeframe: "60 Calendar Days",
        title: "Report and return identified overpayments",
        whatToDo: [
          "Once you've identified an overpayment from Medicare/Medicaid → 60 days to report AND return it",
          "'Identified' = you know or should know through reasonable diligence",
          "You get up to 6 months to investigate and quantify → then the 60-day clock starts",
          "Total max: ~8 months from first notice of potential overpayment",
        ],
        ifYouMiss: "Becomes a 'reverse false claim.' Penalties include treble damages plus per-claim penalties and possible exclusion.",
        source: "42 USC §1320a-7k(d); False Claims Act 31 USC §3729",
      },
      {
        timeframe: "6 Years",
        title: "Lookback period",
        whatToDo: [
          "If you find a billing problem, you must look back 6 years for the same issue",
          "Only obligated to return 6 years' worth — but fix the underlying problem regardless",
        ],
        ifYouMiss: "The 6-year lookback can mean a large repayment obligation. This is why initial audit scope matters.",
        source: "42 USC §1320a-7k(d)(3)",
      },
    ],
  },
  {
    id: "disclosure",
    title: "Regulatory Self-Disclosure",
    icon: FileText,
    color: "text-indigo-600",
    accent: "border-l-indigo-500",
    deadlines: [
      {
        timeframe: "ASAP After Discovery",
        title: "Submit self-disclosure",
        whatToDo: [
          "No exact deadline, but 'promptly' after completing your investigation",
          "Best practice: within 60–90 days of completing your investigation",
          "Must include: what happened, which programs/records, estimated scope, time period, corrective actions taken",
          "Earlier is always more favorable.",
        ],
        ifYouMiss: "Disclosing only after a regulator opens its own investigation results in far less favorable terms.",
        source: "OIG Provider Self-Disclosure Protocol",
      },
      {
        timeframe: "The Math",
        title: "Self-disclosure vs. getting caught",
        whatToDo: [
          "SELF-DISCLOSURE: Reduced settlement multiplier, may avoid exclusion",
          "REGULATOR DISCOVERS IT: Treble damages + per-claim penalties + possible exclusion + possible criminal referral",
          "Organizations that self-disclose promptly consistently get better outcomes.",
        ],
        ifYouMiss: "This is publicly stated regulator policy — the incentive to self-disclose is real and material.",
        source: "OIG Self-Disclosure Protocol; OIG Semi-Annual Reports",
      },
    ],
  },
  {
    id: "extensions",
    title: "When You Need More Time",
    icon: Timer,
    color: "text-amber-600",
    accent: "border-l-amber-500",
    deadlines: [
      {
        timeframe: "Know This",
        title: "Which deadlines are flexible vs. hard",
        whatToDo: [
          "🔴 NO EXTENSION: HIPAA breach (60 days), immediate jeopardy (2 hours)",
          "🟡 SOME FLEXIBILITY: Overpayment return (6 months to investigate + 60 days)",
          "🟢 FLEXIBLE: Self-disclosure (request extensions in writing, give a specific date)",
          "If law enforcement asks you to delay HIPAA notification → up to 30 days (document it meticulously)",
        ],
        ifYouMiss: "An on-time partial report shows good faith. A late complete report shows disregard for the law. When in doubt, file what you have and supplement later.",
        source: "45 CFR §164.412; 42 USC §1320a-7k(d); OIG Protocol",
      },
      {
        timeframe: "Overwhelmed?",
        title: "How to triage multiple deadlines",
        whatToDo: [
          "PRIORITY 1: HIPAA 60-day, overpayment 60-day, state mandatory reporting, immediate jeopardy 2-hour",
          "PRIORITY 2: Regulatory self-disclosure, accreditor reporting, state AG notification",
          "PRIORITY 3: Internal investigation targets, board reporting, corrective action implementation",
          "Never sacrifice a legal deadline to meet an internal one",
        ],
        ifYouMiss: "Knowing which deadlines are non-negotiable vs. flexible is what separates a defensible compliance program from one that ends up in a settlement.",
        source: "Practical compliance operations guidance; HCCA",
      },
    ],
  },
];

export default function RegulatoryTimelines() {
  const [expandedSection, setExpandedSection] = useState<string | null>("hipaa");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Timer className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Regulatory Deadlines</h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-3">When things are due and what happens if you miss them.</p>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">⚡ Quick Reference — Key Deadlines</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {QUICK_REF.map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 text-xs">
              <span className={cn("px-2 py-0.5 rounded text-white text-[10px] font-bold shrink-0 min-w-[72px] text-center", item.color)}>
                {item.deadline}
              </span>
              <span className="text-foreground/80">{item.what}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2.5 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-lg">
        <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/90">
          <strong>These are real legal deadlines.</strong> Federal deadlines (HIPAA, overpayments) generally have NO extensions. Always verify with legal counsel for your specific situation.
        </p>
      </div>

      {TIMELINE_SECTIONS.map((section) => {
        const isOpen = expandedSection === section.id;
        return (
          <div key={section.id} className={cn(
            "rounded-lg border border-border overflow-hidden transition-shadow",
            isOpen && "shadow-sm"
          )}>
            <button
              onClick={() => setExpandedSection(isOpen ? null : section.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3.5 hover:bg-secondary/20 transition-colors text-left border-l-[3px]",
                isOpen ? section.accent : "border-l-transparent"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                isOpen ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              )}>
                <section.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {section.deadlines.length} deadline{section.deadlines.length !== 1 ? "s" : ""}
                </p>
              </div>
              <ChevronDown className={cn(
                "w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200",
                !isOpen && "-rotate-90"
              )} />
            </button>

            {isOpen && (
              <div className="border-t border-border divide-y divide-border/50">
                {section.deadlines.map((d, i) => (
                  <div key={i} className="px-4 py-3.5">
                    <div className="flex items-start gap-2.5 mb-2">
                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wide whitespace-nowrap rounded shrink-0">
                        {d.timeframe}
                      </span>
                      <p className="text-sm font-semibold text-foreground">{d.title}</p>
                    </div>

                    <ul className="space-y-1 mb-3 ml-1">
                      {d.whatToDo.map((item, j) => (
                        <li key={j} className="flex items-start gap-2 text-xs text-foreground/80">
                          <span className="text-muted-foreground mt-0.5 shrink-0">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex items-start gap-2 px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-md mb-2">
                      <Ban className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
                      <p className="text-[11px] text-foreground/90"><strong>If you miss it:</strong> {d.ifYouMiss}</p>
                    </div>

                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <ExternalLink className="w-2.5 h-2.5" />
                      {d.source}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
