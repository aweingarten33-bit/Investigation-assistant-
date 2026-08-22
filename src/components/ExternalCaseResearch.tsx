import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink, Globe2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api";
import type { Source } from "@/lib/types";

type PublicResearchResponse = {
  brief: string;
  profile: string | null;
  sources: Source[];
};

export function ExternalCaseResearch({
  caseNotes,
  analysisSummary = "",
  initialBrief,
  initialProfile,
  initialSources = [],
  autoSearch = true,
}: {
  caseNotes?: string;
  analysisSummary?: string;
  initialBrief?: string | null;
  initialProfile?: string | null;
  initialSources?: Source[];
  autoSearch?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [brief, setBrief] = useState<string | null>(initialBrief ?? null);
  const [profile, setProfile] = useState<string | null>(initialProfile ?? null);
  const [sources, setSources] = useState<Source[]>(initialSources);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ranForNotesRef = useRef<string | null>(null);

  const runResearch = async () => {
    const notes = caseNotes?.trim();
    if (!notes || notes.length < 20 || loading) return;

    setLoading(true);
    setError(null);
    const { data, error: apiError } = await callApi<PublicResearchResponse>("investigation-toolkit", {
      mode: "public_case_research",
      caseNotes: notes,
      analysisSummary,
    });

    if (apiError || !data) {
      setError(apiError?.message || "Public case research was unavailable.");
      setLoading(false);
      return;
    }

    setBrief(data.brief);
    setProfile(data.profile);
    setSources(data.sources || []);
    setLoading(false);
  };

  useEffect(() => {
    const notes = caseNotes?.trim();
    if (!autoSearch || !notes || notes.length < 20 || ranForNotesRef.current === notes) return;
    ranForNotesRef.current = notes;
    void runResearch();
    // runResearch intentionally depends on the current case inputs; this guard
    // prevents repeated provider/search calls during ordinary re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSearch, caseNotes, analysisSummary]);

  const hasContent = Boolean(brief || sources.length > 0);

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
            Live internet research for current rules plus analogous OCR, OIG, DOJ, CMS, state, court, and public healthcare-organization examples.
          </p>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-4">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">Privacy boundary</p>
            <p className="text-xs text-foreground leading-relaxed">
              Your raw case notes are used only to create a closed, generic research profile. The public search receives that de-identified profile — not names, patient identifiers, employer/facility names, exact dates, quotations, or the raw notes.
            </p>
          </div>

          {loading && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground">
              <RefreshCw className="h-4 w-4 text-primary animate-spin" />
              Searching government sources and similar public cases…
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {profile && (
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">What the internet search was allowed to know</p>
              <p className="text-xs text-foreground leading-relaxed">{profile}</p>
            </div>
          )}

          {brief && (
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-2">Research brief</p>
              <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{brief}</div>
            </div>
          )}

          {sources.length > 0 && (
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

          {!loading && !hasContent && !error && (
            <p className="text-xs text-muted-foreground">No public research has been run for this case yet.</p>
          )}

          {caseNotes && (
            <Button type="button" variant="outline" onClick={runResearch} disabled={loading} className="h-9 text-xs">
              {loading ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
              {hasContent ? "Refresh Similar-Case Research" : "Search Similar Public Cases"}
            </Button>
          )}

          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Public analogs are context, not proof of your case. Government action against an organization and internal employee discipline are different questions; if a source does not publicly state the personnel action, the research is instructed not to guess it.
          </p>
        </div>
      )}
    </div>
  );
}
