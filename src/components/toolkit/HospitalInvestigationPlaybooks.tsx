import { useState } from "react";
import { AlertTriangle, ChevronDown, Hospital, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Playbook = {
  id: string;
  title: string;
  trigger: string;
  preserve: string[];
  questions: string[];
  watch: string[];
};

const PLAYBOOKS: Playbook[] = [
  {
    id: "social-media-phi",
    title: "Social Media / Online PHI",
    trigger: "Facebook, Instagram, TikTok, X, online reviews, public websites, blogs, photos/video, screenshots, patient stories, livestreams, or private-group posts that may reveal a patient or resident.",
    preserve: [
      "Capture the post, comment, image/video, profile/account, URL, date/time, audience/privacy setting, edits, and deletion status before content disappears.",
      "Preserve the original image/video and metadata when available; do not rely only on a cropped screenshot.",
      "Preserve EHR/audit logs if the post appears to contain information obtained from the medical record.",
      "Pull the employee's role, assignment, authorization/consent documents, social-media policy, HIPAA/privacy training, and any marketing release actually relied on.",
      "If the organization posted the content, preserve the approval workflow, marketing files, authorization form, vendor/agency communications, and publication history.",
    ],
    questions: [
      "Can the patient be identified directly or indirectly from the text, image, date, location, diagnosis, relationship, or surrounding facts?",
      "Where did the poster learn the information—direct care, the EHR, a coworker, personal knowledge, or a public source?",
      "Was there a valid HIPAA authorization for this exact use/disclosure, and was it in effect when the content was posted?",
      "Was the account personal or organization-controlled, and who could see the content at the time of posting?",
      "Was PHI disclosed while responding to an online review? A patient's own public review does not authorize the provider to disclose additional PHI in response.",
      "Was the post deleted, shared, screenshotted, reposted, or viewed by others before containment?",
      "Does the event require a HIPAA breach-risk analysis, Part 2 analysis, New York breach analysis, patient notice, HHS notice, or other reporting?",
    ],
    watch: [
      "Do not assume 'no name' means no PHI; context can identify a patient.",
      "A private Facebook group or 'friends only' account is still a disclosure to people who may not be authorized to receive PHI.",
      "Do not tell staff to delete the post before evidence is preserved; deletion can destroy evidence and does not undo a disclosure.",
      "Blurring or de-identifying content after media or a third party already had access does not retroactively cure an impermissible disclosure.",
    ],
  },
  {
    id: "ehr-snooping",
    title: "EHR Snooping / Unauthorized Access",
    trigger: "Curiosity access, celebrity/family/ex-partner/neighbour records, sensitive psychiatric/SUD records, repeated chart openings, unusual break-the-glass activity, or access unrelated to job duties.",
    preserve: [
      "EHR audit trail with timestamps, modules viewed, actions taken, exports/prints, and break-the-glass events.",
      "Work assignment, schedule, department, treatment relationship, role permissions, and any legitimate TPO/workflow reason for access.",
      "Messages, print logs, disclosures, screenshots, and downstream use if information may have been shared.",
      "Privacy/security training, policy acknowledgments, prior access alerts or sanctions if legitimately relevant to corrective-action review.",
    ],
    questions: [
      "What exact business or clinical task required each access?",
      "Was the employee assigned to the patient or performing treatment, payment, or operations work that actually required the information viewed?",
      "Is there a personal relationship, curiosity motive, conflict, or other non-work explanation?",
      "Was information merely opened, or also printed, exported, photographed, discussed, texted, or posted?",
      "Does the access involve especially sensitive information such as behavioral health, SUD/Part 2, reproductive care, HIV, employee health, or a known individual?",
      "Is this a single event or a pattern involving additional patients?",
    ],
    watch: [
      "Audit-log access alone proves access occurred; it does not by itself prove the purpose was unauthorized.",
      "An employee's job title alone does not establish a need to know. Tie each access to an actual duty.",
      "Separate the HIPAA/privacy finding, breach analysis, and employment/corrective-action decision.",
    ],
  },
  {
    id: "controlled-substances",
    title: "Controlled-Substance Diversion / Discrepancy",
    trigger: "Missing narcotics, count discrepancies, undocumented waste, suspicious overrides, abnormal dispensing patterns, tampered medication, or allegations of diversion.",
    preserve: [
      "ADC/Pyxis/Omnicell logs, MAR/eMAR, wasting records, inventory/count sheets, pharmacy records, access logs, surveillance, badge logs, schedules, and patient charts.",
      "Preserve the medication/package/container when tampering or substitution is suspected and follow facility chain-of-custody procedures.",
      "Document when the theft/significant loss was discovered so the DEA one-business-day clock can be assessed immediately.",
    ],
    questions: [
      "Is there objective evidence of a shortage, theft, tampering, substitution, or unexplained administration?",
      "Who had access during the relevant time and what does each system independently show?",
      "Do patient records support the documented administrations and pain-management needs?",
      "Are there recurring late wastes, overrides, cancellations, removals for discharged patients, or access outside assignment?",
      "Can individual responsibility actually be established, or is the evidence currently only a system-level discrepancy?",
      "Are patient-safety, DEA, state pharmacy, professional-licensing, law-enforcement, or other reporting duties implicated?",
    ],
    watch: [
      "Do not equate a discrepancy with proof that a particular nurse diverted drugs.",
      "Protect patients and preserve evidence before confronting a suspected individual when confrontation could compromise evidence or safety.",
    ],
  },
  {
    id: "emtala",
    title: "EMTALA / Emergency Department",
    trigger: "Refused screening, transfer disputes, unstable transfer, alleged dumping, inability-to-pay concerns, on-call physician issues, or refusal to accept an appropriate transfer when specialized capability/capacity existed.",
    preserve: [
      "ED log, triage record, medical screening exam, orders, nursing notes, transfer certification, acceptance/refusal communications, transfer-center recordings, on-call roster, bed/capacity records, ambulance records, and policies.",
      "If your hospital received a patient who may have been improperly transferred while unstable, calendar the recipient-hospital 72-hour CMS/State Agency reporting issue immediately.",
    ],
    questions: [
      "Did the individual come to the emergency department requesting examination or treatment for a medical condition?",
      "Was an appropriate medical screening examination performed within the hospital's capability?",
      "If an emergency medical condition existed, was stabilizing treatment provided within capability/capacity?",
      "If transferred, were the statutory/regulatory transfer conditions met and was the transfer appropriate?",
      "Did insurance status, ability to pay, behavioral-health presentation, disability, or another improper factor affect screening/treatment/transfer?",
      "What were the sending and receiving hospitals' capabilities and capacities at the relevant time?",
    ],
    watch: [
      "EMTALA analysis is highly fact-specific; do not reduce it to whether the patient ultimately had a bad outcome.",
      "A receiving hospital's reporting duty is distinct from the merits of the underlying EMTALA allegation.",
    ],
  },
  {
    id: "billing-fraud",
    title: "Billing / Documentation / Fraud",
    trigger: "Upcoding, unsupported services, cloned notes, altered documentation, medically unnecessary services, kickback/referral concerns, unreturned overpayments, or deliberate falsification.",
    preserve: [
      "Original and edited clinical documentation, audit/version history, claims, remittances, coding notes, billing edits, denials, emails/messages, contracts, referral data, and relevant policies.",
      "Identify the affected payer/program and potential universe early; Medicare/Medicaid and commercial-payer obligations may differ.",
    ],
    questions: [
      "What was billed, what documentation existed at the time, and what changed later?",
      "Is this a documentation mistake, coding disagreement, unsupported claim, deliberate falsification, or potentially systemic process problem?",
      "Who knew what and when? Was there pressure, incentive, quota, remuneration, or personal benefit?",
      "How many claims/providers/patients/time periods may be affected?",
      "Has an overpayment been identified, and could related overpayments exist from the same or similar cause?",
      "Does the matter require repayment, payer disclosure, OIG/DOJ/legal analysis, or other self-disclosure consideration?",
    ],
    watch: [
      "Do not label conduct 'fraud' solely because documentation is wrong; intent and knowledge matter.",
      "Do not apply the Medicare 60-day overpayment rule to every payer without checking the governing contract/law/program.",
    ],
  },
  {
    id: "patient-safety-abuse",
    title: "Patient Abuse / Neglect / Safety Event",
    trigger: "Physical/verbal/sexual abuse allegations, neglect, failure to respond, improper restraint, fall/safety events, medication error, treatment delay, or alleged staff misconduct affecting patient welfare.",
    preserve: [
      "Clinical record, event report, assessments, staffing/assignment records, call-light data, surveillance, badge/access logs, orders, care plans, policies, and contemporaneous messages.",
      "Address immediate patient protection and mandatory reporting before waiting for final substantiation where the triggering rule requires prompt reporting.",
    ],
    questions: [
      "What happened to the patient and what objective evidence supports the timeline?",
      "What care, monitoring, staffing, or response was expected versus what actually occurred?",
      "Is the issue individual misconduct, a system/process failure, inadequate staffing/resources, or a combination?",
      "Are injury, harm, treatment escalation, death, or a NYPORTS-reportable adverse event involved?",
      "Does the subject have a plausible alternative explanation supported by evidence?",
    ],
    watch: [
      "Hospital adverse-event reporting and nursing-home abuse reporting use different rules; identify the facility type first.",
      "Do not wait for HR discipline decisions before making a mandatory patient-safety or regulator report.",
    ],
  },
  {
    id: "retaliation",
    title: "Retaliation / Whistleblower",
    trigger: "Schedule reduction, exclusion, discipline, transfer, termination, hostility, credentialing action, or other adverse treatment after a compliance, safety, billing, privacy, discrimination, or government-program concern.",
    preserve: [
      "Original protected complaint/report, chronology, decision records, emails/messages, evaluations, schedules, comparator data, prior performance/discipline, and policy.",
      "Identify who knew about the protected activity and when they learned it.",
    ],
    questions: [
      "What protected activity occurred and when?",
      "Who made or influenced the challenged decision, and did they know about the protected activity?",
      "What legitimate reason is asserted and what contemporaneous documentation supports it?",
      "How were similarly situated employees treated?",
      "Did the stated reason change over time or conflict with earlier records?",
      "Is timing suspicious, and what evidence strengthens or weakens a causal inference beyond timing alone?",
    ],
    watch: [
      "Temporal proximity is evidence, but it is not automatically proof of retaliation.",
      "Consider whether Legal/HR should direct or co-manage the matter because retaliation can create significant litigation/regulatory exposure.",
    ],
  },
  {
    id: "professional-misconduct",
    title: "Physician / Licensed Professional Misconduct",
    trigger: "Clinical incompetence, impairment, malpractice/misconduct concerns, patient-safety concerns, credentialing/privilege action, resignation during review, or conduct that may require professional-discipline reporting.",
    preserve: [
      "Peer-review/credentialing materials using the organization's protected process, relevant charts, privilege/appointment records, call schedules, complaints, quality data, and the exact adverse action/resignation chronology.",
      "Calendar New York Public Health Law §2803-e reporting when a covered action/knowledge trigger occurs; do not assume the internal investigation deadline controls the statutory report.",
    ],
    questions: [
      "What exact conduct or competence issue is alleged and what clinical/professional standard applies?",
      "What adverse action, restriction, resignation, or withdrawal occurred, and why?",
      "When did the hospital obtain information reasonably appearing to show professional misconduct?",
      "Which professional disciplinary agency receives the report for this license type?",
      "What peer-review/confidentiality protections apply to the materials and distribution?",
    ],
    watch: [
      "Keep compliance fact-finding coordinated with Medical Staff, Quality, HR, Risk, and Legal so processes do not undermine credentialing/peer-review protections.",
      "A licensing report is not the same thing as an employment-discipline recommendation.",
    ],
  },
];

type Tab = "preserve" | "questions" | "watch";
const TABS: { id: Tab; label: string }[] = [
  { id: "preserve", label: "Preserve" },
  { id: "questions", label: "Questions" },
  { id: "watch", label: "Watch-outs" },
];

export default function HospitalInvestigationPlaybooks() {
  const [open, setOpen] = useState<string | null>("social-media-phi");
  const [activeTab, setActiveTab] = useState<Tab>("preserve");

  const openPlaybook = (id: string) => {
    setOpen((current) => (current === id ? null : id));
    setActiveTab("preserve");
  };

  return (
    <div className="mt-6 space-y-3">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 max-w-prose">
        <div className="flex items-start gap-2.5">
          <Hospital className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-foreground">Hospital Investigation Quick Plays</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">Use these when a hospital complaint lands in front of you. They focus on the evidence to preserve, the questions that actually decide the case, and the traps that create bad findings.</p>
          </div>
        </div>
      </div>

      {PLAYBOOKS.map((playbook) => {
        const isOpen = open === playbook.id;
        return (
          <div key={playbook.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <button type="button" onClick={() => openPlaybook(playbook.id)} className="w-full p-4 flex items-start gap-3 text-left hover:bg-muted/20 transition-colors">
              <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0 max-w-prose">
                <p className="text-sm font-semibold text-foreground">{playbook.title}</p>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{playbook.trigger}</p>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <div className="border-t border-border max-w-prose">
                <div className="flex gap-1.5 px-4 pt-3">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors",
                        activeTab === tab.id
                          ? tab.id === "watch" ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:bg-secondary/50"
                      )}
                    >
                      {tab.id === "watch" && <AlertTriangle className="h-3 w-3 inline mr-1 -mt-0.5" />}
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="p-4">
                  {activeTab === "preserve" && (
                    <ul className="space-y-2">{playbook.preserve.map((item, i) => <li key={i} className="text-sm text-foreground leading-relaxed flex gap-2"><span>•</span><span>{item}</span></li>)}</ul>
                  )}
                  {activeTab === "questions" && (
                    <ul className="space-y-2">{playbook.questions.map((item, i) => <li key={i} className="text-sm text-foreground leading-relaxed flex gap-2"><span>•</span><span>{item}</span></li>)}</ul>
                  )}
                  {activeTab === "watch" && (
                    <ul className="space-y-2">{playbook.watch.map((item, i) => <li key={i} className="text-sm text-foreground leading-relaxed flex gap-2"><span>•</span><span>{item}</span></li>)}</ul>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
