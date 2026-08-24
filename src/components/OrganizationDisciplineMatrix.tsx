import { Building2, FileText, ShieldQuestion } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { OrganizationDisciplineConfig } from "@/lib/organization-context";
import { SAMPLE_ORG_POLICY_TEXT } from "@/lib/sample-org-policy";

const FIELDS: Array<{
  key: keyof OrganizationDisciplineConfig;
  label: string;
  help: string;
  placeholder: string;
}> = [
  {
    key: "standardOfProof",
    label: "Standard of proof / finding rule",
    help: "How your organization decides whether an allegation is substantiated.",
    placeholder: "Example: Preponderance / more likely than not; unresolved material conflicts require additional investigation.",
  },
  {
    key: "policyRules",
    label: "Applicable policy / code rules",
    help: "Paste the actual rule language that governs the conduct or discipline process.",
    placeholder: "Example: Intentional access to records without a business need violates Privacy Policy §4.2…",
  },
  {
    key: "actionMatrix",
    label: "Your disciplinary / corrective-action matrix",
    help: "Define your own action bands and criteria. The AI is told not to substitute its own universal matrix.",
    placeholder: "Example:\nBand A — coaching/retraining when…\nBand B — formal warning when…\nSerious misconduct exception — final warning through termination when…",
  },
  {
    key: "precedent",
    label: "Anonymized comparable precedent",
    help: "Materially similar prior matters and how they were resolved. Avoid names or unnecessary identifiers.",
    placeholder: "Example: Comparable privacy case (2025): deliberate snooping, no prior history → final warning + monitoring after HR review.",
  },
  {
    key: "cbaLabor",
    label: "CBA / union / due-process requirements",
    help: "Progressive discipline, just cause, notice, representation, grievance, appeal, or other labor rules.",
    placeholder: "Example: CBA Article 12 requires progressive discipline except enumerated serious misconduct; union representation rights apply.",
  },
  {
    key: "priorHistoryRules",
    label: "Prior-discipline rules",
    help: "How prior warnings, lookback periods, repeat conduct, and expunged discipline may be considered.",
    placeholder: "Example: Only active discipline within 24 months may be used for escalation…",
  },
  {
    key: "trainingRoleExpectations",
    label: "Training / role / access expectations",
    help: "Role-specific expectations that change how intent, knowledge, or responsibility should be weighed.",
    placeholder: "Example: Privacy staff and managers receive enhanced annual training; break-glass access requires documented treatment need.",
  },
  {
    key: "requiredApprovals",
    label: "Required approvals",
    help: "Who must review or approve serious action and what must happen before implementation.",
    placeholder: "Example: Final warnings require HRBP approval; termination requires HR + Legal + VP; Privacy Officer separately decides breach obligations.",
  },
  {
    key: "additionalContext",
    label: "Other organization-specific criteria",
    help: "Anything else the decision-support engine should use as criteria rather than inventing assumptions.",
    placeholder: "Optional additional context…",
  },
];

export function OrganizationDisciplineMatrix({
  config,
  onChange,
  maxCharacters = 20_000,
}: {
  config: OrganizationDisciplineConfig;
  onChange: (config: OrganizationDisciplineConfig) => void;
  maxCharacters?: number;
}) {
  const total = Object.values(config).reduce((sum, value) => sum + value.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <Building2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <p className="text-xs font-semibold text-foreground">Organization-configurable discipline matrix</p>
            <button
              type="button"
              onClick={() => onChange({ ...config, policyRules: SAMPLE_ORG_POLICY_TEXT })}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[10px] font-bold hover:bg-primary/90 transition-colors"
            >
              <FileText className="h-3 w-3" /> Load my org policy
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            These fields control the organization-specific decision criteria sent with the case. They are not treated as case evidence, and the AI must defer when the applicable policy, precedent, CBA, or approvals are missing.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {FIELDS.map((field) => (
          <label key={field.key} className="space-y-1.5 block">
            <span className="text-[11px] font-semibold text-foreground">{field.label}</span>
            <span className="block text-[10px] text-muted-foreground">{field.help}</span>
            <Textarea
              value={config[field.key]}
              onChange={(event) => onChange({ ...config, [field.key]: event.target.value })}
              placeholder={field.placeholder}
              className="min-h-[82px] text-xs"
            />
          </label>
        ))}
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
          <ShieldQuestion className="h-3 w-3 mt-0.5 shrink-0" />
          <span>Leave unknown items blank. Missing material criteria should cause policy review/defer—not AI guesswork.</span>
        </div>
        <span className={`text-[10px] shrink-0 ${total > maxCharacters ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
          {total.toLocaleString()} / {maxCharacters.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
