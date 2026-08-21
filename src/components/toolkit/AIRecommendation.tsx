import { useState } from "react";
import { Sparkles, Gavel, Loader2, Mail, AlertTriangle, ShieldAlert, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { callApi } from "@/lib/api";
import { ClassificationSummary, Classification } from "@/components/ClassificationSummary";
import { NotifyChecklist } from "@/components/NotifyChecklist";
import { disciplineLevelForTier } from "@/lib/discipline-levels";
import { suggestLetterType, buildLetterPrefillFromClassification, letterButtonLabel } from "@/lib/letter-prefill";
import { cn } from "@/lib/utils";

const MIN_LENGTH = 50;
const MAX_LENGTH = 100_000;

interface ClassifyResponse extends Classification {
  missingElements: string[];
}

interface AIRecommendationProps {
  onDraftLetter: (letterType: string | undefined, caseDetails: string) => void;
}

export default function AIRecommendation({ onDraftLetter }: AIRecommendationProps) {
  const [caseFacts, setCaseFacts] = useState("");
  const [result, setResult] = useState<ClassifyResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showGovernance, setShowGovernance] = useState(false);

  const analyze = async () => {
    const trimmed = caseFacts.trim();
    if (!trimmed) {
      toast.error("Enter what your investigation found");
      return;
    }
    if (trimmed.length < MIN_LENGTH) {
      toast.error("Please provide more detail before asking for a recommendation.");
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      toast.error("Notes are too long. Please shorten them to under 100,000 characters.");
      return;
    }
    setIsAnalyzing(true);
    setResult(null);

    try {
      const { data, error } = await callApi<{ classification: ClassifyResponse }>("analyze-report", { reportText: trimmed, step: "classify" });
      if (error) throw error;
      setResult(data!.classification);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to get a recommendation");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const level = result?.decision === "substantiated" ? disciplineLevelForTier(result.recommendationTier) : null;
  const suggestedLetterType = result ? suggestLetterType(result) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">AI Recommendation</p>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">AI-Powered</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Done investigating and have no idea what to recommend, or who to even tell? Paste in everything you
        found — evidence, interview notes, prior history — and this will tell you whether it's substantiated,
        exactly what disciplinary action to take (re-education, written warning, final warning, or termination),
        and who to notify first. This is the same engine that drives the Report Generator on the home page, so
        the recommendation matches what a full report would conclude.
      </p>

      <div className="rounded-lg border border-border overflow-hidden">
        <button
          onClick={() => setShowGovernance(!showGovernance)}
          className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-muted/30 transition-colors"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-foreground flex-1">
            Using AI to recommend discipline? Know the rules before you rely on it.
          </span>
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform", showGovernance && "rotate-180")} />
        </button>
        {showGovernance && (
          <div className="border-t border-border px-3.5 py-3 bg-muted/20">
            <ul className="space-y-1.5 text-[11px] text-foreground/80">
              <li>
                • <strong className="text-foreground">A person has to actually read and weigh this</strong>, not
                just click through it — treating an AI output as the automated decision itself is the single
                biggest legal exposure across every current framework (Colorado's AI Act treats employment AI as
                "high-risk"; every regime leans on genuine human review as the core safeguard).
              </li>
              <li>
                • <strong className="text-foreground">Some states now require telling the employee AI was used</strong>{" "}
                in a decision about them — e.g., Illinois, as of January 1, 2026. Check whether that applies before
                you act on a recommendation.
              </li>
              <li>
                • <strong className="text-foreground">NYC requires annual independent bias audits</strong> for tools
                that meaningfully help make hiring, promotion, or discipline decisions — relevant if you start using
                a tool like this routinely rather than case-by-case.
              </li>
              <li>
                • <strong className="text-foreground">Federal EEOC enforcement of AI disparate-impact claims has
                been deprioritized</strong>, but private lawsuits haven't gone away (see <em>Mobley v. Workday</em>),
                and employers stay liable for what a third-party AI tool recommends — including this one.
              </li>
              <li>
                • If you rely on this regularly, <strong className="text-foreground">periodically check whether its
                recommendations skew by protected characteristics</strong> — that pattern is itself a legal risk,
                independent of intent.
              </li>
            </ul>
          </div>
        )}
      </div>

      <Textarea
        placeholder="Summarize what your investigation found: what happened, who was involved, what evidence you collected, what witnesses/the subject said, any prior violations…"
        value={caseFacts}
        onChange={(e) => setCaseFacts(e.target.value)}
        className="min-h-[160px] text-sm"
      />

      <Button onClick={analyze} disabled={isAnalyzing || !caseFacts.trim()} className="w-full sm:w-auto">
        {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gavel className="w-4 h-4 mr-2" />}
        {isAnalyzing ? "Reviewing…" : "Get Recommendation"}
      </Button>

      {result && (
        <div className="space-y-3">
          <ClassificationSummary classification={result} />

          {result.decision === "needs_more_info" ? (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-warning/10 border border-warning/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div className="text-xs text-foreground/90">
                <p className="font-semibold mb-1">Not enough to recommend an action yet.</p>
                {result.missingElements.length > 0 && (
                  <ul className="space-y-0.5">
                    {result.missingElements.map((m, i) => (
                      <li key={i}>• {m}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : level ? (
            <div className={cn("rounded-lg border p-4", level.border, level.bg)}>
              <p className={cn("text-sm font-bold mb-1", level.color)}>{level.title}</p>
              <p className="text-xs text-muted-foreground mb-3">{level.when}</p>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">What to do</p>
              <ul className="space-y-1.5">
                {level.whatToDo.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                    <span className="text-muted-foreground mt-0.5 shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-xs text-foreground/90">
              Not substantiated — document your finding and close the investigation once you've told the people below.
            </div>
          )}

          {result.decision !== "needs_more_info" && (
            <>
              <NotifyChecklist decision={result.decision} />
              <button
                onClick={() => onDraftLetter(
                  suggestedLetterType,
                  buildLetterPrefillFromClassification(result, caseFacts),
                )}
                className="w-full flex items-center justify-center gap-1.5 h-9 text-xs font-medium text-primary hover:text-primary/80 transition-colors rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10"
              >
                <Mail className="h-3.5 w-3.5" />
                {letterButtonLabel(suggestedLetterType)}
              </button>
            </>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        An AI-generated recommendation, not a final decision. A person must meaningfully review it — and HR/Legal
        must sign off — before anything beyond re-education happens.
      </p>
    </div>
  );
}
