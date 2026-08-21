import { useState } from "react";
import { Sparkles, Search, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

const MAX_CASE_FACTS_LENGTH = 20_000;

export default function AICaseAnalysis() {
  const [caseFacts, setCaseFacts] = useState("");
  const [result, setResult] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);

  const analyze = async () => {
    if (!caseFacts.trim()) {
      toast.error("Enter the case facts to analyze");
      return;
    }
    if (caseFacts.length > MAX_CASE_FACTS_LENGTH) {
      toast.error("Case facts are too long. Please shorten to under 20,000 characters.");
      return;
    }
    if (!isSupabaseConfigured) {
      toast.error("Service is not configured. Please contact the administrator.");
      return;
    }

    setIsAnalyzing(true);
    setResult("");

    try {
      const { data, error } = await supabase.functions.invoke("investigation-toolkit", {
        body: { mode: "case_analysis", caseFacts: caseFacts.trim() },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setResult(data.text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to analyze case");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success("Analysis copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">AI Case Analysis</p>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">AI-Powered</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Paste your case facts below for a quick preliminary read — root cause, applicable HIPAA regulations, risk level, and suggested next steps. Useful early in an investigation, before you have enough for a full report.
      </p>

      <Textarea
        placeholder="Enter the facts of the case: what happened, who was involved, dates, what evidence exists, any relevant context (department, prior incidents, patient impact)…"
        value={caseFacts}
        onChange={e => setCaseFacts(e.target.value)}
        className="min-h-[140px] text-sm"
      />

      <Button onClick={analyze} disabled={isAnalyzing || !caseFacts.trim()} className="w-full sm:w-auto">
        {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
        {isAnalyzing ? "Analyzing…" : "Analyze Case"}
      </Button>

      {(result || isAnalyzing) && (
        <div className="relative border border-border rounded-lg bg-muted/30">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <p className="text-xs font-semibold text-foreground">Case Analysis</p>
            <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!result} className="h-7 text-xs">
              {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="px-4 py-3 prose prose-sm dark:prose-invert max-w-none text-sm max-h-[400px] overflow-y-auto">
            {result ? <ReactMarkdown>{result}</ReactMarkdown> : (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Analyzing…</span>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        A preliminary read, not a substitute for the full investigation — use the Report Generator once your notes are complete.
      </p>
    </div>
  );
}
