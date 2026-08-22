import { useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ClipboardList,
  FileSearch, MessageSquareText, RefreshCw, ShieldAlert, Sparkles, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api";
import type { AnalysisResult } from "@/lib/types";

type InvestigatorPlan = {
  bottomLine: string;
  immediateActions: string[];
  recordsToObtain: string[];
  peopleToInterview: string[];
  interviewQuestions: string[];
  contradictionsToResolve: string[];
  analysisChecks: string[];
  correctiveActionIdeas: string[];
  retestPlan: string[];
  readyToClose: boolean;
  closeoutReason: string;
};

function PlanList({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-xs text-muted-foreground">Nothing additional identified.</p>;
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${index}-${item}`} className="flex gap-2 text-sm text-foreground leading-relaxed">
          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PlanSection({
  title,
  icon: Icon,
  items,
  defaultOpen = true,
}: {
  title: string;
  icon: typeof FileSearch;
  items: string[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      <button type="button" onClick={() => setOpen((value) => !value)} className="w-full p-3 flex items-center gap-2 text-left hover:bg-muted/20">
        <Icon className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs font-semibold text-foreground flex-1">{title}</span>
        <span className="text-[10px] text-muted-foreground">{items.length}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-3 pb-3"><PlanList items={items} /></div>}
    </div>
  );
}

function buildAnalysisSummary(result: AnalysisResult) {
  return JSON.stringify({
    decision: result.decision,
    confidenceScore: result.confidenceScore,
    riskLevel: result.riskLevel,
    violationType: result.violationType,
    notesCompleteness: result.notesCompleteness,
    findings: result.findings,
    evidenceItems: result.evidenceItems,
    missingInfo: result.missingInfo,
    policyQuestions: result.policyQuestions,
    disciplineRange: result.disciplineRange,
    recommendations: result.recommendations,
    conclusion: result.conclusion,
  }, null, 2);
}

export function InvestigatorNextSteps({ result, caseNotes }: { result: AnalysisResult; caseNotes: string }) {
  const [plan, setPlan] = useState<InvestigatorPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const analysisSummary = useMemo(() => buildAnalysisSummary(result), [result]);

  const generate = async () => {
    setLoading(true);
    setError(null);
    const { data, error: apiError } = await callApi<{ plan: InvestigatorPlan }>("investigation-toolkit", {
      mode: "investigator_plan",
      caseNotes,
      analysisSummary,
    });
    if (apiError || !data?.plan) {
      setError(apiError?.message || "Could not generate the investigator plan.");
      setLoading(false);
      return;
    }
    setPlan(data.plan);
    setLoading(false);
  };

  if (!plan) {
    return (
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <ClipboardList className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">What should I do next?</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Generate a case-specific investigator plan: what to preserve, what records to pull, who to interview, the exact questions to ask, contradictions to resolve, and what to retest after corrective action.
            </p>
            <Button type="button" onClick={generate} disabled={loading || !caseNotes.trim()} className="mt-3 h-9 text-xs">
              {loading ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Building my next steps...</> : <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Build My Next Steps</>}
            </Button>
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/25 bg-card overflow-hidden">
      <div className="p-4 bg-primary/5 border-b border-border">
        <div className="flex items-start gap-2.5">
          {plan.readyToClose ? <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" /> : <ClipboardList className="h-5 w-5 text-primary mt-0.5 shrink-0" />}
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">My Investigator Plan</p>
            <p className="text-sm text-foreground mt-1 leading-relaxed">{plan.bottomLine}</p>
            <div className={`mt-2 rounded-md px-3 py-2 text-xs ${plan.readyToClose ? "bg-success/10 text-success" : "bg-warning/10 text-foreground"}`}>
              <strong>{plan.readyToClose ? "Ready to close:" : "Keep investigating:"}</strong> {plan.closeoutReason}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-2">
        <PlanSection title="Do / preserve now" icon={ShieldAlert} items={plan.immediateActions} />
        <PlanSection title="Records or objective evidence to get" icon={FileSearch} items={plan.recordsToObtain} />
        <PlanSection title="People to interview" icon={Users} items={plan.peopleToInterview} />
        <PlanSection title="Questions to ask" icon={MessageSquareText} items={plan.interviewQuestions} />
        <PlanSection title="Contradictions to resolve" icon={AlertTriangle} items={plan.contradictionsToResolve} />
        <PlanSection title="Analysis checks before deciding" icon={ClipboardList} items={plan.analysisChecks} />
        <PlanSection title="Process / corrective-action ideas" icon={CheckCircle2} items={plan.correctiveActionIdeas} defaultOpen={false} />
        <PlanSection title="Retest / sustained-compliance plan" icon={RefreshCw} items={plan.retestPlan} defaultOpen={false} />

        <div className="pt-2 flex justify-end">
          <Button type="button" variant="ghost" onClick={generate} disabled={loading} className="h-8 text-[11px] text-muted-foreground">
            <RefreshCw className={`h-3 w-3 mr-1.5 ${loading ? "animate-spin" : ""}`} />Regenerate after notes change
          </Button>
        </div>
      </div>
    </div>
  );
}
