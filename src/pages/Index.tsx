import { useState, useCallback, useRef } from "react";
import mammoth from "mammoth";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/UploadZone";
import { AnalysisResults } from "@/components/AnalysisResults";
import { PiiReminder } from "@/components/PiiReminder";
import { Disclaimer } from "@/components/Disclaimer";
import { exportToDocx } from "@/lib/docx-export";
import { AnalysisResult } from "@/lib/types";
import { SAMPLE_REPORT_TEXT } from "@/lib/sample-report";
import { Loader2, Download, Sparkles, FileText, RotateCcw, XCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const MIN_REPORT_LENGTH = 50;
const MAX_REPORT_LENGTH = 100_000;

const Index = () => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [reportText, setReportText] = useState<string>("");
  const [isSample, setIsSample] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState<0 | 1 | 2>(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  // Monotonic run id: each analysis gets a unique id so a stale async run
  // (after cancel/reset) can never stomp the state of a newer run.
  const runIdRef = useRef(0);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const handleReset = useCallback(() => {
    setReportText("");
    setFileName(null);
    setFileSize(null);
    setIsSample(false);
    setResult(null);
    runIdRef.current++; // invalidate any in-flight analysis
    setIsAnalyzing(false);
    setAnalyzeStep(0);
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (!file.name.endsWith(".docx")) {
      toast.error("Only .docx files are supported.");
      return;
    }
    // Defense-in-depth: reject files whose MIME type contradicts the .docx
    // extension (a renamed payload). Empty type is allowed (some OSes omit it).
    if (file.type && file.type !== DOCX_MIME) {
      toast.error("Only .docx files are supported.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File exceeds 10MB limit.");
      return;
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { value } = await mammoth.extractRawText({ arrayBuffer });
      setReportText(value);
      setFileName(file.name);
      setFileSize(formatSize(file.size));
      setIsSample(false);
      setResult(null);
    } catch {
      toast.error("Failed to extract text from file.");
    }
  }, []);

  const handleTextChange = useCallback((text: string) => {
    setReportText(text);
    setFileName(null);
    setFileSize(null);
    setIsSample(false);
    setResult(null);
  }, []);

  const handleUseSample = useCallback(() => {
    setReportText(SAMPLE_REPORT_TEXT);
    setFileName(null);
    setFileSize(null);
    setIsSample(true);
    setResult(null);
  }, []);

  const handleCancel = useCallback(() => {
    runIdRef.current++; // invalidate the in-flight analysis
    setIsAnalyzing(false);
    setAnalyzeStep(0);
    toast.info("Analysis cancelled.");
  }, []);

  const handleAnalyze = useCallback(async () => {
    const trimmedReportText = reportText.trim();
    if (!trimmedReportText) return;

    if (trimmedReportText.length < MIN_REPORT_LENGTH) {
      toast.error("Please provide more detail before generating a report.");
      return;
    }

    if (trimmedReportText.length > MAX_REPORT_LENGTH) {
      toast.error("Notes are too long. Please shorten them to under 100,000 characters.");
      return;
    }

    if (!isSupabaseConfigured) {
      toast.error("Service is not configured. Please contact the administrator.");
      return;
    }

    const myRunId = ++runIdRef.current;
    setIsAnalyzing(true);
    setResult(null);
    setAnalyzeStep(1);

    try {
      const { data: classifyData, error: classifyError } = await supabase.functions.invoke("analyze-report", {
        body: { reportText: trimmedReportText, step: "classify" },
      });
      if (runIdRef.current !== myRunId) return;
      if (classifyError) throw classifyError;
      if (classifyData.error) throw new Error(classifyData.error);

      const classification = classifyData.classification;
      const signature = classifyData.signature;
      setAnalyzeStep(2);

      const { data: reportData, error: reportError } = await supabase.functions.invoke("analyze-report", {
        body: { reportText: trimmedReportText, step: "report", classification, signature },
      });
      if (runIdRef.current !== myRunId) return;
      if (reportError) throw reportError;
      if (reportData.error) throw new Error(reportData.error);

      const caseMatch = trimmedReportText.match(/Case\s*#?\s*([\w-]+)/i);
      const caseId = caseMatch ? caseMatch[1] : new Date().toISOString().split("T")[0];

      setResult({ ...reportData, caseId });
      toast.success("Analysis complete — report generated.");
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
    } catch (e: any) {
      if (runIdRef.current === myRunId) {
        toast.error(e.message || "Analysis failed. Please try again.");
      }
    } finally {
      if (runIdRef.current === myRunId) {
        setIsAnalyzing(false);
        setAnalyzeStep(0);
      }
    }
  }, [reportText]);

  const handleExport = useCallback(async () => {
    if (!result) return;
    try {
      await exportToDocx(result);
      toast.success("Word document exported successfully.");
    } catch {
      toast.error("Failed to export Word document. Please try again.");
    }
  }, [result]);

  const hasContent = reportText.trim().length > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[720px] px-4 py-3 sm:py-10">

        {/* Results view */}
        {result ? (
          <>
            {/* Sticky export bar */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border -mx-4 px-4 py-3 mb-4">
              <div className="flex gap-3">
                <Button onClick={handleExport} className="flex-1 h-11 text-sm font-semibold">
                  <Download className="mr-2 h-4 w-4" />
                  Export to Word
                </Button>
                <Button onClick={handleReset} variant="outline" className="h-11 text-sm">
                  New Analysis
                </Button>
              </div>
            </div>
            <AnalysisResults result={result} />
          </>
        ) : (
          <>
            {/* ===== SINGLE UNIFIED CARD ===== */}
            <div className="rounded-2xl bg-background neu-raised overflow-hidden">

              {/* Card Header */}
              <div className="px-5 pt-4 pb-3 border-b border-border">
                <h1 className="text-base sm:text-xl font-bold text-foreground mb-0.5">
                  Compliance & Privacy Investigation Assistant
                </h1>
              <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
                  Paste or upload your investigation notes to generate a Summary Investigative Report.
                </p>
                <PiiReminder />
              </div>

              {/* Privacy badge + quick actions row */}
              <div className="px-5 py-2.5 bg-secondary/30 border-b border-border flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">Privacy-first demo.</span> This app does not save reports in the browser, but notes are sent to Supabase and Anthropic for analysis. Use anonymized data only.
                  </span>
                </div>
              </div>

              {/* Quick actions */}
              <div className="px-5 py-2 border-b border-border flex items-center justify-end gap-2">
                <button
                  onClick={handleUseSample}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold transition-all hover:bg-primary/90 neu-button whitespace-nowrap"
                >
                  <FileText className="h-3.5 w-3.5" /> Try Sample
                </button>
                {hasContent && (
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-destructive/70 hover:text-destructive font-medium transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>


              {/* Input area */}
              <div className="p-4 sm:p-5">
                <UploadZone
                  fileName={fileName}
                  fileSize={fileSize}
                  isSample={isSample}
                  pastedText={reportText}
                  onFileSelect={handleFileSelect}
                  onTextChange={handleTextChange}
                  onClear={handleReset}
                />
              </div>
            </div>

            {/* Generate Button - outside card for visual weight */}
            <div className="mt-3 space-y-1.5">
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !hasContent}
                className={`w-full h-12 text-base font-semibold transition-all rounded-xl neu-button ${
                  !hasContent && !isAnalyzing ? "opacity-40" : ""
                }`}
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    <span className="animate-pulse-subtle">
                      {analyzeStep === 1
                        ? "Step 1/2 — Classifying..."
                        : "Step 2/2 — Generating report..."}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate Report
                  </>
                )}
              </Button>

              {isAnalyzing && (
                <Button
                  onClick={handleCancel}
                  variant="ghost"
                  className="w-full h-9 text-sm text-muted-foreground hover:text-destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              )}

              {!hasContent && !isAnalyzing && (
                <p className="text-xs text-muted-foreground text-center">
                  Paste notes or upload a .docx file to get started
                </p>
              )}
            </div>

            {/* Disclaimer */}
            <div className="mt-3">
              <Disclaimer />
            </div>
          </>
        )}

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Demo version — use anonymized data only. Production use requires a HIPAA/compliance review, appropriate agreements, and secure hosting.
        </p>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} Andrew Weingarten. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Index;
