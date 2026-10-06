import type { ClosureStatus } from "./types";

// Rebuilds planner input from the text of a Word report previously exported by
// this app (src/lib/docx-export.ts). The app keeps no server-side case state,
// so the export is the system of record: to continue a case, the investigator
// re-uploads it. Parsing is by the export's fixed section headings; anything
// not recognised is reported as missing rather than guessed.

export const EXPORT_TITLE = "Compliance Investigation Report";

export const EXPORT_SECTIONS = [
  "CASE PROVENANCE / ANALYSIS VERSION",
  "HUMAN REVIEW — FINAL RECORDED DISPOSITION",
  "HUMAN REVIEW STATUS",
  "INVESTIGATION SUFFICIENCY / CLOSURE GATE",
  "AI DECISION SUPPORT",
  "ORGANIZATION-SPECIFIC QUESTIONS BEFORE FINAL ACTION",
  "MISSING INFORMATION",
  "I. INTRODUCTION",
  "II. INCIDENT OVERVIEW",
  "III. INCIDENT DETAILS",
  "IV. INVESTIGATION FINDINGS",
  "EVIDENCE TRACEABILITY APPENDIX",
  "FACTORS WEIGHED FOR CORRECTIVE-ACTION RANGE",
  "V. RECOMMENDATIONS / DECISION SUPPORT",
  "REGULATIONS CITED",
  "VI. CONCLUSION",
] as const;

export type ExportSection = (typeof EXPORT_SECTIONS)[number];

// Without these, there is not enough of the prior analysis to plan from.
export const REQUIRED_SECTIONS: ExportSection[] = [
  "INVESTIGATION SUFFICIENCY / CLOSURE GATE",
  "IV. INVESTIGATION FINDINGS",
];

const FINAL_DECISION_SECTION: ExportSection = "HUMAN REVIEW — FINAL RECORDED DISPOSITION";

const CLOSURE_STATUSES: ClosureStatus[] = ["ready_to_close", "not_ready_to_close", "ready_with_unresolved_limitations"];

export type ParsedExport = {
  recognized: boolean;
  caseId: string | null;
  decisionLine: string | null;
  closureStatus: ClosureStatus | null;
  closureRationale: string;
  sections: Partial<Record<ExportSection, string>>;
  foundSections: ExportSection[];
  missingRequiredSections: ExportSection[];
  hasFinalDecision: boolean;
  sufficientForPlanning: boolean;
  problem: string | null;
};

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function headerValue(lines: string[], prefix: string): string | null {
  const line = lines.find((l) => l.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() || null : null;
}

function toClosureStatus(label: string | null): ClosureStatus | null {
  if (!label) return null;
  const candidate = label.toLowerCase().replace(/\s+/g, "_");
  return (CLOSURE_STATUSES as string[]).includes(candidate) ? (candidate as ClosureStatus) : null;
}

export function parseExportText(text: string): ParsedExport {
  const lines = normalizeLines(text);
  const recognized = lines.some((line) => line === EXPORT_TITLE);

  const sections: Partial<Record<ExportSection, string>> = {};
  let current: ExportSection | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (current) sections[current] = buffer.join("\n").trim();
  };
  for (const line of lines) {
    const match = EXPORT_SECTIONS.find((heading) => heading === line.toUpperCase());
    if (match) {
      flush();
      current = match;
      buffer = [];
    } else if (current) {
      buffer.push(line);
    }
  }
  flush();

  const foundSections = EXPORT_SECTIONS.filter((heading) => heading in sections);
  const missingRequiredSections = REQUIRED_SECTIONS.filter((heading) => !sections[heading]);
  const closureStatus = toClosureStatus(headerValue(lines, "Investigation closure status:"));

  // The closure-gate section opens with the status label line; the rationale
  // is the paragraph that follows it.
  const gateLines = (sections["INVESTIGATION SUFFICIENCY / CLOSURE GATE"] || "").split("\n");
  const closureRationale = (toClosureStatus(gateLines[0] ?? null) ? gateLines[1] : gateLines[0]) || "";

  let problem: string | null = null;
  if (!recognized) {
    problem = "This file isn't recognised as a report exported by this app (the \"Compliance Investigation Report\" title is missing). Upload the Word export you downloaded after a previous analysis.";
  } else if (missingRequiredSections.length) {
    problem = `This export is missing or has empty sections needed to rebuild the case: ${missingRequiredSections.join("; ")}. It can't be used reliably for next steps. Run a fresh analysis of your notes instead.`;
  }

  return {
    recognized,
    caseId: headerValue(lines, "Case:"),
    decisionLine: headerValue(lines, "AI decision support:"),
    closureStatus,
    closureRationale,
    sections,
    foundSections,
    missingRequiredSections,
    hasFinalDecision: Boolean(sections[FINAL_DECISION_SECTION]),
    sufficientForPlanning: problem === null,
    problem,
  };
}

export function numberLines(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line, index) => `[L${String(index + 1).padStart(4, "0")}] ${line}`)
    .join("\n");
}

// Same request shape as the in-app planner (mode "investigator_plan"):
// caseNotes carries the source material, analysisSummary the prior analysis.
export function buildPlannerInputFromExport(parsed: ParsedExport, exportText: string, originalNotes = "") {
  const notes = originalNotes.trim();
  const exportBlock = `--- PRIOR EXPORTED REPORT (line-numbered) ---\n${numberLines(normalizeLines(exportText).join("\n"))}\n--- END PRIOR EXPORTED REPORT ---`;
  const caseNotes = notes
    ? `--- ORIGINAL CASE NOTES (attached by the investigator) ---\n${notes}\n--- END ORIGINAL CASE NOTES ---\n\n${exportBlock}`
    : exportBlock;

  const analysisSummary = JSON.stringify({
    source: "Reconstructed from a previously exported Word report. This is the prior AI analysis as exported, not the original structured result.",
    originalNotesAttached: Boolean(notes),
    caseId: parsed.caseId,
    priorDecisionSupport: parsed.decisionLine,
    closureStatus: parsed.closureStatus,
    closureRationale: parsed.closureRationale,
    humanFinalDecisionRecorded: parsed.hasFinalDecision,
    sections: parsed.sections,
  }, null, 2);

  return { caseNotes, analysisSummary };
}
