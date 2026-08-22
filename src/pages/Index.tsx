import { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import mammoth from "mammoth";
import { callApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/UploadZone";
import { AnalysisResults } from "@/components/AnalysisResults";
import { PiiReminder } from "@/components/PiiReminder";
import { Disclaimer } from "@/components/Disclaimer";
import { OrganizationDisciplineMatrix } from "@/components/OrganizationDisciplineMatrix";
import { exportToDocx } from "@/lib/docx-export";
import { AnalysisResult, HumanReviewRecord } from "@/lib/types";
import {
  buildOrganizationContext,
  EMPTY_ORGANIZATION_DISCIPLINE_CONFIG,
  type OrganizationDisciplineConfig,
} from "@/lib/organization-context";
import { SAMPLE_REPORT_TEXT } from "@/lib/sample-report";
import { suggestLetterType, buildLetterPrefillDetails, letterButtonLabel } from "@/lib/letter-prefill";
import {
  Loader2, Download, Sparkles, FileText, RotateCcw, XCircle,
  ShieldCheck, Mail, Building2, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { HomeToolkitMenuButton } from "@/components/ToolkitMenu";

const MIN_REPORT_LENGTH = 50;
const MAX_REPORT_LENGTH = 100_000;
const MAX_ORG_CONTEXT = 20_000;
const ANALYSIS_VERSION = "investigation-assistant-personal-v3";

const Index = () => {
  const navigate = useNavigate();
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [reportText, setReportText] = useState<string>("");
  const [organizationConfig, setOrganizationConfig] = useState<OrganizationDisciplineConfig>({ ...EMPTY_ORGANIZATION_DISCIPLINE_CONFIG });
  const [showOrgContext, setShowOrgContext] = useState(false);
  const [isSample, setIsSample] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState<0 | 1 | 2>(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const runIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const organizationContext = useMemo(() => buildOrganizationContext(organizationConfig), [organizationConfig]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const invalidateRun = useCallback(() => {
    runIdRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const handleReset = useCallback(() => {
    invalidateRun();
    setReportText("");
    setOrganizationConfig({ ...EMPTY_ORGANIZATION_DISCIPLINE_CONFIG });
    setShowOrgContext(false);
    setFileName(null);
    setFileSize(null);
    setIsSample(false);
    setResult(null);
    setIsAnalyzing(false);
    setAnalyzeStep(0);
  }, [invalidateRun]);

  const handleFileSelect = useCallback(async (file: File) => {
    const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (!file.name.endsWith(".docx")) {
      toast.error("Only .docx files are supported.");
      return;
    }
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
    invalidateRun();
    setIsAnalyzing(false);
    setAnalyzeStep(0);
    toast.info("Analysis cancelled.");
  }, [invalidateRun]);

  const handleAnalyze = useCallback(async () => {
    const trimmedReportText = reportText.trim();
    const trimmedOrganizationContext = organizationContext.trim();
    if (!trimmedReportText) return;

    if (trimmedReportText.length < MIN_REPORT_LENGTH) {
      toast.error("Please provide more detail before generating a report.");
      return;
    }
    if (trimmedReportText.length > MAX_REPORT_LENGTH) {
      toast.error("Notes are too long. Please shorten them to under 100,000 characters.");
      return;
    }
    if (trimmedOrganizationContext.length > MAX_ORG_CONTEXT) {
      toast.error("Organization discipline context must be under 20,000 characters.");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const myRunId = ++runIdRef.current;
    setIsAnalyzing(true);
    setResult(null);
    setAnalyzeStep(1);

    try {
      const { data: classifyData, error: classifyError } = await callApi<{
        classification: unknown;
        signature: string;
        inputHash: string;
        sources?: AnalysisResult["sources"];
        researchTopic?: string | null;
      }>(
        "analyze-report",
        {
          reportText: trimmedReportText,
          organizationContext: trimmedOrganizationContext,
          step: "classify",
        },
        { signal: controller.signal },
      );
      if (runIdRef.current !== myRunId) return;
      if (classifyError) throw classifyError;

      const classification = classifyData!.classification;
      const signature = classifyData!.signature;
      const inputHash = classifyData!.inputHash;
      const sources = classifyData!.sources;
      const researchTopic = classifyData!.researchTopic ?? null;
      setAnalyzeStep(2);

      const { data: reportData, error: reportError } = await callApi<Omit<AnalysisResult, "caseId">>(
        "analyze-report",
        {
          reportText: trimmedReportText,
          organizationContext: trimmedOrganizationContext,
          step: "report",
          classification,
          signature,
          inputHash,
        },
        { signal: controller.signal },
      );
      if (runIdRef.current !== myRunId) return;
      if (reportError) throw reportError;

      const caseMatch = trimmedReportText.match(/Case\s*#?\s*([\w-]+)/i);
      const caseId = caseMatch ? caseMatch[1] : new Date().toISOString().split("T")[0];
      setResult({
        ...reportData!,
        caseId,
        sources,
        analysisMetadata: {
          analysisVersion: ANALYSIS_VERSION,
          generatedAt: new Date().toISOString(),
          sourceFingerprint: inputHash,
          organizationContextApplied: Boolean(trimmedOrganizationContext),
          researchTopic,
          evidenceCount: reportData!.evidenceItems?.length ?? 0,
          findingCount: reportData!.findings?.length ?? 0,
        },
      });
      toast.success("Evidence mapped and report generated.");
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
    } catch (e: unknown) {
      if (runIdRef.current === myRunId && !(e instanceof Error && e.message === "Request cancelled")) {
        toast.error(e instanceof Error ? e.message : "Analysis failed. Please try again.");
      }
    } finally {
      if (runIdRef.current === myRunId) {
        abortRef.current = null;
        setIsAnalyzing(false);
        setAnalyzeStep(0);
      }
    }
  }, [reportText, organizationContext]);

  const handleHumanReviewChange = useCallback((review: HumanReviewRecord | undefined) => {
    setResult((current) => current ? { ...current, humanReview: review } : current);
  }, []);

  const handleExport = useCallback(async () => {
    if (!result) return;
    try {
      await exportToDocx(result);
      toast.success("Word document exported successfully.");
    } catch {
      toast.error("Failed to export Word document. Please try again.");
    }
  }, [result]);

  const handleDraftLetter = useCallback(() => {
    if (!result) return;
    navigate("/toolkit", {
      state: {
        prefillLetterType: suggestLetterType(result),
        prefillCaseDetails: buildLetterPrefillDetails(result),
      },
    });
  }, [result, navigate]);

  const hasContent = reportText.trim().length > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[720px] px-4 py-3 sm:py-10">
        {result ? (
          <>
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border -mx-4 px-4 py-3 mb-4">
              <div className="flex items-center justify-start mb-2"><HomeToolkitMenuButton /></div>
              <div className="flex gap-3">
                <Button onClick={handleExport} className="flex-1 h-11 text-sm font-semibold"><Download className="mr-2 h-4 w-4" />Export to Word</Button>
                <Button onClick={handleReset} variant="outline" className="h-11 text-sm">New Analysis</Button>
              </div>
              {result.decision !== "needs_more_info" && (
                <button onClick={handleDraftLetter} className="mt-2 w-full flex items-center justify-center gap-1.5 h-9 text-xs font-medium text-primary hover:text-primary/80 transition-colors rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10">
                  <Mail className="h-3.5 w-3.5" />{letterButtonLabel(suggestLetterType(result))}
                </button>
              )}
            </div>
            <AnalysisResults result={result} caseNotes={reportText} onHumanReviewChange={handleHumanReviewChange} />
          </>
        ) : (
          <>
            <div className="rounded-2xl bg-background neu-raised overflow-hidden">
              <div className="px-5 pt-4 pb-3 border-b border-border">
                <div className="flex items-start gap-3">
                  <HomeToolkitMenuButton />
                  <h1 className="text-base sm:text-xl font-bold text-foreground mb-0.5">Compliance & Privacy Investigation Assistant</h1>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-snug">Paste or upload investigation notes to map the evidence, identify contradictions, assess the finding, generate the report, and tell you exactly what to investigate next.</p>
                <PiiReminder />
              </div>

              <div className="px-5 py-2.5 bg-secondary/30 border-b border-border flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">Privacy-first demo.</span> Reports are not saved by this app, but notes are sent to the app server and the configured AI provider for processing. Use anonymized data only.
                  </span>
                </div>
              </div>

              <div className="px-5 py-2 border-b border-border flex items-center justify-end gap-2">
                <button onClick={handleUseSample} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold transition-all hover:bg-primary/90 neu-button whitespace-nowrap"><FileText className="h-3.5 w-3.5" /> Try Sample</button>
                {hasContent && (
                  <button onClick={handleReset} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-destructive/70 hover:text-destructive font-medium transition-colors whitespace-nowrap"><RotateCcw className="h-3 w-3" /> Clear</button>
                )}
              </div>

              <div className="p-4 sm:p-5">
                <UploadZone fileName={fileName} fileSize={fileSize} isSample={isSample} pastedText={reportText} onFileSelect={handleFileSelect} onTextChange={handleTextChange} onClear={handleReset} />
              </div>

              <div className="border-t border-border">
                <button type="button" onClick={() => setShowOrgContext((value) => !value)} className="w-full px-5 py-3 flex items-center gap-2 text-left hover:bg-muted/20 transition-colors">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground flex-1">Optional policy / discipline context</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showOrgContext ? "rotate-180" : ""}`} />
                </button>
                {showOrgContext && (
                  <div className="px-5 pb-4">
                    <OrganizationDisciplineMatrix config={organizationConfig} onChange={(next) => { setOrganizationConfig(next); setResult(null); }} maxCharacters={MAX_ORG_CONTEXT} />
                    <p className="text-[10px] text-muted-foreground text-right mt-2">Optional decision context: {organizationContext.length.toLocaleString()} / {MAX_ORG_CONTEXT.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              <Button onClick={handleAnalyze} disabled={isAnalyzing || !hasContent} className={`w-full h-12 text-base font-semibold transition-all rounded-xl neu-button ${!hasContent && !isAnalyzing ? "opacity-40" : ""}`} size="lg">
                {isAnalyzing ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /><span className="animate-pulse-subtle">{analyzeStep === 1 ? "Step 1/2 — Mapping evidence & decision support..." : "Step 2/2 — Generating report..."}</span></>
                ) : (
                  <><Sparkles className="mr-2 h-5 w-5" />Analyze & Generate Report</>
                )}
              </Button>

              {isAnalyzing && (
                <Button onClick={handleCancel} variant="ghost" className="w-full h-9 text-sm text-muted-foreground hover:text-destructive"><XCircle className="mr-2 h-4 w-4" />Cancel</Button>
              )}

              {!hasContent && !isAnalyzing && <p className="text-xs text-muted-foreground text-center">Paste notes or upload a .docx file to get started</p>}
            </div>

            <div className="mt-3"><Disclaimer /></div>
          </>
        )}

        <p className="mt-4 text-center text-[11px] text-muted-foreground">Personal-use demo — use anonymized data only. Reports are not saved by this app.</p>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">© {new Date().getFullYear()} Andrew Weingarten. All rights reserved.</p>
      </div>
    </div>
  );
};

export default Index;
