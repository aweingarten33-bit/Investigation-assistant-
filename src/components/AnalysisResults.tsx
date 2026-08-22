import type React from "react";
import { AnalysisResult } from "@/lib/types";
import { ClassificationSummary } from "@/components/ClassificationSummary";
import { NotifyChecklist } from "@/components/NotifyChecklist";
import {
  FileText, ListChecks, Briefcase, AlertTriangle,
  Scale, BookOpen, Info, ChevronDown,
} from "lucide-react";
import { useState } from "react";

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
      <ClassificationSummary classification={result} sources={result.sources} />

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

      {/* Who to notify */}
      {result.decision !== "needs_more_info" && (
        <div className="rounded-lg border border-border bg-card p-5">
          <NotifyChecklist decision={result.decision} />
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
