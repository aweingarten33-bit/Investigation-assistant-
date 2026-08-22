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
// Descriptions deliberately don't cite specific phase numbers (e.g. "Phase
// 4") — not every one of the guide's 7 phases has its own dedicated tool
// here, so numbering some steps and not others made it look like phases
// were missing (there's no toolkit item for Phase 2: Plan or Phase 3:
// Collect Evidence — those are covered inside the Investigation Guide
// itself, step 1 below). Plain functional descriptions avoid implying a
// 1:1 mapping between toolkit steps and guide phases that doesn't exist.
export const SECTIONS: Section[] = [
  { id: "guide", label: "Investigation Guide", description: "Start here — the full 7-phase walkthrough", icon: BookOpen },
  { id: "coi", label: "Conflict of Interest", description: "Check before you assign an investigator", icon: Handshake },
  { id: "interviews", label: "Interview Templates", description: "Copy-ready interview scripts", icon: MessageSquare },
  { id: "ai-recommendation", label: "AI Recommendation", description: "Let AI recommend the finding & discipline", icon: Gavel, isAI: true },
  { id: "decisions", label: "Decision Framework", description: "Or walk through the decision yourself, step by step", icon: Scale },
  { id: "timelines", label: "Regulatory Deadlines", description: "Check what's due now that you've decided", icon: Timer },
  { id: "ai-letters", label: "AI Letter Generator", description: "Draft the notification letters", icon: FileText, isAI: true },
];
