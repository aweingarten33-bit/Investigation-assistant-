import { useState } from "react";
import {
  Clock, AlertTriangle, ChevronDown, ExternalLink,
  Shield, Building2, FileWarning,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Deadline = {
  timeframe: string;
  title: string;
  scope: string;
  actions: string[];
  sourceLabel: string;
  sourceUrl: string;
  proposed?: boolean;
};

type Section = {
  id: string;
  title: string;
  description: string;
  icon: typeof Clock;
  deadlines: Deadline[];
};

const SECTIONS: Section[] = [
  {
    id: "hipaa",
    title: "HIPAA Breach Notification",
    description: "Federal HIPAA Breach Notification Rule timing. State law, contracts, Part 2, and other rules may add or shorten obligations.",
    icon: Shield,
    deadlines: [
      {
        timeframe: "Without unreasonable delay; no later than 60 calendar days",
        title: "Notify affected individuals",
        scope: "Covered entity — breach of unsecured PHI",
        actions: [
          "The clock runs from discovery of the breach; do not wait for the entire investigation to finish before tracking the deadline.",
          "Notice content and substitute-notice requirements are specified by the Breach Notification Rule.",
          "Document the breach analysis and why notification was or was not required.",
        ],
        sourceLabel: "HHS — Breach Notification Rule / 45 CFR §164.404",
        sourceUrl: "https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html",
      },
      {
        timeframe: "Without unreasonable delay; no later than 60 calendar days",
        title: "Notify HHS for breaches affecting 500 or more individuals",
        scope: "Covered entity — 500+ individuals",
        actions: [
          "Submit notice to the Secretary through the HHS breach reporting process.",
          "Media notice may also be required when more than 500 residents of a State or jurisdiction are affected.",
          "Do not treat 60 days as a waiting period; the rule says without unreasonable delay.",
        ],
        sourceLabel: "HHS — Notice to the Secretary / 45 CFR §164.408",
        sourceUrl: "https://www.hhs.gov/hipaa/for-professionals/breach-notification/breach-reporting/index.html",
      },
      {
        timeframe: "No later than 60 days after the end of the calendar year",
        title: "Notify HHS for breaches affecting fewer than 500 individuals",
        scope: "Covered entity — under 500 individuals",
        actions: [
          "Smaller breaches may be reported to the Secretary on an annual basis.",
          "This annual HHS timing does not extend the separate individual-notification deadline.",
        ],
        sourceLabel: "HHS — Notice to the Secretary / 45 CFR §164.408(c)",
        sourceUrl: "https://www.hhs.gov/hipaa/for-professionals/breach-notification/breach-reporting/index.html",
      },
      {
        timeframe: "Without unreasonable delay; no later than 60 calendar days",
        title: "Business associate notifies covered entity",
        scope: "Business associate — breach of unsecured PHI",
        actions: [
          "A business associate must notify the covered entity following discovery of a breach.",
          "A BAA may require a shorter contractual reporting window; check the actual agreement.",
          "Provide affected-individual information and other available notice information as required by §164.410.",
        ],
        sourceLabel: "HHS — Business Associate Notification / 45 CFR §164.410",
        sourceUrl: "https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html",
      },
    ],
  },
  {
    id: "ltc",
    title: "Long-Term Care Facility Reporting",
    description: "These 2-hour/24-hour rules are specific to Medicare/Medicaid LTC facility alleged-violation reporting under 42 CFR §483.12; they are not a universal hospital 'immediate jeopardy' clock.",
    icon: Building2,
    deadlines: [
      {
        timeframe: "Immediately, but no later than 2 hours",
        title: "LTC alleged abuse or event resulting in serious bodily injury",
        scope: "Long-term care facility — §483.12(c)(1)",
        actions: [
          "Report covered alleged violations to the facility administrator and required officials, including the State Survey Agency as applicable.",
          "The 2-hour timeframe applies when the alleged event involves abuse or results in serious bodily injury.",
          "Protect residents while the investigation is pending; do not delay initial reporting to first decide whether the allegation is credible.",
        ],
        sourceLabel: "CMS State Operations Manual Appendix PP — F609 / 42 CFR §483.12(c)",
        sourceUrl: "https://www.cms.gov/medicare/provider-enrollment-and-certification/guidanceforlawsandregulations/nursing-homes",
      },
      {
        timeframe: "No later than 24 hours",
        title: "Other covered LTC alleged violations without serious bodily injury",
        scope: "Long-term care facility — §483.12(c)(1)",
        actions: [
          "For covered alleged neglect, exploitation, misappropriation, or mistreatment that does not involve abuse and does not result in serious bodily injury, the federal timeframe is no later than 24 hours.",
          "State law may impose different or additional reporting obligations.",
        ],
        sourceLabel: "CMS State Operations Manual Appendix PP — F609 / 42 CFR §483.12(c)",
        sourceUrl: "https://www.cms.gov/medicare/provider-enrollment-and-certification/guidanceforlawsandregulations/nursing-homes",
      },
    ],
  },
  {
    id: "security-nprm",
    title: "HIPAA Security Rule NPRM Watch",
    description: "Proposed cybersecurity changes are shown separately so a proposal cannot be mistaken for a current breach-notification deadline.",
    icon: FileWarning,
    deadlines: [
      {
        timeframe: "PROPOSED — not a current breach-notification deadline",
        title: "72-hour restoration procedure proposal",
        scope: "2024 HIPAA Security Rule NPRM",
        actions: [
          "The proposal would require written procedures to restore the loss of certain relevant electronic information systems and data within 72 hours.",
          "This is not a proposal to change HHS HIPAA breach notification from 60 days to 72 hours.",
          "HHS states that the current Security Rule remains in effect while rulemaking is underway. Verify current rule status before operationalizing any proposed requirement.",
        ],
        sourceLabel: "HHS — HIPAA Security Rule NPRM Fact Sheet",
        sourceUrl: "https://www.hhs.gov/hipaa/for-professionals/security/hipaa-security-rule-nprm/factsheet/index.html",
        proposed: true,
      },
    ],
  },
  {
    id: "internal",
    title: "Internal Investigation Targets",
    description: "Organization-set service levels can be useful, but they must not be presented as federal legal deadlines unless an actual law, contract, accreditor rule, or policy creates that deadline.",
    icon: Clock,
    deadlines: [
      {
        timeframe: "Set by your organization",
        title: "Triage, preservation, interviews, report, and corrective-action targets",
        scope: "Internal governance target — not a universal federal deadline",
        actions: [
          "Set documented target times by risk category and matter type.",
          "Escalate immediate patient/resident safety, evidence-preservation, access-control, or retaliation risks without waiting for the final report.",
          "When an investigation exceeds its target, document why, what remains open, and any interim protections.",
          "A legal/regulatory deadline always overrides an internal service-level target.",
        ],
        sourceLabel: "Organization policy / compliance program governance",
        sourceUrl: "https://oig.hhs.gov/compliance/general-compliance-program-guidance/",
      },
    ],
  },
];

export default function RegulatoryTimelines() {
  const [open, setOpen] = useState<Record<string, boolean>>({ hipaa: true, ltc: true, "security-nprm": true, internal: false });

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1"><Clock className="w-5 h-5 text-primary" /><h2 className="text-lg font-bold text-foreground">Regulatory Deadlines & Timing Reference</h2></div>
        <p className="text-xs text-muted-foreground">Scoped federal reference points with primary-source links. Last substantively reviewed: August 2026.</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-4">
        <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
        <p className="text-xs text-foreground leading-relaxed"><strong>Always verify the rule for the facility type, state, contract, payer, accreditor, and facts in front of you.</strong> This page intentionally avoids pretending every healthcare investigation follows the same reporting clock.</p>
      </div>

      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const isOpen = !!open[section.id];
        return (
          <div key={section.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <button type="button" onClick={() => setOpen((current) => ({ ...current, [section.id]: !isOpen }))} className="w-full p-4 flex items-start gap-3 text-left hover:bg-muted/20 transition-colors">
              <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1"><p className="text-sm font-semibold text-foreground">{section.title}</p><p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{section.description}</p></div>
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
              <div className="border-t border-border p-4 space-y-3">
                {section.deadlines.map((deadline) => (
                  <div key={`${section.id}-${deadline.title}`} className={cn("rounded-lg border p-4", deadline.proposed ? "border-warning/30 bg-warning/5" : "border-border bg-background")}>
                    <div className="flex flex-wrap gap-2 items-center mb-2">
                      <span className={cn("text-[10px] uppercase tracking-wide font-bold px-2 py-1 rounded", deadline.proposed ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary")}>{deadline.timeframe}</span>
                      <span className="text-[10px] text-muted-foreground">{deadline.scope}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-2">{deadline.title}</p>
                    <ul className="space-y-1.5">{deadline.actions.map((action, index) => <li key={index} className="text-xs text-foreground flex gap-2"><span className="text-muted-foreground">•</span><span>{action}</span></li>)}</ul>
                    <a href={deadline.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] text-primary underline underline-offset-2 hover:text-primary/80">{deadline.sourceLabel}<ExternalLink className="h-3 w-3" /></a>
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
