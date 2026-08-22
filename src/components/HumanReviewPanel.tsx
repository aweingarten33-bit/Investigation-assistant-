import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Save, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AnalysisResult, HumanReviewRecord, HumanReviewStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: HumanReviewStatus; label: string; help: string }[] = [
  { value: "approved", label: "Approve", help: "Human reviewer agrees with the finding/action after independent review." },
  { value: "approved_with_changes", label: "Approve with changes", help: "Human reviewer accepts the analysis but changes the final finding/action or rationale." },
  { value: "needs_more_info", label: "Need more information", help: "Human reviewer will not finalize until additional evidence/policy review is completed." },
  { value: "rejected", label: "Reject AI recommendation", help: "Human reviewer disagrees with the AI analysis/recommendation and records why." },
];

export function HumanReviewPanel({
  result,
  onChange,
}: {
  result: AnalysisResult;
  onChange: (review: HumanReviewRecord | undefined) => void;
}) {
  const existing = result.humanReview;
  const [reviewerName, setReviewerName] = useState(existing?.reviewerName ?? "");
  const [reviewerRole, setReviewerRole] = useState(existing?.reviewerRole ?? "");
  const [status, setStatus] = useState<HumanReviewStatus>(existing?.status ?? "needs_more_info");
  const [finalFinding, setFinalFinding] = useState(existing?.finalFinding ?? result.decision.replace(/_/g, " "));
  const [finalAction, setFinalAction] = useState(existing?.finalAction ?? "");
  const [rationale, setRationale] = useState(existing?.rationale ?? "");
  const [saved, setSaved] = useState(Boolean(existing));

  const selected = useMemo(() => STATUS_OPTIONS.find((item) => item.value === status)!, [status]);

  const save = () => {
    const review: HumanReviewRecord = {
      reviewerName: reviewerName.trim() || "[Reviewer name not entered]",
      reviewerRole: reviewerRole.trim() || "[Reviewer role not entered]",
      status,
      finalFinding: finalFinding.trim() || result.decision.replace(/_/g, " "),
      finalAction: finalAction.trim() || "No final employment/corrective action recorded",
      rationale: rationale.trim() || "No reviewer rationale entered",
      reviewedAt: new Date().toISOString(),
    };
    onChange(review);
    setSaved(true);
  };

  const clear = () => {
    onChange(undefined);
    setSaved(false);
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-card overflow-hidden">
      <div className="p-4 border-b border-border bg-primary/5">
        <div className="flex items-start gap-2.5">
          <ClipboardCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Human Review Record</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              The AI output is not the final decision. Record what a human reviewer actually decided after checking the evidence, policy, precedent, labor/CBA requirements, and HR/Legal input. This record is included in the current export but is not a persistent enterprise audit log.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Reviewer name</span>
            <input value={reviewerName} onChange={(e) => { setReviewerName(e.target.value); setSaved(false); }} className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs" placeholder="Name" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Reviewer role</span>
            <input value={reviewerRole} onChange={(e) => { setReviewerRole(e.target.value); setSaved(false); }} className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs" placeholder="Compliance, Privacy, HR, Legal, etc." />
          </label>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">Review disposition</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button key={option.value} type="button" onClick={() => { setStatus(option.value); setSaved(false); }} className={`rounded-lg border p-3 text-left transition-colors ${status === option.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/20"}`}>
                <p className="text-xs font-semibold text-foreground">{option.label}</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{option.help}</p>
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-muted/30 p-2.5">
            <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground">Selected: {selected.help}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Final human finding</span>
            <input value={finalFinding} onChange={(e) => { setFinalFinding(e.target.value); setSaved(false); }} className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs" placeholder="Substantiated / not substantiated / modified finding" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Final action / disposition</span>
            <input value={finalAction} onChange={(e) => { setFinalAction(e.target.value); setSaved(false); }} className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs" placeholder="No action, coaching, warning, policy change, referred to HR, etc." />
          </label>
        </div>

        <label className="space-y-1 block">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Human rationale / override explanation</span>
          <Textarea value={rationale} onChange={(e) => { setRationale(e.target.value); setSaved(false); }} className="min-h-[100px] text-xs" placeholder="Explain why the human reviewer accepted, changed, rejected, or deferred the AI recommendation. Note policy/precedent/CBA/HR/Legal factors that changed the outcome." />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} className="h-9 text-xs"><Save className="h-3.5 w-3.5 mr-1.5" />Save Human Review</Button>
          {result.humanReview && <Button type="button" variant="outline" onClick={clear} className="h-9 text-xs">Clear Review</Button>}
          {saved && result.humanReview && <span className="inline-flex items-center gap-1 text-[11px] text-success"><CheckCircle2 className="h-3.5 w-3.5" />Included in this case result/export</span>}
        </div>
      </div>
    </div>
  );
}
