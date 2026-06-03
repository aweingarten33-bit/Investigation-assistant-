import { useState } from "react";
import { ChevronDown, AlertTriangle } from "lucide-react";

export function PiiReminder() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-warning font-medium hover:text-warning/80 transition-colors"
      >
        <AlertTriangle className="h-3 w-3" />
        <span>De-identify</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed fade-in">
          Remove names, dates of birth, medical record numbers, addresses, phone numbers, account numbers, and other PHI/PII before pasting or uploading. Replace with pseudonyms such as "Employee A" and "Patient B".
        </p>
      )}
    </div>
  );
}
