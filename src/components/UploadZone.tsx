import type React from "react";
import { useCallback, useRef } from "react";
import { Upload, FileText, X } from "lucide-react";

interface UploadZoneProps {
  fileName: string | null;
  fileSize: string | null;
  isSample: boolean;
  onFileSelect: (files: File[]) => void;
  onClear: () => void;
}

// Upload-only: investigation notes come in as Word or PDF files.
export function UploadZone({ fileName, fileSize, isSample, onFileSelect, onClear }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

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
      e.target.value = "";
      if (files.length) onFileSelect(files);
    },
    [onFileSelect],
  );

  // The file input is a sibling of the drop zone, not a child: a programmatic
  // input.click() inside the zone bubbled back into the zone's onClick and
  // re-triggered the picker, which in some browsers produced a second,
  // overlapping upload.
  const input = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      className="hidden"
      onChange={handleChange}
      data-testid="source-file-input"
    />
  );

  if (fileName) {
    return (
      <div className="rounded-lg border border-border bg-secondary/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{fileName}</p>
              <p className="text-xs text-muted-foreground">
                {isSample ? "Sample report" : fileSize} · Source filename/page context preserved
              </p>
            </div>
          </div>
          <button type="button" onClick={onClear} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Remove uploaded sources">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/50 bg-background p-6 transition-colors hover:border-primary/40 neu-inset"
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Drop one or more investigation files here, or click to upload</p>
          <p className="text-xs text-muted-foreground mt-1">Word (.docx) or PDF · PDFs must contain selectable text</p>
        </div>
      </div>
      {input}
    </div>
  );
}
