import { useState } from "react";
import { ChevronDown, ExternalLink, Globe2, ShieldCheck } from "lucide-react";
import type { Source } from "@/lib/types";

export function ExternalCaseResearch({
  brief,
  profile,
  sources,
}: {
  brief?: string | null;
  profile?: string | null;
  sources?: Source[];
}) {
  const [open, setOpen] = useState(true);
  if (!brief && (!sources || sources.length === 0)) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full p-4 flex items-start gap-3 text-left hover:bg-muted/20 transition-colors"
      >
        <Globe2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Similar Public Cases & Government Enforcement</p>
          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
            Live internet research using a de-identified case profile. These public examples are context — not evidence that proves your case and not an automatic discipline rule.
          </p>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-4">
          {profile && (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">What the internet search was allowed to know</p>
              <p className="text-xs text-foreground leading-relaxed">{profile}</p>
              <p className="mt-2 text-[10px] text-muted-foreground">Names, patient identifiers, employer names, dates, quotations, and raw case notes are not used as the search query.</p>
            </div>
          )}

          {brief && (
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">Research brief</p>
              <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{brief}</div>
            </div>
          )}

          {sources && sources.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">Public sources reviewed</p>
              <div className="space-y-2">
                {sources.map((source, index) => (
                  <a
                    key={`${source.url}-${index}`}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <span className="text-xs text-primary underline underline-offset-2 break-words flex-1">{source.title}</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
