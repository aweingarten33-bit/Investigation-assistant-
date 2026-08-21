import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  ArrowLeft, BookOpen, MessageSquare, Scale, Timer, Handshake,
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

export default function Toolkit() {
  const location = useLocation();
  const navPrefill = (location.state as ToolkitNavState | null) ?? null;
  const initialPrefill: LetterPrefill | null = navPrefill?.prefillLetterType || navPrefill?.prefillCaseDetails
    ? { letterType: navPrefill.prefillLetterType, caseDetails: navPrefill.prefillCaseDetails }
    : null;

  // One tool visible at a time — no accordion stack to scroll past.
  // Defaults to the first phase unless a deep link (e.g. "Draft Notification
  // Letter" from a just-generated report) hands off straight to the letters.
  const [activeSection, setActiveSection] = useState<SectionId>(initialPrefill ? "ai-letters" : "guide");
  const [letterPrefill, setLetterPrefill] = useState<LetterPrefill | null>(initialPrefill);

  // Jump to the top of the content pane on every switch, including the
  // initial deep link, so a long previous tool's scroll position never
  // carries over into the next one.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: initialPrefill ? "auto" : "smooth" });
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

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1000px] px-4 py-3 sm:py-10">
        <div className="mb-3 sm:mb-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Report Generator
          </Link>
          <h1 className="text-base sm:text-xl font-bold text-foreground mb-0.5">
            Investigation Toolkit
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
            Pick a step below — same order as a real investigation, from first report to final letter.
          </p>
        </div>

        {/* Mobile: horizontal scrolling step picker */}
        <div className="flex sm:hidden gap-2 overflow-x-auto pb-3 -mx-4 px-4">
          {SECTIONS.map((section, index) => {
            const isActive = section.id === activeSection;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border"
                )}
              >
                <span className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                  isActive ? "bg-primary-foreground/20" : "bg-secondary"
                )}>
                  {index + 1}
                </span>
                {section.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Desktop: persistent sidebar */}
          <nav className="hidden sm:block sm:w-64 shrink-0">
            <div className="rounded-2xl bg-background neu-raised p-2 space-y-1 sticky top-6">
              {SECTIONS.map((section, index) => {
                const isActive = section.id === activeSection;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary/50 text-foreground"
                    )}
                  >
                    <div className={cn(
                      "relative shrink-0 w-7 h-7 rounded-md flex items-center justify-center",
                      isActive ? "bg-primary-foreground/20" : section.isAI ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                    )}>
                      {section.isAI ? <Sparkles className="w-3.5 h-3.5" /> : <section.icon className="w-3.5 h-3.5" />}
                      <span className={cn(
                        "absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ring-2",
                        isActive ? "bg-primary-foreground text-primary ring-primary" : "bg-foreground text-background ring-card"
                      )}>
                        {index + 1}
                      </span>
                    </div>
                    <span className="text-sm font-medium truncate">{section.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Content pane — one tool, nothing else competing for attention */}
          <div className="flex-1 min-w-0 rounded-2xl bg-background neu-raised overflow-hidden">
            <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">
                  Step {activeIndex + 1} of {SECTIONS.length}
                </p>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-semibold text-foreground truncate">{active.label}</h2>
                  {active.isAI && (
                    <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold tracking-wide uppercase">AI</span>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-card px-3 sm:px-5 py-4 sm:py-5">
              {SECTION_CONTENT[activeSection]}
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
