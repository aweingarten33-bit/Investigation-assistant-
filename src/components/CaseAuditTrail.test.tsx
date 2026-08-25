import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaseAuditTrail } from "./CaseAuditTrail";
import type { AnalysisResult } from "@/lib/types";

function result(): AnalysisResult {
  return {
    decision: "substantiated",
    riskLevel: "high",
    violationType: "privacy",
    violationCount: "1",
    recommendationTier: "policy_review",
    aggravatingFactors: [],
    mitigatingFactors: [],
    notesCompleteness: "complete",
    evidenceItems: [],
    findings: [],
    disciplineFactors: [],
    disciplineRange: { minimum: "coaching", maximum: "termination", recommended: "defer pending policy review", rationale: "Policy required", policyDependent: true, requiresHrLegalReview: true },
    policyQuestions: [],
    introduction: "",
    incidentOverview: "",
    incidentDetails: "",
    investigationFindings: [],
    regulationsCited: [],
    recommendations: "",
    conclusion: "",
    missingInfo: null,
    caseId: "CASE-1",
    analysisMetadata: {
      analysisVersion: "investigation-workbench-v2",
      generatedAt: "2026-08-22T10:00:00.000Z",
      sourceFingerprint: "abc123",
      organizationContextApplied: true,
      researchTopic: "HIPAA workforce access controls and unauthorized record access",
      evidenceCount: 2,
      findingCount: 1,
    },
  };
}

describe("CaseAuditTrail", () => {
  it("shows version, fingerprint and human-review status", () => {
    render(<CaseAuditTrail result={result()} />);
    expect(screen.getByText("Case Provenance & Review Trail")).toBeInTheDocument();
    expect(screen.getByText("investigation-workbench-v2")).toBeInTheDocument();
    expect(screen.getByText("abc123")).toBeInTheDocument();
    expect(screen.getByText(/No final human review has been recorded/i)).toBeInTheDocument();
  });
});
