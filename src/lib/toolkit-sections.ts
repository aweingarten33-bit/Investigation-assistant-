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

export const SECTIONS: Section[] = [
  { id: "guide", label: "Investigation Guide", description: "Plan and document the investigation lifecycle", icon: BookOpen },
  { id: "coi", label: "Conflict of Interest", description: "Check investigator independence before assignment", icon: Handshake },
  { id: "interviews", label: "Interview Templates", description: "Interview structure and question prompts", icon: MessageSquare },
  { id: "ai-recommendation", label: "AI Evidence & Decision Support", description: "Map findings to evidence, contradictions, factors, and an action range", icon: Gavel, isAI: true },
  { id: "decisions", label: "Manual Decision Framework", description: "Weigh the same factors yourself without an automatic score", icon: Scale },
  { id: "timelines", label: "Regulatory Deadlines", description: "Scoped timing references with primary-source links", icon: Timer },
  { id: "ai-letters", label: "AI Letter Generator", description: "Draft evidence-bound memos and letters for human review", icon: FileText, isAI: true },
];
