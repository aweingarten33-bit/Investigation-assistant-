import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AILetterGenerator from "@/components/toolkit/AILetterGenerator";
import AIRecommendation from "@/components/toolkit/AIRecommendation";
import InvestigationGuide from "@/components/toolkit/InvestigationGuide";
import RegulatoryTimelines from "@/components/toolkit/RegulatoryTimelines";
import InterviewTemplates from "@/components/toolkit/InterviewTemplates";
import DecisionFramework from "@/components/toolkit/DecisionFramework";
import ConflictOfInterest from "@/components/toolkit/ConflictOfInterest";
import { SECTIONS, type SectionId } from "@/lib/toolkit-sections";
import { ToolkitMenuButton, ToolkitNavList } from "@/components/ToolkitMenu";

interface ToolkitNavState {
  openSection?: SectionId;
  prefillLetterType?: string;
  prefillCaseDetails?: string;
}

interface LetterPrefill {
  letterType?: string;
  caseDetails?: string;
}

export default function Toolkit() {
  const location = useLocation();
  const navPrefill = (location.state as ToolkitNavState | null) ?? null;
  const initialPrefill: LetterPrefill | null = navPrefill?.prefillLetterType || navPrefill?.prefillCaseDetails
    ? { letterType: navPrefill.prefillLetterType, caseDetails: navPrefill.prefillCaseDetails }
    : null;

  const [activeSection, setActiveSection] = useState<SectionId>(
    initialPrefill ? "ai-letters" : navPrefill?.openSection ?? "guide"
  );
  const [letterPrefill, setLetterPrefill] = useState<LetterPrefill | null>(initialPrefill);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: navPrefill ? "auto" : "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  const openLetterSection = (letterType: string | undefined, caseDetails: string) => {
    setLetterPrefill({ letterType, caseDetails });
    setActiveSection("ai-letters");
  };

  const SECTION_CONTENT: Record<SectionId, React.ReactNode> = {
    "ai-letters": (
      <AILetterGenerator
        initialLetterType={letterPrefill?.letterType}
        initialCaseDetails={letterPrefill?.caseDetails}
      />
    ),
    "ai-recommendation": <AIRecommendation onDraftLetter={openLetterSection} />,
    guide: <InvestigationGuide />,
    timelines: <RegulatoryTimelines />,
    interviews: <InterviewTemplates />,
    decisions: <DecisionFramework />,
    coi: <ConflictOfInterest />,
  };

  const activeIndex = SECTIONS.findIndex((s) => s.id === activeSection);
  const active = SECTIONS[activeIndex];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1000px] px-4 py-3 sm:py-10">
        {/* ── Mobile (below sm): hamburger + always-visible content pane ───── */}
        <div className="sm:hidden">
          <div className="flex items-center gap-2 mb-3 sticky top-0 z-10 bg-background/95 backdrop-blur -mx-4 px-4 py-2">
            <ToolkitMenuButton activeId={activeSection} onSelect={setActiveSection} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold leading-none">
                Step {activeIndex + 1} of {SECTIONS.length}
              </p>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold text-foreground truncate">{active.label}</h1>
                {active.isAI && (
                  <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold tracking-wide uppercase">AI</span>
                )}
              </div>
            </div>
            <Link
              to="/"
              className="shrink-0 text-xs font-medium text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
            >
              Home
            </Link>
          </div>

          <div className="rounded-2xl bg-background neu-raised overflow-hidden">
            <div className="bg-card px-3 py-4">
              {SECTION_CONTENT[activeSection]}
            </div>
          </div>
        </div>

        {/* ── Desktop (sm and up): sidebar + content pane together ─────────── */}
        <div className="hidden sm:block">
          <div className="mb-4">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Report Generator
            </Link>
            <h1 className="text-xl font-bold text-foreground mb-0.5">Investigation Toolkit</h1>
            <p className="text-sm text-muted-foreground leading-snug">
              Pick a step — same order as a real investigation, from first report to final letter.
            </p>
          </div>

          <div className="flex gap-4">
            <nav className="w-72 shrink-0 sticky top-6 self-start">
              <ToolkitNavList activeId={activeSection} onSelect={setActiveSection} />
            </nav>

            <div className="flex-1 min-w-0 rounded-2xl bg-background neu-raised overflow-hidden">
              <div className="px-5 pt-4 pb-3 border-b border-border">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">
                  Step {activeIndex + 1} of {SECTIONS.length}
                </p>
                <h2 className="text-base font-semibold text-foreground">{active.label}</h2>
              </div>
              <div className="bg-card px-5 py-5">
                {SECTION_CONTENT[activeSection]}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Demo version — use anonymized data only. AI-drafted content is a starting point, not a substitute for HR/Legal review.
        </p>
      </div>
    </div>
  );
}
