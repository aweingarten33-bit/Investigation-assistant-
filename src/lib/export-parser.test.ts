import { describe, expect, it } from "vitest";
import { Packer } from "docx";
import mammoth from "mammoth";
import { buildReportDocument } from "./docx-export";
import { buildPlannerInputFromExport, numberLines, parseExportText } from "./export-parser";
import type { AnalysisResult } from "./types";

function result(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    decision: "needs_more_info",
    riskLevel: "high",
    violationType: "privacy",
    violationCount: "1",
    recommendationTier: "policy_review",
    aggravatingFactors: [],
    mitigatingFactors: [],
    notesCompleteness: "partial",
    evidenceItems: [
      { id: "E1", sourceLabel: "notes", lineStart: 3, lineEnd: 3, evidenceType: "system_record", stance: "supports", summary: "Audit log shows the chart was opened", reference: "L0003", excerpt: "Access log shows view at 14:02" },
    ],
    findings: [
      { id: "F1", statement: "The employee accessed the record", inference: "", evidenceStatus: "single_source", supportingEvidenceIds: ["E1"], contradictingEvidenceIds: [] },
    ],
    hypotheses: [],
    sufficiencyChecks: [],
    closureAssessment: {
      status: "not_ready_to_close",
      rationale: "The business reason for the access has not been tested.",
      unresolvedMaterialIssues: ["Whether the access was work-related"],
      whatWouldChangeConclusion: [],
    },
    disciplineFactors: [],
    disciplineRange: { minimum: "coaching", maximum: "termination", recommended: "defer", rationale: "Policy required", policyDependent: true, requiresHrLegalReview: true },
    policyQuestions: [],
    introduction: "Review of a reported chart access.",
    incidentOverview: "A coworker's chart was opened.",
    incidentDetails: "The access occurred on a weekend shift.",
    investigationFindings: ["Access to the record is confirmed by the audit log."],
    regulationsCited: [],
    recommendations: "Interview the employee and the charge nurse.",
    conclusion: "More information is needed before a finding.",
    missingInfo: ["Employee interview"],
    caseId: "CASE-42",
    ...overrides,
  };
}

async function exportText(r: AnalysisResult): Promise<string> {
  const buffer = await Packer.toBuffer(buildReportDocument(r));
  const extracted = await mammoth.extractRawText({ buffer });
  return extracted.value;
}

describe("parseExportText (round-trip through the real Word export)", () => {
  it("recovers case header, closure gate and sections from a full export", async () => {
    const parsed = parseExportText(await exportText(result()));
    expect(parsed.recognized).toBe(true);
    expect(parsed.sufficientForPlanning).toBe(true);
    expect(parsed.problem).toBeNull();
    expect(parsed.caseId).toBe("CASE-42");
    expect(parsed.decisionLine).toBe("NEEDS MORE INFO  |  Risk: HIGH");
    expect(parsed.closureStatus).toBe("not_ready_to_close");
    expect(parsed.closureRationale).toBe("The business reason for the access has not been tested.");
    expect(parsed.sections["IV. INVESTIGATION FINDINGS"]).toContain("Access to the record is confirmed by the audit log.");
    expect(parsed.sections["EVIDENCE TRACEABILITY APPENDIX"]).toContain("Access log shows view at 14:02");
    expect(parsed.sections["MISSING INFORMATION"]).toContain("Employee interview");
    expect(parsed.hasFinalDecision).toBe(false);
  });

  it("detects a recorded My Final Decision", async () => {
    const parsed = parseExportText(await exportText(result({
      humanReview: {
        reviewerName: "A. Reviewer",
        reviewerRole: "Privacy Officer",
        status: "approved_with_changes",
        finalFinding: "Substantiated",
        finalAction: "Written warning",
        rationale: "Access had no business reason.",
        reviewedAt: "2026-10-01T12:00:00.000Z",
      },
    })));
    expect(parsed.hasFinalDecision).toBe(true);
    expect(parsed.sections["HUMAN REVIEW — FINAL RECORDED DISPOSITION"]).toContain("Final action / disposition: Written warning");
  });

  it("refuses an export whose findings section is empty instead of guessing", async () => {
    const parsed = parseExportText(await exportText(result({ investigationFindings: [] })));
    expect(parsed.recognized).toBe(true);
    expect(parsed.sufficientForPlanning).toBe(false);
    expect(parsed.missingRequiredSections).toEqual(["IV. INVESTIGATION FINDINGS"]);
    expect(parsed.problem).toMatch(/missing or has empty sections/);
  });
});

describe("parseExportText (non-export input)", () => {
  it("rejects a document that is not an export from this app", () => {
    const parsed = parseExportText("Interview Notes\nEmployee denied access\nAccess log shows view");
    expect(parsed.recognized).toBe(false);
    expect(parsed.sufficientForPlanning).toBe(false);
    expect(parsed.problem).toMatch(/isn't recognised as a report exported by this app/);
  });

  it("leaves closure status null when the header line is absent", () => {
    const parsed = parseExportText("Compliance Investigation Report\nINVESTIGATION SUFFICIENCY / CLOSURE GATE\nSome rationale\nIV. INVESTIGATION FINDINGS\n•  A finding");
    expect(parsed.sufficientForPlanning).toBe(true);
    expect(parsed.closureStatus).toBeNull();
    expect(parsed.closureRationale).toBe("Some rationale");
  });
});

describe("buildPlannerInputFromExport", () => {
  it("line-numbers the export and includes original notes only when attached", async () => {
    const text = await exportText(result());
    const parsed = parseExportText(text);

    const withoutNotes = buildPlannerInputFromExport(parsed, text);
    expect(withoutNotes.caseNotes).toMatch(/^--- PRIOR EXPORTED REPORT \(line-numbered\) ---\n\[L0001\] Compliance Investigation Report/);
    expect(withoutNotes.caseNotes).not.toContain("ORIGINAL CASE NOTES");
    const summary = JSON.parse(withoutNotes.analysisSummary);
    expect(summary.originalNotesAttached).toBe(false);
    expect(summary.closureStatus).toBe("not_ready_to_close");
    expect(summary.sections["IV. INVESTIGATION FINDINGS"]).toContain("audit log");

    const withNotes = buildPlannerInputFromExport(parsed, text, "  Interview notes: employee says she was covering a shift.  ");
    expect(withNotes.caseNotes.startsWith("--- ORIGINAL CASE NOTES (attached by the investigator) ---\nInterview notes: employee says she was covering a shift.\n")).toBe(true);
    expect(JSON.parse(withNotes.analysisSummary).originalNotesAttached).toBe(true);
  });

  it("numbers lines the same way as the server ([L0001] ...)", () => {
    expect(numberLines("a\nb")).toBe("[L0001] a\n[L0002] b");
  });
});
