import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

// Live view of the two real analysis requests (server/routes/analyze-report.js):
// step "classify" (regulatory background + one AI call that maps evidence,
// tests competing explanations and runs the sufficiency checks) and step
// "report" (one AI call that writes the report). The server doesn't stream
// sub-steps, so each row is tied to its request's actual start/finish; no
// simulated progress.

export type ClassifySummary = {
  evidenceCount: number;
  findingCount: number;
  hypothesisCount: number;
};

type StageState = "pending" | "active" | "done";

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${seconds}s`;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function Stage({
  state,
  title,
  detail,
  startedAt,
  finishedAt,
  now,
}: {
  state: StageState;
  title: string;
  detail: string;
  startedAt: number | null;
  finishedAt: number | null;
  now: number;
}) {
  const elapsed = startedAt ? (finishedAt ?? now) - startedAt : null;
  return (
    <li className="flex gap-3">
      <div className="pt-0.5">
        {state === "done" ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : state === "active" ? (
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground/50" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`text-xs font-semibold ${state === "pending" ? "text-muted-foreground" : "text-foreground"}`}>{title}</p>
          {elapsed !== null && <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">{formatElapsed(elapsed)}</span>}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">{detail}</p>
      </div>
    </li>
  );
}

export function AnalysisProgress({
  step,
  classifyStartedAt,
  reportStartedAt,
  classifySummary,
}: {
  step: 1 | 2;
  classifyStartedAt: number | null;
  reportStartedAt: number | null;
  classifySummary: ClassifySummary | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const classifyDetail = step === 1
    ? "Reading your notes, pulling regulatory background, then one AI call that maps evidence to source lines, tests competing explanations, and runs the eight sufficiency checks. These happen together, so they finish together."
    : classifySummary
      ? `Mapped ${plural(classifySummary.evidenceCount, "evidence item")} into ${plural(classifySummary.findingCount, "finding")}; tested ${plural(classifySummary.hypothesisCount, "competing explanation")}; sufficiency checks complete.`
      : "Evidence mapped and sufficiency checks complete.";

  return (
    <div className="rounded-xl border border-border bg-background p-4" aria-live="polite">
      <ol className="space-y-3">
        <Stage
          state={step === 1 ? "active" : "done"}
          title="Analyzing the evidence"
          detail={classifyDetail}
          startedAt={classifyStartedAt}
          finishedAt={step === 2 ? reportStartedAt : null}
          now={now}
        />
        <Stage
          state={step === 2 ? "active" : "pending"}
          title="Writing the report"
          detail="One AI call drafts the report from your notes and the checked analysis. Findings are then tied back to the evidence."
          startedAt={step === 2 ? reportStartedAt : null}
          finishedAt={null}
          now={now}
        />
      </ol>
    </div>
  );
}
