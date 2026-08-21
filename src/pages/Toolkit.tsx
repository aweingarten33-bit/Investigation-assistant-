import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  ArrowLeft, BookOpen, MessageSquare, Scale, Timer, Handshake,
  ChevronDown, Sparkles, FileText, Search, Gavel, type LucideIcon,
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

  const [openSection, setOpenSection] = useState<SectionId | null>(initialPrefill ? "ai-letters" : null);
  const [letterPrefill, setLetterPrefill] = useState<LetterPrefill | null>(initialPrefill);
  const [pendingScroll, setPendingScroll] = useState(!!initialPrefill);
  const letterSectionRef = useRef<HTMLDivElement>(null);

  // Runs whenever something hands off into the Letter Generator — either the
  // initial deep link from a just-generated report, or AI Recommendation
  // below sending its result straight into a letter.
  useEffect(() => {
    if (pendingScroll && openSection === "ai-letters" && letterSectionRef.current) {
      letterSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingScroll(false);
    }
  }, [pendingScroll, openSection]);

  const openLetterSection = (letterType: string | undefined, caseDetails: string) => {
    setLetterPrefill({ letterType, caseDetails });
    setOpenSection("ai-letters");
    setPendingScroll(true);
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

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[720px] px-4 py-3 sm:py-10">
        <div className="rounded-2xl bg-background neu-raised overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-border">
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
              Numbered 1–8, top to bottom — the same order as a real investigation, from first report to final letter.
            </p>
          </div>

          <div className="px-3 sm:px-5 py-4 sm:py-5 space-y-2">
            {SECTIONS.map((section, index) => {
              const isOpen = openSection === section.id;
              return (
                <div
                  key={section.id}
                  ref={section.id === "ai-letters" ? letterSectionRef : undefined}
                  className={cn(
                    "rounded-lg border overflow-hidden transition-shadow",
                    section.isAI ? "border-primary/20" : "border-border",
                    isOpen && "shadow-sm"
                  )}
                >
                  <button
                    onClick={() => setOpenSection(isOpen ? null : section.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 sm:py-3.5 text-left transition-colors",
                      isOpen
                        ? section.isAI ? "bg-primary/10 border-b border-primary/20" : "bg-primary/5 border-b border-border"
                        : "bg-card hover:bg-secondary/30"
                    )}
                  >
                    <div className="relative shrink-0">
                      <div className={cn(
                        "w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center",
                        isOpen
                          ? "bg-primary text-primary-foreground"
                          : section.isAI ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                      )}>
                        {section.isAI ? <Sparkles className="w-4 h-4" /> : <section.icon className="w-4 h-4" />}
                      </div>
                      <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-foreground text-background text-[9px] font-bold flex items-center justify-center ring-2 ring-card">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{section.label}</p>
                        {section.isAI && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold tracking-wide uppercase">AI</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{section.description}</p>
                    </div>
                    <ChevronDown className={cn(
                      "w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200",
                      !isOpen && "-rotate-90"
                    )} />
                  </button>
                  {isOpen && (
                    <div className="bg-card px-3 sm:px-5 py-4 sm:py-5">
                      {SECTION_CONTENT[section.id]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Demo version — use anonymized data only. AI-drafted content is a starting point, not a substitute for HR/Legal review.
        </p>
      </div>
    </div>
  );
}
