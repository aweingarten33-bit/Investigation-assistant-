import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, History, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NextStepsPlanner } from "@/components/InvestigatorNextSteps";
import { extractDocxText, extractPdfText } from "@/lib/file-text";
import { buildPlannerInputFromExport, parseExportText, type ParsedExport } from "@/lib/export-parser";

// Mirrors the planner route's limits (server/routes/investigation-toolkit.js).
const MAX_PLAN_CASE_LENGTH = 100_000;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

const PLANNER_DESCRIPTION = "Builds the same next-step plan as after an analysis, from the prior report you uploaded (and your original notes, if attached). Nothing is saved by this app.";

async function readNotesFile(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".docx")) return extractDocxText(file);
  if (lower.endsWith(".pdf")) return extractPdfText(file);
  throw new Error("Original notes support DOCX and PDF only.");
}

export function ContinueFromExport() {
  const [open, setOpen] = useState(false);
  const [exportName, setExportName] = useState<string | null>(null);
  const [exportText, setExportText] = useState("");
  const [parsed, setParsed] = useState<ParsedExport | null>(null);
  const [originalNotes, setOriginalNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploadCount, setUploadCount] = useState(0);
  const exportInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLInputElement>(null);

  const plannerInput = useMemo(
    () => (parsed?.sufficientForPlanning ? buildPlannerInputFromExport(parsed, exportText, originalNotes) : null),
    [parsed, exportText, originalNotes],
  );
  const tooLong = Boolean(plannerInput && plannerInput.caseNotes.length > MAX_PLAN_CASE_LENGTH);

  const handleExport = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("Upload the Word (.docx) report exported by this app.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is over the 15MB upload limit.");
      return;
    }
    try {
      const text = await extractDocxText(file);
      setExportName(file.name);
      setExportText(text);
      setParsed(parseExportText(text));
      setUploadCount((count) => count + 1);
    } catch {
      setError("Couldn't read that Word file.");
    }
  };

  const handleNotesFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is over the 15MB upload limit.");
      return;
    }
    try {
      const text = await readNotesFile(file);
      if (!text.trim()) {
        setError("No readable text was found in the notes file.");
        return;
      }
      setOriginalNotes(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read the notes file.");
    }
  };

  const reset = () => {
    setExportName(null);
    setExportText("");
    setParsed(null);
    setOriginalNotes("");
    setError(null);
  };

  return (
    <div className="mt-3 rounded-2xl bg-background neu-raised overflow-hidden">
      <button type="button" onClick={() => setOpen((value) => !value)} className="w-full px-5 py-3 flex items-center gap-2 text-left hover:bg-muted/20 transition-colors">
        <History className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground flex-1">Continue from a previous export</span>
        <span className="text-[10px] text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            This app doesn't save cases. Your Word export is the record. To pick a case back up, re-upload the last report you exported to get your next steps.
          </p>

          <input ref={exportInputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden"
            onChange={(e) => { void handleExport(e.target.files?.[0]); e.target.value = ""; }} />
          <input ref={notesInputRef} type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden"
            onChange={(e) => { void handleNotesFile(e.target.files?.[0]); e.target.value = ""; }} />

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => exportInputRef.current?.click()} className="h-9 text-xs">
              <FileUp className="h-3.5 w-3.5 mr-1.5" />{exportName ? "Replace exported report" : "Upload exported report (.docx)"}
            </Button>
            {exportName && (
              <Button type="button" variant="ghost" onClick={reset} className="h-9 text-xs text-muted-foreground">
                <X className="h-3.5 w-3.5 mr-1" />Clear
              </Button>
            )}
          </div>

          {exportName && <p className="text-[11px] text-muted-foreground truncate">Report: {exportName}</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}

          {parsed && !parsed.sufficientForPlanning && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-foreground leading-relaxed">{parsed.problem}</p>
            </div>
          )}

          {parsed?.sufficientForPlanning && (
            <>
              <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" />Recovered from the export</p>
                {parsed.caseId && <p className="text-[11px] text-muted-foreground">Case: {parsed.caseId}</p>}
                {parsed.decisionLine && <p className="text-[11px] text-muted-foreground">Prior AI decision support: {parsed.decisionLine}</p>}
                <p className="text-[11px] text-muted-foreground">Closure status: {parsed.closureStatus ? parsed.closureStatus.replace(/_/g, " ") : "not recorded in this export"}</p>
                <p className="text-[11px] text-muted-foreground">My Final Decision: {parsed.hasFinalDecision ? "recorded" : "not recorded"}</p>
                <p className="text-[11px] text-muted-foreground">Sections found: {parsed.foundSections.length}</p>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Original notes <span className="font-normal text-muted-foreground">(optional, gives the planner better input)</span></p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">The export holds the prior analysis, not your raw notes. Attach or paste them so the plan can work from the source material too. Use anonymized data only.</p>
                <Button type="button" variant="outline" onClick={() => notesInputRef.current?.click()} className="h-8 text-[11px]">
                  <Paperclip className="h-3 w-3 mr-1.5" />Attach notes (.docx / .pdf)
                </Button>
                <textarea
                  value={originalNotes}
                  onChange={(e) => setOriginalNotes(e.target.value)}
                  placeholder="…or paste your original notes here"
                  className="w-full min-h-[90px] rounded-md border border-border bg-background p-2 text-xs"
                />
              </div>

              {tooLong ? (
                <p className="text-xs text-destructive">The export plus your notes is over {MAX_PLAN_CASE_LENGTH.toLocaleString()} characters. Shorten the attached notes and try again.</p>
              ) : plannerInput && (
                <NextStepsPlanner
                  key={uploadCount}
                  caseNotes={plannerInput.caseNotes}
                  analysisSummary={plannerInput.analysisSummary}
                  closureStatus={parsed.closureStatus}
                  closureRationale={parsed.closureRationale}
                  description={PLANNER_DESCRIPTION}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
