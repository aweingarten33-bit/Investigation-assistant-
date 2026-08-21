import { useState } from "react";
import { Users, Copy, Check, ChevronDown, MessageSquare, AlertTriangle, Shield, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const TEMPLATES = [
  {
    id: "witness",
    title: "Witness Interview",
    icon: Users,
    badge: "Most Common",
    badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    when: "For people who might know something — but aren't the subject.",
    sections: [
      {
        heading: "Opening — Read This Out Loud",
        content: `Thanks for meeting with me. I'm conducting an internal review of [general description]. Here's what you need to know:

• I want your honest recollection. There are no wrong answers.
• This conversation is confidential — don't discuss it with anyone, including coworkers.
• Your cooperation is appreciated and expected.
• Retaliation against anyone involved is strictly prohibited.
• Only tell me what YOU personally know or saw — not rumors or guesses.

Any questions before we start?`,
      },
      {
        heading: "Background",
        content: `• What's your current role and how long have you been in it?
• What are your main responsibilities?
• Who do you report to?
• What does a typical day/week look like for you?
• What policies or procedures apply to [relevant area]?
• What training have you had on [relevant topic]?`,
      },
      {
        heading: "Core Questions — Start Broad, Then Narrow",
        content: `START BROAD:
• Tell me what you know about [the situation].
• Walk me through what happened from your perspective.
• When did you first become aware of this?

THEN NARROW DOWN:
• Who else was involved or present?
• What did you observe directly vs. hear from others?
• Were there any documents, emails, or records related to this?
• Has anything like this happened before?
• Were any concerns raised at the time? By whom?`,
      },
      {
        heading: "Follow-Up",
        content: `• You mentioned [X] — can you tell me more?
• How did you know [specific detail]?
• What was the response when [event occurred]?
• Was there anything that seemed unusual to you?
• Were you ever directed or pressured to do something you were uncomfortable with?`,
      },
      {
        heading: "Closing — Always Ask These 5",
        content: `1. Is there anyone else I should talk to about this?
2. Are there any documents or records I should look at?
3. Is there anything I haven't asked about that you think I should know?
4. Have you experienced or witnessed any retaliation?
5. Do you have any questions for me?

[Remind about confidentiality. Thank them. Say you may need to follow up.]`,
      },
    ],
  },
  {
    id: "subject",
    title: "Subject Interview",
    icon: AlertTriangle,
    badge: "Do This Last",
    badgeColor: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    when: "For the person being investigated. ALWAYS interview them LAST after you have all the facts.",
    sections: [
      {
        heading: "Opening — Read This Out Loud",
        content: `Thanks for meeting with me. I'm conducting an internal review, and I want to discuss some matters with you.

• This is an internal investigation — I'm not law enforcement.
• I want your honest account of events.
• This conversation is confidential — don't discuss it with coworkers.
• Your cooperation is expected.
• Retaliation against anyone is prohibited.
• [If applicable: I represent the organization, not you personally. You can seek your own attorney at any time.]

Do you understand? Any questions?`,
      },
      {
        heading: "Background & Context",
        content: `• Describe your role and responsibilities.
• How long have you been in this position?
• Walk me through your typical workflow for [relevant process].
• What policies apply to [relevant area]?
• What training have you had on [relevant topic]?
• Who do you work closely with on [relevant activities]?`,
      },
      {
        heading: "Addressing the Allegation",
        content: `• I'd like to discuss [general description]. What can you tell me about this?
• Walk me through what happened on [date/timeframe].
• [Show specific facts/documents] — Can you explain this?
• Why did you [specific action]?
• Were you aware that [policy/regulation] requires [standard]?
• Who authorized or directed [the action]?
• Did you discuss this with anyone at the time?
• Is there any documentation that supports your account?`,
      },
      {
        heading: "Closing",
        content: `• Is there anything that explains or provides context?
• Anything you'd like to add or clarify?
• Anyone who can corroborate your account?
• Any documents I should review?
• Any retaliation concerns?

[Remind about confidentiality. Do NOT tell them the outcome or your preliminary conclusions.]`,
      },
    ],
  },
  {
    id: "upjohn",
    title: "Upjohn Warning",
    icon: Shield,
    badge: "Legal — Required",
    badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
    when: "Read this word-for-word when legal counsel is directing the investigation.",
    sections: [
      {
        heading: "Read This EXACTLY As Written",
        content: `Before we begin, I need to advise you:

1. I'm conducting this interview as part of an internal investigation directed by the organization's legal counsel.

2. I represent [Organization Name]. I do NOT represent you personally.

3. This conversation is so our counsel can provide legal advice to the organization.

4. This conversation is protected by attorney-client privilege. BUT — the privilege belongs to the organization, not you. The organization may share this conversation with anyone, including the government, at any time.

5. You must keep this conversation confidential. Don't discuss it with anyone other than the organization's counsel.

6. You are expected to cooperate fully and give truthful, complete answers.

7. You have the right to consult your own personal attorney at your own expense at any time.

Do you understand each of these points? [Wait for yes]
Any questions? [Answer them]
May I proceed? [Wait for yes]

[DOCUMENT: Date, time, employee name, that warning was given and understood]`,
      },
    ],
  },
  {
    id: "hipaa",
    title: "HIPAA / Privacy Questions",
    icon: FileText,
    badge: "Specialized",
    badgeColor: "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
    when: "Use these for investigations involving unauthorized PHI access, disclosure, or breach.",
    sections: [
      {
        heading: "For the Person Who Accessed/Disclosed PHI",
        content: `• What's your relationship to the patient whose info was accessed?
• What was your purpose for accessing the record?
• Did you have a treatment, payment, or operations reason?
• Were you authorized to access this record?
• Who directed you to access/disclose this info?
• What specific information did you view/disclose?
• To whom? By what method (verbal, email, fax)?
• Were you aware of the HIPAA policies?
• When did you last do HIPAA training?
• Have you accessed records you weren't authorized to view on any other occasion?`,
      },
      {
        heading: "For Breach Assessment",
        content: `• What type of PHI was involved (demographics, diagnoses, SSN, financial)?
• How many patients affected?
• Was the info encrypted or protected?
• Who received the unauthorized disclosure?
• Could the info be further used or disclosed?
• Has the PHI been returned or destroyed?
• What's the likelihood of harm to affected individuals?
• What steps have been taken to mitigate?
• Does this meet the breach notification threshold (45 CFR §164.402)?`,
      },
    ],
  },
];

export default function InterviewTemplates() {
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>("witness");
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copySection = (content: string, key: string) => {
    navigator.clipboard.writeText(content);
    setCopiedSection(key);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Interview Templates</h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-3">
        Copy-ready scripts. Pick the template, copy the section, customize for your case.
      </p>

      <div className="space-y-2">
        {TEMPLATES.map((template) => (
          <div key={template.id} className={cn(
            "rounded-lg border border-border overflow-hidden transition-shadow",
            expandedTemplate === template.id && "shadow-sm"
          )}>
            <button
              onClick={() => setExpandedTemplate(expandedTemplate === template.id ? null : template.id)}
              className="w-full flex items-center gap-3.5 p-3.5 hover:bg-secondary/20 transition-colors text-left"
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                expandedTemplate === template.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              )}>
                <template.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{template.title}</h3>
                  <span className={cn("text-[9px] px-2 py-0.5 rounded-full font-semibold", template.badgeColor)}>
                    {template.badge}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{template.when}</p>
              </div>
              <ChevronDown className={cn(
                "w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200",
                expandedTemplate !== template.id && "-rotate-90"
              )} />
            </button>

            {expandedTemplate === template.id && (
              <div className="border-t border-border divide-y divide-border/50">
                {template.sections.map((section, i) => {
                  const copyKey = `${template.id}-${i}`;
                  return (
                    <div key={i} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          {section.heading}
                        </h4>
                        <button
                          onClick={() => copySection(section.content, copyKey)}
                          className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        >
                          {copiedSection === copyKey ? (
                            <><Check className="w-3 h-3 text-success" /> Copied</>
                          ) : (
                            <><Copy className="w-3 h-3" /> Copy</>
                          )}
                        </button>
                      </div>
                      <pre className="text-[12px] sm:text-[13px] text-foreground/85 whitespace-pre-wrap font-sans leading-[1.6] sm:leading-[1.7] bg-secondary/20 p-3 sm:p-4 rounded-md border border-border/50 overflow-x-hidden">
                        {section.content}
                      </pre>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
