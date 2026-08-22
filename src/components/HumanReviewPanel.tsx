import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Save, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AnalysisResult, HumanReviewRecord, HumanReviewStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: HumanReviewStatus; label: string; help: string }[] = [
  { value: "approved", label: "I agree", help: "The finding/action makes sense after reviewing the evidence." },
  { value: "approved_with_changes", label: "I agree, with changes", help: "The analysis is useful, but the final finding/action or rationale should be different." },
  { value: "needs_more_info", label: "Not ready yet", help: "More evidence, policy review, or follow-up is needed before closing." },
  { value: "rejected", label: "I disagree with the AI", help: "The AI analysis/recommendation is not the conclusion I would use." },
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
      reviewerName: reviewerName.trim() || "[Not entered]",
      reviewerRole: reviewerRole.trim() || "[Not entered]",
      status,
      finalFinding: finalFinding.trim() || result.decision.replace(/_/g, " "),
      finalAction: finalAction.trim() || "No final corrective action recorded",
      rationale: rationale.trim() || "No rationale entered",
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
            <p className="text-sm font-semibold text-foreground">My Final Decision <span className="font-normal text-muted-foreground">(optional)</span></p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Use this only when you want the Word export to show what you actually decided after reviewing the evidence. The AI result stays decision support; this is your conclusion.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Name (optional)</span>
            <input value={reviewerName} onChange={(e) => { setReviewerName(e.target.value); setSaved(false); }} className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs" placeholder="Your name" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Role (optional)</span>
            <input value={reviewerRole} onChange={(e) => { setReviewerRole(e.target.value); setSaved(false); }} className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs" placeholder="Compliance, Privacy, Investigator, etc." />
          </label>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">My disposition</p>
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
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">My final finding</span>
            <input value={finalFinding} onChange={(e) => { setFinalFinding(e.target.value); setSaved(false); }} className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs" placeholder="Substantiated / unsubstantiated / needs more information" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">My final action / disposition</span>
            <input value={finalAction} onChange={(e) => { setFinalAction(e.target.value); setSaved(false); }} className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs" placeholder="Close, monitor, education, referral, corrective action, etc." />
          </label>
        </div>

        <label className="space-y-1 block">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Why I decided that</span>
          <Textarea value={rationale} onChange={(e) => { setRationale(e.target.value); setSaved(false); }} className="min-h-[90px] text-xs" placeholder="What evidence, policy, contradiction, precedent, or other factor drove your final conclusion?" />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} className="h-9 text-xs"><Save className="h-3.5 w-3.5 mr-1.5" />Save My Decision</Button>
          {result.humanReview && <Button type="button" variant="outline" onClick={clear} className="h-9 text-xs">Clear</Button>}
          {saved && result.humanReview && <span className="inline-flex items-center gap-1 text-[11px] text-success"><CheckCircle2 className="h-3.5 w-3.5" />Included in this result/export</span>}
        </div>
      </div>
    </div>
  );
}
