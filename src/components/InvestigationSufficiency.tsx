import { AnalysisResult, ClosureStatus, HypothesisState, SufficiencyCheckStatus } from "@/lib/types";
import { AlertTriangle, CheckCircle2, CircleHelp, GitBranch, LockKeyhole, SearchCheck, XCircle } from "lucide-react";

const closureMeta: Record<ClosureStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  ready_to_close: {
    label: "READY TO CLOSE",
    className: "border-success/30 bg-success/5 text-success",
    icon: CheckCircle2,
  },
  not_ready_to_close: {
    label: "NOT READY TO CLOSE",
    className: "border-warning/30 bg-warning/5 text-warning",
    icon: AlertTriangle,
  },
  ready_with_unresolved_limitations: {
    label: "READY WITH UNRESOLVED LIMITATIONS",
    className: "border-primary/30 bg-primary/5 text-primary",
    icon: CircleHelp,
  },
};

const hypothesisLabels: Record<HypothesisState, string> = {
  supported: "Supported",
  partially_supported: "Partially supported",
  weakened: "Weakened",
  unresolved: "Unresolved",
  contradicted: "Contradicted",
};

const checkLabels: Record<AnalysisResult["sufficiencyChecks"][number]["id"], string> = {
  finding_support: "Finding support",
  contradictory_evidence: "Contradictory evidence",
  objective_records: "Objective records",
  key_witnesses: "Key witnesses",
  material_inconsistencies: "Material inconsistencies",
  policy_regulatory_context: "Policy / regulatory context",
  standard_of_proof: "Standard of proof",
  reporting_escalation: "Reporting / escalation",
};

function CheckIcon({ status }: { status: SufficiencyCheckStatus }) {
  if (status === "satisfied") return <CheckCircle2 className="h-4 w-4 text-success shrink-0" />;
  if (status === "unresolved") return <AlertTriangle className="h-4 w-4 text-warning shrink-0" />;
  return <CircleHelp className="h-4 w-4 text-muted-foreground shrink-0" />;
}

export function InvestigationSufficiency({ result }: { result: AnalysisResult }) {
  const closure = closureMeta[result.closureAssessment.status];
  const ClosureIcon = closure.icon;
  const evidenceById = new Map(result.evidenceItems.map((item) => [item.id, item]));

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="p-5 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <SearchCheck className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Investigation Sufficiency Engine</h3>
            </div>
            <p className="text-sm text-foreground">Competing hypotheses, closure checks, and the evidence that could still change the conclusion.</p>
          </div>
          <div className={`shrink-0 rounded-md border px-2.5 py-1.5 text-[10px] font-bold tracking-wide ${closure.className}`}>
            <span className="inline-flex items-center gap-1.5"><ClosureIcon className="h-3.5 w-3.5" />{closure.label}</span>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-foreground">{result.closureAssessment.rationale}</p>
      </div>

      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Competing Hypotheses</h4>
        </div>
        <div className="space-y-3">
          {result.hypotheses.map((hypothesis) => (
            <div key={hypothesis.id} className="rounded-md border border-border bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{hypothesis.id} — {hypothesis.label}</p>
                  <p className="mt-1 text-sm text-foreground/90">{hypothesis.description}</p>
                </div>
                <span className="shrink-0 rounded-full bg-background border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                  {hypothesisLabels[hypothesis.state]}
                </span>
              </div>

              {(hypothesis.supportingEvidenceIds.length > 0 || hypothesis.contradictingEvidenceIds.length > 0) && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Supports</p>
                    <div className="flex flex-wrap gap-1">
                      {hypothesis.supportingEvidenceIds.length > 0 ? hypothesis.supportingEvidenceIds.map((id) => (
                        <span key={id} title={evidenceById.get(id)?.summary} className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">{id}</span>
                      )) : <span className="text-xs text-muted-foreground">None mapped</span>}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Contradicts</p>
                    <div className="flex flex-wrap gap-1">
                      {hypothesis.contradictingEvidenceIds.length > 0 ? hypothesis.contradictingEvidenceIds.map((id) => (
                        <span key={id} title={evidenceById.get(id)?.summary} className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">{id}</span>
                      )) : <span className="text-xs text-muted-foreground">None mapped</span>}
                    </div>
                  </div>
                </div>
              )}

              {hypothesis.unresolvedQuestions.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Unresolved questions</p>
                  <ul className="space-y-1">
                    {hypothesis.unresolvedQuestions.map((question, index) => (
                      <li key={index} className="text-xs text-foreground flex gap-2"><span>•</span><span>{question}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <LockKeyhole className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence Sufficiency / Closure Gate</h4>
        </div>
        <div className="space-y-2">
          {result.sufficiencyChecks.map((check) => (
            <div key={check.id} className="rounded-md border border-border px-3 py-2.5">
              <div className="flex items-start gap-2">
                <CheckIcon status={check.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{checkLabels[check.id]}</p>
                    {check.material && <span className="rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning">Material</span>}
                    {check.status === "unresolved" && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {check.resolvable ? "Still investigable" : "Cannot reasonably resolve"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-foreground/90">{check.rationale}</p>
                  {check.status === "unresolved" && check.nextAction && (
                    <p className="mt-1.5 text-xs text-muted-foreground"><span className="font-semibold">Next:</span> {check.nextAction}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {result.closureAssessment.whatWouldChangeConclusion.length > 0 && (
        <div className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What Could Change This Conclusion?</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3">A challenge check: evidence that could materially weaken, reverse, or otherwise change the present finding.</p>
          <div className="space-y-2">
            {result.closureAssessment.whatWouldChangeConclusion.map((factor, index) => (
              <div key={index} className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-sm font-medium text-foreground">{factor.description}</p>
                <p className="mt-1 text-xs text-muted-foreground"><span className="font-semibold text-foreground/80">Evidence needed:</span> {factor.evidenceNeeded}</p>
                <p className="mt-1 text-xs text-muted-foreground"><span className="font-semibold text-foreground/80">Potential impact:</span> {factor.impact}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}