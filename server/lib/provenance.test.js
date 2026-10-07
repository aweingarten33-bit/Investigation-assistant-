// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hydrateEvidenceTraceability, groundReportFindings } from "./investigation-utils.js";
import { enforceReportProvenance, extractUnsuppliedTerms } from "./provenance.js";
import { ClassificationZ, normalizeSufficiencyChecks } from "../routes/analyze-report.js";

// Mirrors the live-audit case: the notes say the roster was NOT supplied, but
// the model labelled the investigator's description of it as an original
// record and wrote "confirmed by roster records" / "corroborated by
// documentary evidence".
const NOTES = [
  "Case #2026-0412",
  "Investigator summary: per the unit roster, Employee B was assigned to Unit 4 on 3/10.",
  "Original roster not supplied, investigator summary only.",
  "Charge Nurse A stated Employee B was working on Unit 4 that afternoon.",
  "Employee B stated she opened the chart but did so to check a lab order.",
  "Employee B denied any intent to snoop.",
  "Pharmacist C stated the chart was opened at 9pm, after Employee B's shift ended.",
].join("\n");

function classification(overrides = {}) {
  return {
    decision: "needs_more_info",
    riskLevel: "moderate",
    violationType: "privacy",
    violationCount: "1",
    recommendationTier: "policy_review",
    aggravatingFactors: [],
    mitigatingFactors: [],
    notesCompleteness: "partial",
    missingElements: [],
    evidenceItems: [
      { id: "E1", sourceLabel: "Investigator summary", lineStart: 2, lineEnd: 2, evidenceType: "document", provenance: "original_record", stance: "supports", summary: "Roster shows Employee B assigned to Unit 4." },
      { id: "E2", sourceLabel: "Charge Nurse A", lineStart: 4, lineEnd: 4, evidenceType: "interview", provenance: "statement", stance: "supports", summary: "Charge nurse places Employee B on Unit 4." },
      { id: "E3", sourceLabel: "Employee B", lineStart: 5, lineEnd: 5, evidenceType: "interview", provenance: "statement", stance: "supports", summary: "Employee B admits opening the chart." },
      { id: "E4", sourceLabel: "Employee B", lineStart: 6, lineEnd: 6, evidenceType: "interview", provenance: "statement", stance: "contradicts", summary: "Employee B denies intent." },
      { id: "E5", sourceLabel: "Pharmacist C", lineStart: 7, lineEnd: 7, evidenceType: "interview", provenance: "statement", stance: "contradicts", summary: "Pharmacist C places the access after the shift." },
    ],
    findings: [
      {
        id: "F1",
        statement: "Employee B was assigned to Unit 4, as confirmed by roster records and corroborated by documentary evidence.",
        inference: "The roster records show the assignment.",
        evidenceStatus: "corroborated",
        supportingEvidenceIds: ["E1", "E2"],
        contradictingEvidenceIds: [],
        conflicts: [],
      },
      {
        // The audit bug: a denial of motive marked "Contradicted" against an
        // admitted act, with the model even supplying a conflicts entry.
        id: "F2",
        statement: "Employee B opened the patient's chart.",
        inference: "Admitted by Employee B.",
        evidenceStatus: "contradicted",
        supportingEvidenceIds: ["E3"],
        contradictingEvidenceIds: ["E4"],
        conflicts: [{ point: "Whether Employee B snooped", supportingEvidenceId: "E3", contradictingEvidenceId: "E4" }],
      },
    ],
    hypotheses: [{ id: "H1", label: "Unauthorized access", description: "Roster records confirm Employee B was on the unit.", state: "unresolved", supportingEvidenceIds: ["E1"], contradictingEvidenceIds: [], unresolvedQuestions: [] }],
    sufficiencyChecks: [],
    closureRationale: "Presence is corroborated by documentary evidence; the purpose is unresolved.",
    whatWouldChangeConclusion: [],
    disciplineFactors: [],
    disciplineRange: { minimum: "coaching", maximum: "termination", recommended: "defer", rationale: "Policy needed.", policyDependent: true, requiresHrLegalReview: true },
    policyQuestions: [],
    ...overrides,
  };
}

const DOCUMENTARY_CLAIM = /confirmed by roster records|roster records (show|confirm)|corroborated by documentary|documentary evidence|reviewed the roster|review of the roster/i;

describe("provenance honesty: a record the notes say was NOT supplied", () => {
  it("extracts the unsupplied record from the notes", () => {
    expect([...extractUnsuppliedTerms(NOTES.split("\n"))]).toEqual(["roster"]);
  });

  it("labels evidence about it as an investigator summary, whatever the model claimed", () => {
    const result = hydrateEvidenceTraceability(classification(), NOTES);
    const e1 = result.evidenceItems.find((item) => item.id === "E1");
    expect(e1.provenance).toBe("investigator_summary");
    expect(e1.provenanceNote).toMatch(/original roster was not supplied/i);
    expect(result.evidenceItems.find((item) => item.id === "E2").provenance).toBe("statement");
  });

  it("never claims documentary corroboration in the analysis, and says 'per investigator summary'", () => {
    const result = hydrateEvidenceTraceability(classification(), NOTES);
    const f1 = result.findings.find((finding) => finding.id === "F1");
    expect(f1.statement).not.toMatch(DOCUMENTARY_CLAIM);
    expect(f1.inference).not.toMatch(DOCUMENTARY_CLAIM);
    expect(f1.statement).toMatch(/per investigator summary/i);
    // The summary is not an independent source, so one witness is not corroboration.
    expect(f1.evidenceStatus).toBe("single_source");
    expect(result.closureRationale).not.toMatch(DOCUMENTARY_CLAIM);
    expect(result.hypotheses[0].description).not.toMatch(DOCUMENTARY_CLAIM);
  });

  it("never claims the record was reviewed or corroborated anything in the written report", () => {
    const hydrated = hydrateEvidenceTraceability(classification(), NOTES);
    const report = {
      introduction: "The investigator reviewed the roster and interviewed staff.",
      incidentOverview: "Roster records confirm Employee B was assigned to Unit 4.",
      incidentDetails: "The assignment was verified against the roster.",
      investigationFindings: [
        { statement: "Employee B's assignment is corroborated by documentary evidence.", supportingFindingIds: ["F1"] },
      ],
      regulationsCited: [],
      recommendations: "Obtain the original roster.",
      conclusion: "Documentary evidence establishes that Employee B was on the unit.",
      missingInfo: [],
    };
    const checked = enforceReportProvenance(report, hydrated, NOTES);
    for (const field of ["introduction", "incidentOverview", "incidentDetails", "conclusion"]) {
      expect(checked[field]).not.toMatch(DOCUMENTARY_CLAIM);
    }
    const [statement] = groundReportFindings(checked.investigationFindings, hydrated);
    expect(statement).not.toMatch(DOCUMENTARY_CLAIM);
    expect(statement).toMatch(/per investigator summary/i);
    // Asking for the record is still allowed.
    expect(checked.recommendations).toBe("Obtain the original roster.");
  });

  it("leaves a genuinely supplied record alone", () => {
    const notes = "Unit roster (attached): Employee B, Unit 4, 3/10.\nCharge Nurse A placed Employee B on Unit 4.";
    const result = hydrateEvidenceTraceability(classification({
      evidenceItems: [
        { id: "E1", sourceLabel: "Unit roster", lineStart: 1, lineEnd: 1, evidenceType: "document", provenance: "original_record", stance: "supports", summary: "Roster shows the assignment." },
        { id: "E2", sourceLabel: "Charge Nurse A", lineStart: 2, lineEnd: 2, evidenceType: "interview", provenance: "statement", stance: "supports", summary: "Charge nurse places B on Unit 4." },
      ],
      findings: [{ id: "F1", statement: "Employee B was assigned to Unit 4, as confirmed by roster records.", inference: "", evidenceStatus: "corroborated", supportingEvidenceIds: ["E1", "E2"], contradictingEvidenceIds: [], conflicts: [] }],
    }), notes);
    expect(result.evidenceItems[0].provenance).toBe("original_record");
    expect(result.findings[0].statement).toBe("Employee B was assigned to Unit 4, as confirmed by roster records.");
    expect(result.findings[0].evidenceStatus).toBe("corroborated");
  });
});

describe("contradiction labelling", () => {
  it("does not mark an admitted act contradicted by the same person's denial of motive", () => {
    const result = hydrateEvidenceTraceability(classification(), NOTES);
    const f2 = result.findings.find((finding) => finding.id === "F2");
    expect(f2.evidenceStatus).not.toBe("contradicted");
    expect(f2.conflicts).toEqual([]);
    expect(f2.contradictingEvidenceIds).toEqual([]);
    expect(f2.contextEvidenceIds).toEqual(["E4"]);
  });

  it("marks contradicted when two different sources conflict on the same fact, and keeps both sides", () => {
    const base = classification();
    const result = hydrateEvidenceTraceability(classification({
      findings: [
        ...base.findings.slice(0, 1),
        {
          id: "F2",
          statement: "Employee B opened the chart during her shift.",
          inference: "",
          evidenceStatus: "supported",
          supportingEvidenceIds: ["E3"],
          contradictingEvidenceIds: ["E5"],
          conflicts: [{ point: "When the chart was opened", supportingEvidenceId: "E3", contradictingEvidenceId: "E5" }],
        },
      ],
    }), NOTES);
    const f2 = result.findings.find((finding) => finding.id === "F2");
    expect(f2.evidenceStatus).toBe("contradicted");
    expect(f2.conflicts).toEqual([{ point: "When the chart was opened", supportingEvidenceId: "E3", contradictingEvidenceId: "E5" }]);
    const excerpts = Object.fromEntries(result.evidenceItems.map((item) => [item.id, item.excerpt]));
    expect(excerpts.E3).toMatch(/opened the chart/);
    expect(excerpts.E5).toMatch(/after Employee B's shift ended/);
  });

  it("ignores contradicting evidence the model gave no conflicts entry for", () => {
    const result = hydrateEvidenceTraceability(classification({
      findings: [{ id: "F2", statement: "Employee B opened the chart.", inference: "", evidenceStatus: "contradicted", supportingEvidenceIds: ["E3"], contradictingEvidenceIds: ["E5"], conflicts: [] }],
    }), NOTES);
    expect(result.findings[0].evidenceStatus).toBe("single_source");
    expect(result.findings[0].contextEvidenceIds).toEqual(["E5"]);
  });
});

describe("signed classification round-trip", () => {
  // Same steps as the route: classify signs hydrate(normalize(parse(model)));
  // the report step re-runs them on the signed result and must get an
  // identical object, or the integrity check rejects the report.
  function classifyStep(raw) {
    const parsed = ClassificationZ.parse(raw);
    parsed.sufficiencyChecks = normalizeSufficiencyChecks(parsed.sufficiencyChecks);
    return hydrateEvidenceTraceability(parsed, NOTES);
  }

  it("re-validating and re-hydrating on the report step reproduces the signed classification exactly", () => {
    const signed = classifyStep(classification());
    expect(classifyStep(JSON.parse(JSON.stringify(signed)))).toEqual(signed);
  });
});
