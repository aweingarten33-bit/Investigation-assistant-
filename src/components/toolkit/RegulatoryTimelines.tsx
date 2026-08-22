import { useState } from "react";
import {
  Clock, AlertTriangle, ChevronDown, ExternalLink,
  Shield, Building2, FileWarning, Landmark, ReceiptText, Files, Hospital, Pill,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getRegulatorySource,
  isRegulatorySourceStale,
  type RegulatorySourceId,
} from "@/lib/regulatory-sources";

type Deadline = {
  timeframe: string;
  title: string;
  scope: string;
  actions: string[];
  sourceId: RegulatorySourceId;
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
    title: "HIPAA & Part 2 Breach Notification",
    description: "Federal breach-notification clocks. Track discovery immediately; do not wait for the investigation to close before calendaring notice obligations.",
    icon: Shield,
    deadlines: [
      {
        timeframe: "Without unreasonable delay; no later than 60 calendar days",
        title: "HIPAA — notify affected individuals",
        scope: "Covered entity — breach of unsecured PHI",
        actions: [
          "The clock runs from discovery of the breach, not completion of the investigation.",
          "The 60 days is an outer limit, not a 60-day waiting period.",
          "Complete the breach-risk analysis promptly enough to meet the notice clock and document the basis for notification or non-notification.",
        ],
        sourceId: "hipaa_individual_notice",
      },
      {
        timeframe: "Without unreasonable delay; no later than 60 calendar days",
        title: "HIPAA — notify HHS for 500+ affected individuals",
        scope: "Covered entity — breach affecting 500 or more individuals",
        actions: [
          "Submit notice to the Secretary through the HHS breach portal.",
          "If more than 500 residents of a State or jurisdiction are affected, media notice is also required within the same outer timeframe.",
          "Use an estimate if the final affected-person count is not yet known; HHS permits addenda to update a prior report.",
        ],
        sourceId: "hipaa_secretary_notice",
      },
      {
        timeframe: "No later than 60 days after the end of the calendar year",
        title: "HIPAA — notify HHS for fewer than 500 affected individuals",
        scope: "Covered entity — breach affecting fewer than 500 individuals",
        actions: [
          "Smaller breaches may be reported to HHS on an annual basis.",
          "You may report earlier; the annual HHS timing does not extend the separate individual-notification deadline.",
        ],
        sourceId: "hipaa_secretary_notice",
      },
      {
        timeframe: "Without unreasonable delay; no later than 60 calendar days",
        title: "HIPAA — business associate notifies covered entity",
        scope: "Business associate — breach of unsecured PHI",
        actions: [
          "Notify the covered entity following discovery of the breach.",
          "Check the BAA: contractual notice may be much shorter than the federal 60-day outer limit.",
          "Provide affected-individual information and other available notice information required by §164.410.",
        ],
        sourceId: "hipaa_business_associate_notice",
      },
      {
        timeframe: "HIPAA-style breach clocks apply as of February 16, 2026",
        title: "42 CFR Part 2 — breach of unsecured Part 2 records",
        scope: "Part 2 program — SUD patient records",
        actions: [
          "Part 2 programs now have breach-notification duties aligned with the HIPAA Breach Notification Rule.",
          "For 500+ affected patients: notify HHS without unreasonable delay and no later than 60 calendar days after discovery; fewer than 500 may be reported within 60 days after the end of the calendar year.",
          "Affected-patient and, where applicable, media notice obligations also apply. Use the HHS Part 2 breach portal/process.",
        ],
        sourceId: "part2_breach_notification",
      },
    ],
  },
  {
    id: "hospital",
    title: "Hospital-Specific Reporting",
    description: "High-value clocks that can arise inside hospitals. These are separate from HIPAA breach timing and from nursing-home rules.",
    icon: Hospital,
    deadlines: [
      {
        timeframe: "Within 24 hours or one business day",
        title: "New York Article 28 adverse event — NYPORTS",
        scope: "N.Y. PHL §2805-l; 10 NYCRR §405.8 / §751.10",
        actions: [
          "Assess immediately whether the event falls within a NYPORTS reportable category; do not wait for the root-cause investigation to finish.",
          "Designated Article 28 hospital/D&TC staff submit the initial adverse-event report through NYPORTS/HCS.",
          "Preserve the clinical record, event details, staffing/assignment information, device/medication data, and other evidence needed for the follow-up investigation/root-cause analysis when required.",
        ],
        sourceId: "nyports_hospital_adverse_events",
      },
      {
        timeframe: "Within 30 days of the statutory trigger",
        title: "New York hospital — possible professional misconduct",
        scope: "N.Y. Public Health Law §2803-e",
        actions: [
          "Covered Article 28 hospitals/facilities must report specified suspensions, restrictions, terminations, privilege actions, certain resignations/withdrawals, convictions, and information reasonably appearing to show physician professional misconduct within the statute's 30-day timeframe.",
          "The recipient depends on the professional license: reports generally go to the Education Department, except physicians, physician assistants, and specialist assistants are reported to the Department of Health.",
          "Calendar the reporting trigger separately from the completion of the internal peer-review, HR, compliance, or credentialing process.",
        ],
        sourceId: "ny_hospital_professional_misconduct",
      },
      {
        timeframe: "Within 72 hours of the occurrence",
        title: "EMTALA — recipient hospital suspects an improper unstable transfer",
        scope: "42 CFR §489.20(m); CMS Appendix V guidance",
        actions: [
          "A recipient hospital that suspects it received an individual improperly transferred while unstable should report the incident to CMS or the State Survey Agency within 72 hours.",
          "Preserve the ED log, MSE/stabilization record, transfer documents, acceptance/refusal communications, transfer-center recordings, on-call roster, and capacity information.",
          "The reporting obligation is distinct from the final EMTALA merits determination.",
        ],
        sourceId: "emtala_recipient_hospital_reporting",
      },
    ],
  },
  {
    id: "controlled-substances",
    title: "Controlled Substances / Diversion",
    description: "Hospital and pharmacy investigations can trigger federal DEA reporting before individual responsibility has been established.",
    icon: Pill,
    deadlines: [
      {
        timeframe: "Written notice to DEA within one business day of discovery",
        title: "Theft or significant loss of controlled substances",
        scope: "21 CFR §1301.74(c); DEA registrants",
        actions: [
          "A DEA registrant must notify the local DEA Field Division Office in writing within one business day after discovery of a theft or significant loss.",
          "DEA must be notified directly; an internal corporate/security report does not substitute for direct DEA notice.",
          "Document the theft/loss using DEA Form 106 and assess state pharmacy/law-enforcement/professional-reporting duties separately.",
          "A medication discrepancy is not automatically a 'significant loss' or proof of diversion by a particular employee; investigate both the regulatory reporting question and individual responsibility.",
        ],
        sourceId: "dea_theft_significant_loss",
      },
    ],
  },
  {
    id: "ny-privacy",
    title: "New York Privacy / Data Breach",
    description: "New York requirements can run alongside HIPAA. Determine whether the incident involves New York residents and 'private information' under GBL §899-aa.",
    icon: Landmark,
    deadlines: [
      {
        timeframe: "Most expedient time possible; no later than 30 days",
        title: "Notify affected New York residents",
        scope: "N.Y. General Business Law §899-aa — covered private information",
        actions: [
          "The current statute imposes a 30-day outer limit after discovery, subject to the law-enforcement delay provision.",
          "If New York residents are being notified, the Attorney General, Department of State, State Police, and—when applicable—Department of Financial Services also receive the required state notice information without delaying resident notice.",
          "Do not assume every HIPAA event is automatically a §899-aa breach; analyze the statutory definitions and any HIPAA-specific state reporting provision.",
        ],
        sourceId: "ny_data_breach_899aa",
      },
      {
        timeframe: "Within 5 business days after notifying HHS",
        title: "HIPAA/HITECH breach notice to New York Attorney General",
        scope: "N.Y. GBL §899-aa(9)",
        actions: [
          "A covered entity required to notify HHS of a HIPAA/HITECH breach must provide notice to the New York Attorney General within five business days after notifying HHS.",
          "This subsection applies even when the breached information is not 'private information' under the narrower New York definition.",
        ],
        sourceId: "ny_data_breach_899aa",
      },
    ],
  },
  {
    id: "ltc",
    title: "Long-Term Care: Federal & New York Reporting",
    description: "Keep the separate federal facility-reporting, suspected-crime, and New York mandated-reporter duties straight. They can overlap on the same event.",
    icon: Building2,
    deadlines: [
      {
        timeframe: "Immediately, but no later than 2 hours",
        title: "Federal LTC alleged violation — abuse or serious bodily injury",
        scope: "42 CFR §483.12(c)(1) / F609",
        actions: [
          "Report covered alleged violations to the facility administrator and required officials, including the State Survey Agency as applicable.",
          "The 2-hour timeframe applies when the alleged violation involves abuse or results in serious bodily injury.",
          "Protect the resident and preserve evidence immediately; do not delay reporting while deciding whether the allegation is credible or substantiated.",
        ],
        sourceId: "cms_ltc_alleged_violations",
      },
      {
        timeframe: "No later than 24 hours",
        title: "Federal LTC alleged violation — no abuse and no serious bodily injury",
        scope: "42 CFR §483.12(c)(1) / F609",
        actions: [
          "For covered alleged neglect, exploitation, mistreatment, injuries of unknown source, or misappropriation that does not involve abuse and does not result in serious bodily injury, the federal outer timeframe is 24 hours.",
          "State law can add a different or additional reporting duty.",
        ],
        sourceId: "cms_ltc_alleged_violations",
      },
      {
        timeframe: "Within 5 working days of the incident",
        title: "Federal LTC — report investigation results",
        scope: "42 CFR §483.12(c)(4) / F609",
        actions: [
          "Report the results of all covered investigations to the administrator/designee and other officials required by State law, including the State Survey Agency.",
          "If the alleged violation is verified, appropriate corrective action must be taken.",
          "This 5-working-day requirement is separate from the initial 2-hour/24-hour report.",
        ],
        sourceId: "cms_ltc_alleged_violations",
      },
      {
        timeframe: "2 hours if serious bodily injury; otherwise 24 hours",
        title: "Federal LTC — reasonable suspicion of a crime",
        scope: "42 CFR §483.12(b)(5); Social Security Act §1150B",
        actions: [
          "A covered individual who forms a reasonable suspicion of a crime against a resident or person receiving care has an independent reporting obligation to the State Agency and one or more local law-enforcement entities.",
          "If the events causing the suspicion result in serious bodily injury: immediately, but no later than 2 hours after forming the suspicion; otherwise no later than 24 hours.",
          "Do not confuse this suspected-crime duty with the facility's separate F609 alleged-violation reporting duty.",
        ],
        sourceId: "cms_ltc_suspected_crime",
      },
      {
        timeframe: "Immediately by telephone; in writing within 48 hours",
        title: "New York residential health care facility abuse reporting",
        scope: "N.Y. Public Health Law §2803-d(3)",
        actions: [
          "New York mandated reporters with reasonable cause to believe a resident was abused, mistreated, neglected, or subjected to misappropriation of property must report to NYSDOH immediately by telephone and in writing within 48 hours.",
          "This is a State-law duty that can overlap with the federal 2-hour/24-hour LTC reporting rules.",
          "Do not wait for the facility investigation to determine individual culpability before making a report that the statute requires on reasonable cause.",
        ],
        sourceId: "ny_phl_2803d",
      },
    ],
  },
  {
    id: "overpayment",
    title: "Medicare Parts A & B Overpayments",
    description: "Current §401.305 timing changed effective January 1, 2025. The 180-day provision is a suspension mechanism for related-overpayment investigations, not a blanket six-month period before the 60-day clock starts.",
    icon: ReceiptText,
    deadlines: [
      {
        timeframe: "Generally 60 days after identification",
        title: "Report and return an identified Medicare Parts A/B overpayment",
        scope: "42 CFR §401.305",
        actions: [
          "Report and return by the later of 60 days after identification or the date a corresponding cost report is due, if applicable.",
          "Identification uses the current regulatory standard tied to actual knowledge, deliberate ignorance, or reckless disregard; do not rely on the old 'reasonable diligence plus quantification' formulation.",
          "If the overpayment appears isolated and no related-overpayment investigation is warranted, the ordinary 60-day clock applies.",
        ],
        sourceId: "medicare_overpayment_401305",
      },
      {
        timeframe: "60-day clock may be suspended for up to 180 days",
        title: "Timely, good-faith investigation of related overpayments",
        scope: "42 CFR §401.305(b)(3)",
        actions: [
          "After an overpayment is identified, if related overpayments may exist from the same or similar cause, a timely, good-faith investigation can suspend the 60-day deadline for up to 180 days.",
          "The suspension ends when the investigation concludes and the aggregate amount is calculated, or at day 180, whichever comes first.",
          "After the suspension ends, the unused remainder of the original 60-day period resumes. The rule does not create an automatic 180-day pre-identification investigation window.",
        ],
        sourceId: "medicare_overpayment_401305",
      },
    ],
  },
  {
    id: "access",
    title: "HIPAA Right of Access",
    description: "A common OCR enforcement area. This clock is separate from investigation and breach-notification timelines.",
    icon: Files,
    deadlines: [
      {
        timeframe: "No later than 30 calendar days after receipt",
        title: "Act on an individual's HIPAA access request",
        scope: "45 CFR §164.524(b)(2)",
        actions: [
          "Thirty calendar days is the federal outer limit; HHS encourages access much sooner when feasible.",
          "If the request cannot be completed within 30 days, one extension of no more than an additional 30 calendar days is permitted if the individual receives written notice within the initial 30 days stating the reason and expected completion date.",
          "Only one extension is permitted per request; delays involving a business associate still consume the same clock.",
        ],
        sourceId: "hipaa_right_of_access",
      },
    ],
  },
  {
    id: "security-nprm",
    title: "HIPAA Security Rule NPRM Watch",
    description: "Proposed cybersecurity changes are deliberately separated from current law so a proposal cannot be mistaken for an enforceable deadline.",
    icon: FileWarning,
    deadlines: [
      {
        timeframe: "PROPOSED — not a current breach-notification deadline",
        title: "72-hour restoration-procedure proposal",
        scope: "HIPAA Security Rule NPRM",
        actions: [
          "The proposal would require written procedures to restore the loss of certain relevant electronic information systems and data within 72 hours.",
          "This is not a proposal to change HIPAA breach notification from 60 days to 72 hours.",
          "HHS's current 2026 Security Rule materials still identify this as a proposed rule and state that the current Security Rule remains in effect.",
        ],
        sourceId: "hipaa_security_nprm_2024",
        proposed: true,
      },
    ],
  },
  {
    id: "internal",
    title: "Internal Investigation Targets",
    description: "Internal service levels are useful, but do not turn them into fake legal deadlines. Regulatory, payer, contractual, accreditor, and preservation duties control when applicable.",
    icon: Clock,
    deadlines: [
      {
        timeframe: "Set by your organization",
        title: "Triage, preservation, interviews, report, and corrective-action targets",
        scope: "Internal governance target — not a universal federal deadline",
        actions: [
          "Set documented target times based on risk and matter type rather than using one completion deadline for every case.",
          "Escalate immediate patient/resident safety, evidence-preservation, access-control, reporting, or retaliation risks without waiting for a final report.",
          "If an investigation exceeds its target, document why, what remains open, and any interim protections.",
          "OIG's compliance guidance supports prompt response and corrective action but does not create a universal 30-, 60-, or 90-day investigation-completion rule.",
        ],
        sourceId: "oig_gcpg",
      },
    ],
  },
];

export default function RegulatoryTimelines() {
  const [open, setOpen] = useState<Record<string, boolean>>({
    hipaa: true,
    hospital: true,
    "controlled-substances": false,
    "ny-privacy": false,
    ltc: true,
    overpayment: false,
    access: false,
    "security-nprm": false,
    internal: false,
  });

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1"><Clock className="w-5 h-5 text-primary" /><h2 className="text-lg font-bold text-foreground">Regulatory Deadlines & Timing Reference</h2></div>
        <p className="text-xs text-muted-foreground">Current federal + New York timing most useful in hospital, privacy, billing, controlled-substance, and LTC investigations. Every rule links to a governed source record with jurisdiction, status, verification date, and version history.</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-4">
        <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
        <div className="text-xs text-foreground leading-relaxed space-y-1">
          <p><strong>Calendar the deadline when the triggering fact occurs—don't wait for the investigation to finish.</strong></p>
          <p>One event can trigger several clocks at once. Always check facility type, jurisdiction, payer/program, contracts/BAAs, accreditation rules, and the exact facts. When two rules apply, satisfy the earliest applicable obligation unless counsel/regulator guidance establishes otherwise.</p>
        </div>
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
                {section.deadlines.map((deadline) => {
                  const source = getRegulatorySource(deadline.sourceId);
                  const stale = isRegulatorySourceStale(source);
                  return (
                    <div key={`${section.id}-${deadline.title}`} className={cn("rounded-lg border p-4", deadline.proposed ? "border-warning/30 bg-warning/5" : "border-border bg-background")}>
                      <div className="flex flex-wrap gap-2 items-center mb-2">
                        <span className={cn("text-[10px] uppercase tracking-wide font-bold px-2 py-1 rounded", deadline.proposed ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary")}>{deadline.timeframe}</span>
                        <span className="text-[10px] text-muted-foreground">{deadline.scope}</span>
                        {stale && <span className="text-[10px] font-semibold text-warning">SOURCE RE-VERIFICATION DUE</span>}
                      </div>
                      <p className="text-sm font-semibold text-foreground mb-2">{deadline.title}</p>
                      <ul className="space-y-1.5">{deadline.actions.map((action, index) => <li key={index} className="text-xs text-foreground flex gap-2"><span className="text-muted-foreground">•</span><span>{action}</span></li>)}</ul>

                      <div className="mt-3 rounded-md border border-border/70 bg-muted/20 p-3 space-y-1">
                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary underline underline-offset-2 hover:text-primary/80">{source.authority} — {source.citation}<ExternalLink className="h-3 w-3" /></a>
                        <p className="text-[10px] text-muted-foreground"><strong>Jurisdiction:</strong> {source.jurisdiction}</p>
                        <p className="text-[10px] text-muted-foreground"><strong>Status:</strong> {source.status} · <strong>Effective:</strong> {source.effectiveDate ?? "No specific effective date / not yet effective"}</p>
                        <p className="text-[10px] text-muted-foreground"><strong>Last verified:</strong> {source.lastVerified} · <strong>Registry version:</strong> {source.version}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
