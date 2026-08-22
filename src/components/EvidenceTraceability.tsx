import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileSearch,
  Gavel,
  Link2,
  Scale,
  ShieldQuestion,
} from "lucide-react";
import type {
  DisciplineFactor,
  DisciplineRange,
  EvidenceItem,
  TraceableFinding,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<TraceableFinding["evidenceStatus"], string> = {
  corroborated: "Corroborated",
  supported: "Supported",
  single_source: "Single source",
  contradicted: "Contradicted",
  insufficient: "Insufficient",
};

const STATUS_STYLES: Record<TraceableFinding["evidenceStatus"], string> = {
  corroborated: "border-success/30 bg-success/10 text-success",
  supported: "border-primary/30 bg-primary/10 text-primary",
  single_source: "border-warning/30 bg-warning/10 text-warning",
  contradicted: "border-orange-500/30 bg-orange-500/10 text-orange-600",
  insufficient: "border-destructive/30 bg-destructive/10 text-destructive",
};

const FACTOR_LABELS: Record<DisciplineFactor["factor"], string> = {
  intent: "Intent",
  role_expectations: "Role / access expectations",
  sensitivity: "Sensitivity of information",
  actual_harm: "Actual harm",
  potential_harm: "Potential harm",
  concealment: "Concealment",
  cooperation: "Cooperation",
  prior_discipline: "Prior discipline",
  prior_training: "Prior training",
  policy_language: "Policy language",
  precedent: "Organizational precedent",
  cba_union: "Union / CBA considerations",
  leadership_role: "Leadership role",
  retaliation: "Retaliation",
  personal_benefit: "Personal benefit",
  fraud: "Fraud",
  patient_safety: "Patient safety",
  regulatory_reporting: "Regulatory reporting",
};

function EvidenceCard({ evidence }: { evidence: EvidenceItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full p-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-start gap-2">
          {open ? <ChevronDown className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">{evidence.id}</span>
              <span className={cn(
                "text-[10px] rounded border px-1.5 py-0.5 font-medium",
                evidence.stance === "supports" && "border-success/30 bg-success/10 text-success",
                evidence.stance === "contradicts" && "border-orange-500/30 bg-orange-500/10 text-orange-600",
                evidence.stance === "context" && "border-border bg-muted text-muted-foreground",
              )}>
                {evidence.stance}
              </span>
            </div>
            <p className="text-xs font-medium text-foreground">{evidence.summary}</p>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <Link2 className="h-3 w-3 shrink-0" /> {evidence.reference}
            </p>
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">Exact source excerpt</p>
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">{evidence.excerpt || "[Blank source line]"}</pre>
        </div>
      )}
    </div>
  );
}

export function EvidenceTraceability({
  evidenceItems,
  findings,
  disciplineFactors,
  disciplineRange,
  policyQuestions,
}: {
  evidenceItems: EvidenceItem[];
  findings: TraceableFinding[];
  disciplineFactors: DisciplineFactor[];
  disciplineRange: DisciplineRange;
  policyQuestions: string[];
}) {
  const evidenceById = useMemo(() => new Map(evidenceItems.map((item) => [item.id, item])), [evidenceItems]);
  const [openFinding, setOpenFinding] = useState<string | null>(findings[0]?.id ?? null);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-2.5">
          <FileSearch className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Evidence Traceability</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Each finding is linked to exact line ranges from the notes. Open a finding, then open any evidence item to see the source excerpt the server reconstructed from those lines. Contradictory evidence stays visible.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {findings.length === 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-xs text-foreground">
            No traceable finding was produced. Treat the case as incomplete until evidence can be mapped to a finding.
          </div>
        )}
        {findings.map((finding) => {
          const open = openFinding === finding.id;
          const supporting = finding.supportingEvidenceIds.map((id) => evidenceById.get(id)).filter(Boolean) as EvidenceItem[];
          const contradicting = finding.contradictingEvidenceIds.map((id) => evidenceById.get(id)).filter(Boolean) as EvidenceItem[];
          return (
            <div key={finding.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenFinding(open ? null : finding.id)}
                className="w-full p-4 text-left hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {open ? <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground">{finding.id}</span>
                      <span className={cn("text-[10px] rounded border px-1.5 py-0.5 font-semibold", STATUS_STYLES[finding.evidenceStatus])}>
                        {STATUS_LABELS[finding.evidenceStatus]}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground leading-snug">{finding.statement}</p>
                  </div>
                </div>
              </button>

              {open && (
                <div className="border-t border-border p-4 space-y-4">
                  {finding.inference && (
                    <div className="rounded-lg bg-muted/30 p-3">
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">AI inference</p>
                      <p className="text-xs leading-relaxed text-foreground">{finding.inference}</p>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Supporting evidence — {supporting.length}</p>
                    </div>
                    <div className="space-y-2">
                      {supporting.map((item) => <EvidenceCard key={item.id} evidence={item} />)}
                      {supporting.length === 0 && <p className="text-xs text-muted-foreground">No supporting evidence is mapped to this finding.</p>}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Contradicting evidence — {contradicting.length}</p>
                    </div>
                    <div className="space-y-2">
                      {contradicting.map((item) => <EvidenceCard key={item.id} evidence={item} />)}
                      {contradicting.length === 0 && <p className="text-xs text-muted-foreground">No contradictory evidence is mapped to this finding.</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Gavel className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Corrective-action range</p>
            <p className="text-[11px] text-muted-foreground">A decision-support range, not an automatic punishment tied to risk or incident count.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="rounded-lg border border-border p-3"><p className="text-[10px] uppercase text-muted-foreground font-semibold">Minimum</p><p className="text-xs font-medium mt-1">{disciplineRange.minimum}</p></div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3"><p className="text-[10px] uppercase text-primary font-semibold">Recommended for review</p><p className="text-xs font-semibold mt-1">{disciplineRange.recommended}</p></div>
          <div className="rounded-lg border border-border p-3"><p className="text-[10px] uppercase text-muted-foreground font-semibold">Maximum</p><p className="text-xs font-medium mt-1">{disciplineRange.maximum}</p></div>
        </div>
        <p className="text-xs text-foreground leading-relaxed">{disciplineRange.rationale}</p>
        {(disciplineRange.policyDependent || disciplineRange.requiresHrLegalReview) && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
            <ShieldQuestion className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <p className="text-xs text-foreground">
              {disciplineRange.policyDependent ? "Organization policy, precedent, prior history, or CBA/union rules still matter before choosing an action. " : ""}
              {disciplineRange.requiresHrLegalReview ? "HR/Legal review is required before serious employment action." : ""}
            </p>
          </div>
        )}
      </div>

      {disciplineFactors.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3"><Scale className="h-4 w-4 text-muted-foreground" /><p className="text-sm font-semibold">Factors actually weighed</p></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {disciplineFactors.map((factor) => (
              <div key={factor.factor} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-foreground">{FACTOR_LABELS[factor.factor]}</p>
                  <span className={cn(
                    "text-[10px] rounded px-1.5 py-0.5 font-medium",
                    factor.impact === "aggravating" && "bg-destructive/10 text-destructive",
                    factor.impact === "mitigating" && "bg-success/10 text-success",
                    factor.impact === "neutral" && "bg-muted text-muted-foreground",
                    factor.impact === "unknown" && "bg-warning/10 text-warning",
                  )}>{factor.impact}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{factor.assessment}</p>
                {factor.evidenceIds.length > 0 && <p className="text-[10px] text-muted-foreground mt-1.5">Evidence: {factor.evidenceIds.join(", ")}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {policyQuestions.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
          <p className="text-xs font-semibold text-warning mb-2">Organization-specific questions before final action</p>
          <ul className="space-y-1.5">
            {policyQuestions.map((question, index) => <li key={index} className="text-xs text-foreground flex gap-2"><span>•</span><span>{question}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
