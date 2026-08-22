import { useMemo, useState } from "react";
import {
  Sparkles, Gavel, Loader2, Mail, AlertTriangle, ShieldAlert,
  ChevronDown, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { callApi } from "@/lib/api";
import { ClassificationSummary, Classification } from "@/components/ClassificationSummary";
import { EvidenceTraceability } from "@/components/EvidenceTraceability";
import { OrganizationDisciplineMatrix } from "@/components/OrganizationDisciplineMatrix";
import { NotifyChecklist } from "@/components/NotifyChecklist";
import { suggestLetterType, buildLetterPrefillFromClassification, letterButtonLabel } from "@/lib/letter-prefill";
import {
  buildOrganizationContext,
  EMPTY_ORGANIZATION_DISCIPLINE_CONFIG,
  type OrganizationDisciplineConfig,
} from "@/lib/organization-context";
import { cn } from "@/lib/utils";
import { Source } from "@/lib/types";

const MIN_LENGTH = 50;
const MAX_LENGTH = 100_000;
const MAX_ORG_CONTEXT = 20_000;

interface ClassifyResponse extends Classification {
  missingElements: string[];
}

interface AIRecommendationProps {
  onDraftLetter: (letterType: string | undefined, caseDetails: string) => void;
}

export default function AIRecommendation({ onDraftLetter }: AIRecommendationProps) {
  const [caseFacts, setCaseFacts] = useState("");
  const [organizationConfig, setOrganizationConfig] = useState<OrganizationDisciplineConfig>({ ...EMPTY_ORGANIZATION_DISCIPLINE_CONFIG });
  const [result, setResult] = useState<ClassifyResponse | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showGovernance, setShowGovernance] = useState(false);
  const [showOrgContext, setShowOrgContext] = useState(false);

  const organizationContext = useMemo(() => buildOrganizationContext(organizationConfig), [organizationConfig]);

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
    if (organizationContext.length > MAX_ORG_CONTEXT) {
      toast.error("Optional policy / discipline context must be under 20,000 characters.");
      return;
    }

    setIsAnalyzing(true);
    setResult(null);
    setSources([]);

    try {
      const { data, error } = await callApi<{ classification: ClassifyResponse; sources?: Source[] }>("analyze-report", {
        reportText: trimmed,
        organizationContext: organizationContext.trim(),
        step: "classify",
      });
      if (error) throw error;
      setResult(data!.classification);
      setSources(data!.sources || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to analyze the case");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const suggestedLetterType = result ? suggestLetterType(result) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">AI Recommendation</p>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">AI-Powered</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Paste what your investigation found. The AI recommends a defensible finding and corrective-action range while showing
        the actual evidence, contradictory evidence, and the reasoning it used so you can decide whether you agree.
      </p>

      <div className="rounded-lg border border-border overflow-hidden">
        <button
          onClick={() => setShowGovernance(!showGovernance)}
          className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-muted/30 transition-colors"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-foreground flex-1">Using AI in employee discipline? Know the limits before relying on it.</span>
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform", showGovernance && "rotate-180")} />
        </button>
        {showGovernance && (
          <div className="border-t border-border px-3.5 py-3 bg-muted/20">
            <ul className="space-y-1.5 text-[11px] text-foreground/80">
              <li>• <strong className="text-foreground">Meaningful human review is mandatory for this workflow.</strong> Treat the output as evidence organization and decision support, not the decision itself.</li>
              <li>• <strong className="text-foreground">Illinois employment AI rules effective January 1, 2026 cover discipline and include employee-notice requirements.</strong> Verify the circumstances, timing, and means of notice under the law and implementing rules that apply to your use.</li>
              <li>• <strong className="text-foreground">NYC Local Law 144 is narrower than a general discipline rule:</strong> its defined employment decision covers screening candidates for employment or employees for promotion. Other anti-discrimination laws can still apply to AI-assisted discipline.</li>
              <li>• <strong className="text-foreground">Do not use protected characteristics as discipline factors.</strong> Periodically test outcomes for disparate-impact patterns and document human overrides/review.</li>
              <li>• <strong className="text-foreground">Organization policy controls.</strong> Past practice, HR rules, CBA obligations, prior discipline, training, role expectations, and legal review can change the appropriate outcome even when the underlying facts are identical.</li>
            </ul>
          </div>
        )}
      </div>

      <Textarea
        placeholder="Paste the investigation record: evidence, interview notes, audit/access logs, policy facts, prior history actually documented, and any contradictory evidence…"
        value={caseFacts}
        onChange={(e) => setCaseFacts(e.target.value)}
        className="min-h-[180px] text-sm"
      />

      <div className="rounded-lg border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => setShowOrgContext(!showOrgContext)}
          className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-muted/30 transition-colors"
        >
          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-foreground flex-1">Optional policy / discipline context</span>
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform", showOrgContext && "rotate-180")} />
        </button>
        {showOrgContext && (
          <div className="border-t border-border p-3 bg-muted/10 space-y-2">
            <OrganizationDisciplineMatrix config={organizationConfig} onChange={setOrganizationConfig} maxCharacters={MAX_ORG_CONTEXT} />
            <p className="text-[10px] text-muted-foreground text-right">Optional decision context: {organizationContext.length.toLocaleString()} / {MAX_ORG_CONTEXT.toLocaleString()}</p>
          </div>
        )}
      </div>

      <Button onClick={analyze} disabled={isAnalyzing || !caseFacts.trim()} className="w-full sm:w-auto">
        {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gavel className="w-4 h-4 mr-2" />}
        {isAnalyzing ? "Analyzing evidence…" : "Get Recommendation"}
      </Button>

      {result && (
        <div className="space-y-3">
          <ClassificationSummary classification={result} sources={sources} />

          {result.decision === "needs_more_info" && (
            <div className="flex items-start gap-2.5 px-4 py-3 bg-warning/10 border border-warning/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div className="text-xs text-foreground/90">
                <p className="font-semibold mb-1">Not enough evidence to make a defensible finding yet.</p>
                {result.missingElements.length > 0 && (
                  <ul className="space-y-0.5">{result.missingElements.map((m, i) => <li key={i}>• {m}</li>)}</ul>
                )}
              </div>
            </div>
          )}

          <EvidenceTraceability
            evidenceItems={result.evidenceItems}
            findings={result.findings}
            disciplineFactors={result.disciplineFactors}
            disciplineRange={result.disciplineRange}
            policyQuestions={result.policyQuestions}
          />

          {result.decision !== "needs_more_info" && (
            <>
              <NotifyChecklist decision={result.decision} />
              <button
                onClick={() => onDraftLetter(suggestedLetterType, buildLetterPrefillFromClassification(result, caseFacts))}
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
        AI recommendation and evidence analysis only. Verify the source excerpts and apply your actual policy, precedent, and HR/Legal review before serious employment action.
      </p>
    </div>
  );
}