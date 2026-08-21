import { useEffect, useState } from "react";
import { Sparkles, FileText, Copy, Check, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

const LETTER_TYPES = [
  { value: "hr_referral", label: "HR Referral Memo", group: "Internal", description: "Send this to HR first — hands off your finding & recommendation" },
  { value: "verbal_counseling", label: "Verbal Counseling Memo", group: "Substantiated", description: "Level 1 — first-time minor violation" },
  { value: "written_warning", label: "Written Warning", group: "Substantiated", description: "Level 2 — repeat or moderate violation" },
  { value: "final_warning", label: "Final Warning / Suspension", group: "Substantiated", description: "Level 3 — serious violation" },
  { value: "termination", label: "Termination Letter", group: "Substantiated", description: "Level 4 — willful/pattern violation" },
  { value: "not_substantiated", label: "Not Substantiated Closure", group: "Closure", description: "Evidence doesn't support allegation" },
  { value: "unfounded", label: "Unfounded Closure", group: "Closure", description: "Evidence disproves allegation" },
  { value: "inconclusive", label: "Inconclusive Closure", group: "Closure", description: "Evidence genuinely split" },
  { value: "exoneration", label: "Exoneration Letter", group: "Closure", description: "Clear the subject completely" },
  { value: "reporter_update", label: "Reporter Update", group: "Communications", description: "Status update to the reporter" },
  { value: "regulatory_disclosure", label: "Self-Disclosure Template", group: "Regulatory", description: "OCR/OIG disclosure letter" },
];

const MAX_CASE_DETAILS_LENGTH = 20_000;

interface AILetterGeneratorProps {
  initialLetterType?: string;
  initialCaseDetails?: string;
}

export default function AILetterGenerator({ initialLetterType, initialCaseDetails }: AILetterGeneratorProps) {
  const [letterType, setLetterType] = useState(initialLetterType ?? "");
  const [caseDetails, setCaseDetails] = useState(initialCaseDetails ?? "");
  const [result, setResult] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  // Re-sync if a prefill arrives after mount (e.g. navigating here from a
  // freshly generated report).
  useEffect(() => {
    if (initialLetterType) setLetterType(initialLetterType);
    if (initialCaseDetails) setCaseDetails(initialCaseDetails);
  }, [initialLetterType, initialCaseDetails]);

  const selectedType = LETTER_TYPES.find(t => t.value === letterType);

  const generate = async () => {
    if (!letterType || !caseDetails.trim()) {
      toast.error("Select a letter type and enter case details");
      return;
    }
    if (caseDetails.length > MAX_CASE_DETAILS_LENGTH) {
      toast.error("Case details are too long. Please shorten to under 20,000 characters.");
      return;
    }
    if (!isSupabaseConfigured) {
      toast.error("Service is not configured. Please contact the administrator.");
      return;
    }

    setIsGenerating(true);
    setResult("");

    try {
      const { data, error } = await supabase.functions.invoke("investigation-toolkit", {
        body: { mode: "generate_letter", letterType, caseDetails: caseDetails.trim() },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setResult(data.text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate letter");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success("Letter copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const groups = ["Internal", "Substantiated", "Closure", "Communications", "Regulatory"];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">AI Letter Generator</p>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">AI-Powered</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Enter your case details and select a letter type. AI will draft a professional, ready-to-review letter.
      </p>

      <div className="relative">
        <button
          onClick={() => setShowTypeSelector(!showTypeSelector)}
          className={cn(
            "w-full flex items-center justify-between px-3 py-2.5 rounded-md border text-sm text-left transition-colors",
            letterType ? "border-primary/30 bg-primary/5" : "border-border bg-background hover:bg-secondary/30"
          )}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            {selectedType ? (
              <div>
                <span className="font-medium">{selectedType.label}</span>
                <span className="text-muted-foreground ml-2 text-xs">— {selectedType.description}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Select letter type…</span>
            )}
          </div>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showTypeSelector && "rotate-180")} />
        </button>

        {showTypeSelector && (
          <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-72 overflow-y-auto">
            {groups.map(group => {
              const items = LETTER_TYPES.filter(t => t.group === group);
              if (!items.length) return null;
              return (
                <div key={group}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-2 pb-1">{group}</p>
                  {items.map(item => (
                    <button
                      key={item.value}
                      onClick={() => { setLetterType(item.value); setShowTypeSelector(false); }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 transition-colors",
                        letterType === item.value && "bg-primary/10 text-primary"
                      )}
                    >
                      <span className="font-medium">{item.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">— {item.description}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Textarea
        placeholder="Describe the case details: what happened, who was involved, when it occurred, what evidence was found, any prior history of violations…"
        value={caseDetails}
        onChange={e => setCaseDetails(e.target.value)}
        className="min-h-[120px] text-sm"
      />

      <Button onClick={generate} disabled={isGenerating || !letterType || !caseDetails.trim()} className="w-full sm:w-auto">
        {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
        {isGenerating ? "Generating…" : "Generate Letter"}
      </Button>

      {(result || isGenerating) && (
        <div className="relative border border-border rounded-lg bg-muted/30">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <p className="text-xs font-semibold text-foreground">Generated Letter</p>
            <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!result} className="h-7 text-xs">
              {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="px-4 py-3 prose prose-sm dark:prose-invert max-w-none text-sm max-h-[400px] overflow-y-auto">
            {result ? <ReactMarkdown>{result}</ReactMarkdown> : (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Generating letter…</span>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        AI-drafted letters are a starting point — review with HR/Legal before sending.
      </p>
    </div>
  );
}
