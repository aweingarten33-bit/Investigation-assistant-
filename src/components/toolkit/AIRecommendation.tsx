import { useState } from "react";
import { Sparkles, Gavel, Loader2, Mail, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
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
    if (!isSupabaseConfigured) {
      toast.error("Service is not configured. Please contact the administrator.");
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-report", {
        body: { reportText: trimmed, step: "classify" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setResult(data.classification);
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
        An AI-generated recommendation, not a final decision — review with HR/Legal before acting, especially for
        anything beyond re-education.
      </p>
    </div>
  );
}
