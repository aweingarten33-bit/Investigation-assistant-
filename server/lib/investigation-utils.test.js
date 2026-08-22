// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildInputHash,
  hydrateEvidenceTraceability,
  numberReportLines,
  splitReportLines,
} from "./investigation-utils.js";

function baseClassification(overrides = {}) {
  return {
    evidenceItems: [],
    findings: [],
    disciplineFactors: [],
    ...overrides,
  };
}

describe("investigation evidence utilities", () => {
  it("normalizes line endings and creates stable line labels", () => {
    const text = "Interview Notes\r\nEmployee denied access\rAccess log shows view";
    expect(splitReportLines(text)).toEqual(["Interview Notes", "Employee denied access", "Access log shows view"]);
    expect(numberReportLines(text)).toBe("[L0001] Interview Notes\n[L0002] Employee denied access\n[L0003] Access log shows view");
  });

  it("binds the input hash to both case notes and organization context", () => {
    const a = buildInputHash("same notes", "policy A");
    const b = buildInputHash("same notes", "policy B");
    const c = buildInputHash("changed notes", "policy A");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(a).toBe(buildInputHash("same notes", "policy A"));
  });

  it("reconstructs evidence excerpts from exact source lines", () => {
    const notes = [
      "Interview Notes — Employee A",
      "Employee A stated access was for work purposes.",
      "Access Audit",
      "Audit shows Patient B record opened at 10:14 AM.",
    ].join("\n");

    const result = hydrateEvidenceTraceability(baseClassification({
      evidenceItems: [
        { id: "E1", sourceLabel: "Interview Notes — Employee A", lineStart: 2, lineEnd: 2, evidenceType: "interview", stance: "contradicts", summary: "Employee gave a work-purpose explanation." },
        { id: "E2", sourceLabel: "Access Audit", lineStart: 4, lineEnd: 4, evidenceType: "audit", stance: "supports", summary: "Audit confirms the record was opened." },
      ],
      findings: [
        { id: "F1", statement: "Employee accessed Patient B's record.", inference: "The access log supports that an access occurred; authorization still requires separate evidence.", evidenceStatus: "supported", supportingEvidenceIds: ["E2"], contradictingEvidenceIds: ["E1"] },
      ],
    }), notes);

    expect(result.evidenceItems[0].excerpt).toBe("Employee A stated access was for work purposes.");
    expect(result.evidenceItems[1].reference).toBe("Access Audit — line 4");
    expect(result.findings[0].evidenceStatus).toBe("contradicted");
  });

  it("drops invented evidence references from findings", () => {
    const result = hydrateEvidenceTraceability(baseClassification({
      evidenceItems: [
        { id: "E1", sourceLabel: "Notes", lineStart: 1, lineEnd: 1, evidenceType: "document", stance: "supports", summary: "Documented fact" },
      ],
      findings: [
        { id: "F1", statement: "Finding", inference: "Inference", evidenceStatus: "corroborated", supportingEvidenceIds: ["E1", "E999"], contradictingEvidenceIds: ["E404"] },
      ],
    }), "Documented fact");

    expect(result.findings[0].supportingEvidenceIds).toEqual(["E1"]);
    expect(result.findings[0].contradictingEvidenceIds).toEqual([]);
    expect(result.findings[0].evidenceStatus).toBe("single_source");
  });

  it("rejects out-of-range evidence citations instead of silently clamping them onto real text", () => {
    const result = hydrateEvidenceTraceability(baseClassification({
      evidenceItems: [
        { id: "E1", sourceLabel: "Notes", lineStart: 999, lineEnd: 1200, evidenceType: "document", stance: "context", summary: "Out-of-range model reference" },
      ],
      findings: [
        { id: "F1", statement: "Finding", inference: "Inference", evidenceStatus: "supported", supportingEvidenceIds: ["E1"], contradictingEvidenceIds: [] },
      ],
    }), "Line one\nLine two");

    expect(result.evidenceItems).toEqual([]);
    expect(result.findings[0].supportingEvidenceIds).toEqual([]);
    expect(result.findings[0].evidenceStatus).toBe("insufficient");
  });

  it("rejects reversed line ranges", () => {
    const result = hydrateEvidenceTraceability(baseClassification({
      evidenceItems: [
        { id: "E1", sourceLabel: "Notes", lineStart: 2, lineEnd: 1, evidenceType: "document", stance: "supports", summary: "Invalid range" },
      ],
    }), "Line one\nLine two");
    expect(result.evidenceItems).toEqual([]);
  });

  it("marks contradiction-only findings contradicted", () => {
    const result = hydrateEvidenceTraceability(baseClassification({
      evidenceItems: [
        { id: "E1", sourceLabel: "Interview", lineStart: 1, lineEnd: 1, evidenceType: "interview", stance: "contradicts", summary: "Contrary evidence" },
      ],
      findings: [
        { id: "F1", statement: "Finding", inference: "Inference", evidenceStatus: "supported", supportingEvidenceIds: [], contradictingEvidenceIds: ["E1"] },
      ],
    }), "Contrary evidence");
    expect(result.findings[0].evidenceStatus).toBe("contradicted");
  });

  it("marks a finding corroborated only when two valid supporting items remain and no contradiction remains", () => {
    const result = hydrateEvidenceTraceability(baseClassification({
      evidenceItems: [
        { id: "E1", sourceLabel: "Witness", lineStart: 1, lineEnd: 1, evidenceType: "interview", stance: "supports", summary: "Witness statement" },
        { id: "E2", sourceLabel: "Audit", lineStart: 2, lineEnd: 2, evidenceType: "audit", stance: "supports", summary: "Audit record" },
      ],
      findings: [
        { id: "F1", statement: "Finding", inference: "Inference", evidenceStatus: "supported", supportingEvidenceIds: ["E1", "E2"], contradictingEvidenceIds: [] },
      ],
    }), "Witness statement\nAudit record");

    expect(result.findings[0].evidenceStatus).toBe("corroborated");
  });

  it("preserves unknown discipline factors but strips invalid evidence IDs", () => {
    const result = hydrateEvidenceTraceability(baseClassification({
      evidenceItems: [
        { id: "E1", sourceLabel: "Policy", lineStart: 1, lineEnd: 1, evidenceType: "policy", stance: "context", summary: "Policy text" },
      ],
      disciplineFactors: [
        { factor: "policy_language", assessment: "Policy is documented.", impact: "neutral", evidenceIds: ["E1", "FAKE"] },
        { factor: "cba_union", assessment: "No CBA information supplied.", impact: "unknown", evidenceIds: [] },
      ],
    }), "Policy text");

    expect(result.disciplineFactors[0].evidenceIds).toEqual(["E1"]);
    expect(result.disciplineFactors[1].impact).toBe("unknown");
  });
});
