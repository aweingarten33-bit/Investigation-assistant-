import {
  BookOpen, MessageSquare, Scale, Timer, Handshake, FileText, Gavel, type LucideIcon,
} from "lucide-react";

export type SectionId = "guide" | "coi" | "interviews" | "ai-recommendation" | "decisions" | "timelines" | "ai-letters";

export interface Section {
  id: SectionId;
  label: string;
  description: string;
  icon: LucideIcon;
  isAI?: boolean;
}

// Ordered to match the real lifecycle of an investigation — the same 7
// phases walked through in the Investigation Guide. Work top to bottom and
// each section hands off to the next. Shared by the home page's menu and
// the toolkit page itself so there's exactly one list, not two to keep in
// sync.
export const SECTIONS: Section[] = [
  { id: "guide", label: "Investigation Guide", description: "Start here — the full 7-phase walkthrough", icon: BookOpen },
  { id: "coi", label: "Conflict of Interest", description: "Phase 1 — check before you assign an investigator", icon: Handshake },
  { id: "interviews", label: "Interview Templates", description: "Phase 4 — copy-ready interview scripts", icon: MessageSquare },
  { id: "ai-recommendation", label: "AI Recommendation", description: "Phase 5 — let AI recommend the finding & discipline", icon: Gavel, isAI: true },
  { id: "decisions", label: "Decision Framework", description: "Phase 5 — or walk through it yourself, step by step", icon: Scale },
  { id: "timelines", label: "Regulatory Deadlines", description: "Check what's due now that you've decided", icon: Timer },
  { id: "ai-letters", label: "AI Letter Generator", description: "Phase 6 — draft the notification letters", icon: FileText, isAI: true },
];
