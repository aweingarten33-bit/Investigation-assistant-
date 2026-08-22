import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  ArrowLeft, Menu, X, BookOpen, MessageSquare, Scale, Timer, Handshake,
  Sparkles, FileText, Search, Gavel, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import AILetterGenerator from "@/components/toolkit/AILetterGenerator";
import AICaseAnalysis from "@/components/toolkit/AICaseAnalysis";
import AIRecommendation from "@/components/toolkit/AIRecommendation";
import InvestigationGuide from "@/components/toolkit/InvestigationGuide";
import RegulatoryTimelines from "@/components/toolkit/RegulatoryTimelines";
import InterviewTemplates from "@/components/toolkit/InterviewTemplates";
import DecisionFramework from "@/components/toolkit/DecisionFramework";
import ConflictOfInterest from "@/components/toolkit/ConflictOfInterest";

type SectionId = "guide" | "coi" | "ai-analysis" | "interviews" | "ai-recommendation" | "decisions" | "timelines" | "ai-letters";

interface ToolkitNavState {
  prefillLetterType?: string;
  prefillCaseDetails?: string;
}

interface LetterPrefill {
  letterType?: string;
  caseDetails?: string;
}

// Ordered to match the real lifecycle of an investigation — the same 7
// phases walked through in the Investigation Guide below. Work top to
// bottom and each section hands off to the next.
const SECTIONS: { id: SectionId; label: string; description: string; icon: LucideIcon; isAI?: boolean }[] = [
  { id: "guide", label: "Investigation Guide", description: "Start here — the full 7-phase walkthrough", icon: BookOpen },
  { id: "coi", label: "Conflict of Interest", description: "Phase 1 — check before you assign an investigator", icon: Handshake },
  { id: "ai-analysis", label: "AI Case Analysis", description: "Phase 2–3 — quick regulatory read while you plan", icon: Search, isAI: true },
  { id: "interviews", label: "Interview Templates", description: "Phase 4 — copy-ready interview scripts", icon: MessageSquare },
  { id: "ai-recommendation", label: "AI Recommendation", description: "Phase 5 — let AI recommend the finding & discipline", icon: Gavel, isAI: true },
  { id: "decisions", label: "Decision Framework", description: "Phase 5 — or walk through it yourself, step by step", icon: Scale },
  { id: "timelines", label: "Regulatory Deadlines", description: "Check what's due now that you've decided", icon: Timer },
  { id: "ai-letters", label: "AI Letter Generator", description: "Phase 6 — draft the notification letters", icon: FileText, isAI: true },
];

function SectionIcon({ section, active }: { section: (typeof SECTIONS)[number]; active: boolean }) {
  const index = SECTIONS.indexOf(section);
  return (
    <div className="relative shrink-0">
      <div className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center",
        active ? "bg-primary text-primary-foreground" : section.isAI ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
      )}>
        {section.isAI ? <Sparkles className="w-4 h-4" /> : <section.icon className="w-4 h-4" />}
      </div>
      <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-foreground text-background text-[9px] font-bold flex items-center justify-center ring-2 ring-card">
        {index + 1}
      </span>
    </div>
  );
}

export default function Toolkit() {
  const location = useLocation();
  const navPrefill = (location.state as ToolkitNavState | null) ?? null;
  const initialPrefill: LetterPrefill | null = navPrefill?.prefillLetterType || navPrefill?.prefillCaseDetails
    ? { letterType: navPrefill.prefillLetterType, caseDetails: navPrefill.prefillCaseDetails }
    : null;

  const [activeSection, setActiveSection] = useState<SectionId>(initialPrefill ? "ai-letters" : "guide");
  const [letterPrefill, setLetterPrefill] = useState<LetterPrefill | null>(initialPrefill);
  // Mobile only: the content pane is always what's on screen. The menu is
  // an overlay drawer triggered by the hamburger button, not a separate page.
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: initialPrefill ? "auto" : "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  // Lock background scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const selectSection = (id: SectionId) => {
    setActiveSection(id);
    setDrawerOpen(false);
  };

  const openLetterSection = (letterType: string | undefined, caseDetails: string) => {
    setLetterPrefill({ letterType, caseDetails });
    selectSection("ai-letters");
  };

  const SECTION_CONTENT: Record<SectionId, React.ReactNode> = {
    "ai-letters": (
      <AILetterGenerator
        initialLetterType={letterPrefill?.letterType}
        initialCaseDetails={letterPrefill?.caseDetails}
      />
    ),
    "ai-analysis": <AICaseAnalysis />,
    "ai-recommendation": <AIRecommendation onDraftLetter={openLetterSection} />,
    guide: <InvestigationGuide />,
    timelines: <RegulatoryTimelines />,
    interviews: <InterviewTemplates />,
    decisions: <DecisionFramework />,
    coi: <ConflictOfInterest />,
  };

  const activeIndex = SECTIONS.findIndex((s) => s.id === activeSection);
  const active = SECTIONS[activeIndex];

  const NavList = ({ onSelect }: { onSelect: (id: SectionId) => void }) => (
    <div className="rounded-2xl bg-background neu-raised overflow-hidden divide-y divide-border">
      {SECTIONS.map((section) => {
        const isActive = section.id === activeSection;
        return (
          <button
            key={section.id}
            onClick={() => onSelect(section.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors",
              isActive ? "bg-primary/10" : "bg-card hover:bg-secondary/30 active:bg-secondary/30"
            )}
          >
            <SectionIcon section={section} active={isActive} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={cn("text-sm font-semibold truncate", isActive ? "text-primary" : "text-foreground")}>
                  {section.label}
                </p>
                {section.isAI && (
                  <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold tracking-wide uppercase">AI</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{section.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1000px] px-4 py-3 sm:py-10">
        {/* ── Mobile (below sm): hamburger + always-visible content pane ───── */}
        <div className="sm:hidden">
          <div className="flex items-center gap-2 mb-3 sticky top-0 z-10 bg-background/95 backdrop-blur -mx-4 px-4 py-2">
            <button
              onClick={() => setDrawerOpen(true)}
              className="shrink-0 w-9 h-9 rounded-lg bg-card neu-button flex items-center justify-center text-foreground"
              aria-label="Open toolkit menu"
            >
              <Menu className="w-4.5 h-4.5" />
            </button>
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
          </div>

          <div className="rounded-2xl bg-background neu-raised overflow-hidden">
            <div className="bg-card px-3 py-4">
              {SECTION_CONTENT[activeSection]}
            </div>
          </div>

          {/* Drawer overlay */}
          {drawerOpen && (
            <div className="fixed inset-0 z-50">
              <div
                className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
                onClick={() => setDrawerOpen(false)}
              />
              <div className="absolute inset-y-0 left-0 w-[85%] max-w-[340px] bg-background shadow-2xl overflow-y-auto animate-in slide-in-from-left duration-200">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div>
                    <Link
                      to="/"
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1.5"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back to Report Generator
                    </Link>
                    <h2 className="text-base font-bold text-foreground">Investigation Toolkit</h2>
                  </div>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary/50"
                    aria-label="Close menu"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>
                <div className="p-3">
                  <NavList onSelect={selectSection} />
                </div>
              </div>
            </div>
          )}
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
              <NavList onSelect={setActiveSection} />
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
