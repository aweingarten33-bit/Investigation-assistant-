import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";

export function Disclaimer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>Disclaimer</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-foreground leading-relaxed fade-in">
          <span className="font-semibold text-warning">Important:</span> This tool
          uses AI to generate content and may produce inaccuracies or fabricated
          details. It does not constitute legal or professional compliance advice.
          All output must be reviewed by a qualified compliance, privacy, HR, legal,
          or operational leader before official use. Do not use real PHI/PII in
          this demo environment. Final judgment and responsibility remain with
          the end user.
        </div>
      )}
    </div>
  );
}
