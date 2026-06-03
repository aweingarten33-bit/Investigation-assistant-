import type React from "react";
import { AnalysisResult, Decision, RiskLevel } from "@/lib/types";
import {
  Shield, FileText, ListChecks, Briefcase, AlertTriangle,
  Scale, BookOpen, Info, ChevronDown,
} from "lucide-react";
import { useState } from "react";

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

function Section({
  icon: Icon,
  title,
  children,
  defaultOpen = true,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 p-5 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

export function AnalysisResults({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-3 fade-in">
      {/* Classification Summary */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Classification</h3>
        </div>
        <div className="flex flex-wrap gap-3 mb-4">
          <span className={`inline-block rounded-md px-4 py-2 text-sm font-bold ${decisionStyles[result.decision]}`}>
            {decisionLabels[result.decision]}
          </span>
          <span className={`inline-block rounded-md border border-border px-4 py-2 text-sm font-bold ${riskStyles[result.riskLevel]}`}>
            {result.riskLevel.toUpperCase()} RISK
          </span>
          <span className="inline-block rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground">
            Confidence: {result.confidenceScore}%
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Violation Type:</span>{" "}
            <span className="text-foreground font-medium">{result.violationType}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Count:</span>{" "}
            <span className="text-foreground font-medium">{result.violationCount}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Recommendation:</span>{" "}
            <span className="text-foreground font-medium">{result.recommendationTier.replace(/_/g, " ")}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Notes:</span>{" "}
            <span className="text-foreground font-medium">{result.notesCompleteness}</span>
          </div>
        </div>
        {(result.aggravatingFactors.length > 0 || result.mitigatingFactors.length > 0) && (
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {result.aggravatingFactors.length > 0 && (
              <div>
                <span className="text-destructive font-medium text-xs uppercase tracking-wide">Aggravating</span>
                <ul className="mt-1 space-y-1">
                  {result.aggravatingFactors.map((f, i) => (
                    <li key={i} className="flex gap-2 text-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.mitigatingFactors.length > 0 && (
              <div>
                <span className="text-success font-medium text-xs uppercase tracking-wide">Mitigating</span>
                <ul className="mt-1 space-y-1">
                  {result.mitigatingFactors.map((f, i) => (
                    <li key={i} className="flex gap-2 text-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Missing Info Alert */}
      {result.missingInfo && result.missingInfo.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-warning">Missing Information</h3>
          </div>
          <ul className="space-y-1.5">
            {result.missingInfo.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Report Sections */}
      <Section icon={Info} title="I. Introduction">
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{result.introduction}</p>
      </Section>

      <Section icon={FileText} title="II. Incident Overview">
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{result.incidentOverview}</p>
      </Section>

      <Section icon={BookOpen} title="III. Incident Details">
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{result.incidentDetails}</p>
      </Section>

      <Section icon={Scale} title="IV. Investigation Findings">
        <ul className="space-y-2">
          {result.investigationFindings.map((finding, i) => (
            <li key={i} className="flex gap-2 text-sm text-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              {finding}
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={ListChecks} title="V. Recommendations">
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{result.recommendations}</p>
      </Section>

      {result.regulationsCited.length > 0 && (
        <Section icon={Briefcase} title="Regulations Cited" defaultOpen={false}>
          <ul className="space-y-1.5">
            {result.regulationsCited.map((reg, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {reg}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section icon={FileText} title="VI. Conclusion">
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{result.conclusion}</p>
      </Section>
    </div>
  );
}
