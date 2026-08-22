import { AnalysisResult, Decision, RiskLevel, Source } from "@/lib/types";
import { Shield, Globe, AlertTriangle } from "lucide-react";

const decisionStyles: Record<Decision, string> = {
  substantiated: "bg-destructive text-destructive-foreground",
  unsubstantiated: "bg-success text-success-foreground",
  needs_more_info: "bg-warning text-warning-foreground",
};

const decisionLabels: Record<Decision, string> = {
  substantiated: "SUBSTANTIATED",
  unsubstantiated: "UNSUBSTANTIATED",
  needs_more_info: "NEEDS MORE INFO",
};

const riskStyles: Record<RiskLevel, string> = {
  low: "text-success",
  moderate: "text-warning",
  high: "text-destructive",
  critical: "text-destructive font-black",
};

export type Classification = Pick<
  AnalysisResult,
  "decision" | "confidenceScore" | "riskLevel" | "violationType" | "violationCount" |
  "recommendationTier" | "aggravatingFactors" | "mitigatingFactors" | "notesCompleteness" |
  "evidenceItems" | "findings" | "disciplineFactors" | "disciplineRange" | "policyQuestions"
> & { missingElements?: string[] };

export function ClassificationSummary({ classification, sources }: { classification: Classification; sources?: Source[] }) {
  const c = classification;
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision Support</h3>
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <span className={`inline-block rounded-md px-4 py-2 text-sm font-bold ${decisionStyles[c.decision]}`}>
          {decisionLabels[c.decision]}
        </span>
        <span className={`inline-block rounded-md border border-border px-4 py-2 text-sm font-bold ${riskStyles[c.riskLevel]}`}>
          {c.riskLevel.toUpperCase()} RISK
        </span>
        <span className="inline-block rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground">
          Confidence: {c.confidenceScore}%
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Issue Type:</span>{" "}<span className="text-foreground font-medium">{c.violationType}</span></div>
        <div><span className="text-muted-foreground">Count:</span>{" "}<span className="text-foreground font-medium">{c.violationCount}</span></div>
        <div><span className="text-muted-foreground">Evidence-mapped findings:</span>{" "}<span className="text-foreground font-medium">{c.findings.length}</span></div>
        <div><span className="text-muted-foreground">Notes:</span>{" "}<span className="text-foreground font-medium">{c.notesCompleteness}</span></div>
      </div>

      <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <p className="text-[10px] uppercase tracking-wide font-semibold text-primary mb-1">Corrective action recommended for review</p>
        <p className="text-sm font-semibold text-foreground">{c.disciplineRange.recommended}</p>
        <p className="text-xs text-muted-foreground mt-1">Range: {c.disciplineRange.minimum} → {c.disciplineRange.maximum}</p>
      </div>

      {c.disciplineRange.policyDependent && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <p className="text-xs text-foreground">Final action depends on organization-specific policy, precedent, prior history, or CBA/union rules. Review the open questions below the evidence map before acting.</p>
        </div>
      )}

      {(c.aggravatingFactors.length > 0 || c.mitigatingFactors.length > 0) && (
        <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {c.aggravatingFactors.length > 0 && (
            <div>
              <span className="text-destructive font-medium text-xs uppercase tracking-wide">Aggravating</span>
              <ul className="mt-1 space-y-1">{c.aggravatingFactors.map((f, i) => <li key={i} className="flex gap-2 text-foreground"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />{f}</li>)}</ul>
            </div>
          )}
          {c.mitigatingFactors.length > 0 && (
            <div>
              <span className="text-success font-medium text-xs uppercase tracking-wide">Mitigating</span>
              <ul className="mt-1 space-y-1">{c.mitigatingFactors.map((f, i) => <li key={i} className="flex gap-2 text-foreground"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />{f}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {sources && sources.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-1.5 mb-2">
            <Globe className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground font-medium text-xs uppercase tracking-wide">Current regulatory context consulted — {sources.length} source{sources.length === 1 ? "" : "s"}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mb-2">These sources inform regulatory context only. They are not evidence in this case and do not independently validate a disciplinary action.</p>
          <ul className="space-y-1">
            {sources.map((s, i) => (
              <li key={i} className="text-xs truncate"><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">{s.title}</a></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
