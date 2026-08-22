import type React from "react";
import { useCallback, useRef, useState, useEffect } from "react";
import { Upload, FileText, X, Pen } from "lucide-react";

type InputMode = "paste" | "upload";

interface UploadZoneProps {
  fileName: string | null;
  fileSize: string | null;
  isSample: boolean;
  pastedText: string;
  onFileSelect: (files: File[]) => void;
  onTextChange: (text: string) => void;
  onClear: () => void;
}

export function UploadZone({
  fileName,
  fileSize,
  isSample,
  pastedText,
  onFileSelect,
  onTextChange,
  onClear,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<InputMode>(fileName ? "upload" : "paste");

  useEffect(() => {
    setMode(fileName ? "upload" : "paste");
  }, [isSample, pastedText, fileName]);

  useEffect(() => {
    if (textareaRef.current && mode === "paste") {
      textareaRef.current.style.height = "auto";
      const scrollH = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.max(160, Math.min(scrollH, 500))}px`;
    }
  }, [pastedText, mode]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files.length) onFileSelect(files);
    },
    [onFileSelect],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length) onFileSelect(files);
      e.target.value = "";
    },
    [onFileSelect],
  );

  const TabBar = (
    <div className="flex rounded-xl bg-background neu-inset p-1 mb-3">
      <button
        type="button"
        onClick={() => setMode("paste")}
        className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
          mode === "paste"
            ? "bg-background text-foreground neu-raised"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Pen className="h-3.5 w-3.5" /> Type / Paste
      </button>
      <button
        type="button"
        onClick={() => setMode("upload")}
        className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
          mode === "upload"
            ? "bg-background text-foreground neu-raised"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Upload className="h-3.5 w-3.5" /> Upload Sources
      </button>
    </div>
  );

  return (
    <div>
      {TabBar}
      {mode === "paste" ? (
        <textarea
          ref={textareaRef}
          value={pastedText}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={`Type or paste your investigation notes here...\n\nTip: headings such as "Interview — Employee A", "Access Audit", or "Policy" help the evidence map preserve source context.`}
          className="w-full resize-none rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors bg-background neu-inset border-0"
          style={{ minHeight: "120px", maxHeight: "200px" }}
        />
      ) : fileName ? (
        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {isSample ? "Sample report" : fileSize} · Source names preserved in the analysis text
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClear}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Remove uploaded sources"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/50 bg-background p-6 transition-colors hover:border-primary/40 neu-inset"
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              Drop one or more source files here, or click to upload
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              .docx, .txt, or .csv · combine interviews, notes, audits, and other text evidence
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".docx,.txt,.csv,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleChange}
          />
        </div>
      )}
    </div>
  );
}
