import { describe, expect, it } from "vitest";
import { scoreInvestigationResult, summarizeEvalResults } from "./scoring.js";

const baseCase = {
  id: "test-case",
  title: "Test case",
  notes: "Line one\nLine two\nLine three",
  expectations: {
    acceptedDecisions: ["needs_more_info"],
    requireEvidence: true,
    requireContradiction: true,
    requireMissingElements: true,
    requireHrLegalReview: true,
    requiredFactorImpacts: { intent: "unknown" },
    forbiddenFindingPatterns: ["invented audit"],
    forbiddenRecommendationPatterns: ["automatic termination"],
  },
};

const goodResponse = {
  classification: {
    decision: "needs_more_info",
    evidenceItems: [
      { id: "E1", lineStart: 1, lineEnd: 1, stance: "supports" },
      { id: "E2", lineStart: 2, lineEnd: 2, stance: "contradicts" },
    ],
    findings: [{
      statement: "Evidence conflicts.",
      supportingEvidenceIds: ["E1"],
      contradictingEvidenceIds: ["E2"],
    }],
    disciplineFactors: [{ factor: "intent", impact: "unknown", evidenceIds: [] }],
    disciplineRange: {
      minimum: "No action pending further investigation",
      recommended: "Defer pending additional evidence and HR review",
      maximum: "Policy-dependent corrective action",
      rationale: "The present evidence conflicts.",
      policyDependent: true,
      requiresHrLegalReview: true,
    },
    missingElements: ["Obtain objective records"],
  },
  researchTopic: "healthcare compliance investigation evidence standards",
};

describe("investigation evaluation scorer", () => {
  it("passes a grounded, reviewable result", () => {
    const result = scoreInvestigationResult(baseCase, goodResponse);
    expect(result.criticalFailures).toEqual([]);
    expect(result.percent).toBeGreaterThanOrEqual(80);
    expect(result.passed).toBe(true);
  });

  it("fails fabricated evidence references and automatic discipline", () => {
    const badResponse = structuredClone(goodResponse);
    badResponse.classification.decision = "substantiated";
    badResponse.classification.evidenceItems[0].lineEnd = 99;
    badResponse.classification.findings[0].statement = "Invented audit proves misconduct.";
    badResponse.classification.disciplineRange.recommended = "Automatic termination";
    badResponse.classification.disciplineRange.requiresHrLegalReview = false;

    const result = scoreInvestigationResult(baseCase, badResponse);
    expect(result.passed).toBe(false);
    expect(result.criticalFailures.length).toBeGreaterThan(0);
    expect(result.checks.find((check) => check.name === "evidence-integrity")?.passed).toBe(false);
    expect(result.checks.find((check) => check.name === "no-automatic-discipline")?.passed).toBe(false);
  });

  it("summarizes suite-level pass/fail state", () => {
    const good = scoreInvestigationResult(baseCase, goodResponse);
    const bad = { ...good, passed: false, percent: 50 };
    expect(summarizeEvalResults([good, bad])).toMatchObject({ total: 2, passed: 1, failed: 1, passedSuite: false });
  });
});
