// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("../lib/ai.js", () => ({
  callStructured: vi.fn(),
  callTextWithSearch: vi.fn(),
}));

import { callStructured } from "../lib/ai.js";
import { ClassificationZ, callStructuredWithRetry, describeZodIssues } from "./analyze-report.js";

function wellFormedClassification() {
  return {
    decision: "needs_more_info",
    riskLevel: "low",
    violationType: "",
    violationCount: "",
    recommendationTier: "policy_review",
    aggravatingFactors: [],
    mitigatingFactors: [],
    notesCompleteness: "partial",
    missingElements: [],
    evidenceItems: [],
    findings: [],
    hypotheses: [{ id: "H1", label: "L", description: "D", state: "unresolved", supportingEvidenceIds: [], contradictingEvidenceIds: [], unresolvedQuestions: [] }],
    sufficiencyChecks: [],
    closureRationale: "Not enough information yet.",
    whatWouldChangeConclusion: [],
    disciplineFactors: [],
    disciplineRange: { minimum: "none", maximum: "none", recommended: "defer pending review", rationale: "Insufficient information.", policyDependent: true, requiresHrLegalReview: false },
    policyQuestions: [],
  };
}

// Reproduces the exact production failure reported from Render logs:
// hypotheses returned as a string instead of an array, and
// closureRationale/disciplineFactors/disciplineRange missing entirely —
// the signature of a response cut off mid-generation (confirmed via
// stop_reason logging added alongside this fix).
function truncatedClassification() {
  const { closureRationale, disciplineFactors, disciplineRange, ...rest } = wellFormedClassification();
  return { ...rest, hypotheses: "Hypothesis 1: unauthorized access. Hypothesis 2: legitimate work purpose." };
}

describe("the exact production bug", () => {
  it("reproduces: a truncated-looking response fails ClassificationZ validation on all four reported fields", () => {
    const result = ClassificationZ.safeParse(truncatedClassification());
    expect(result.success).toBe(false);
    const paths = result.error.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["hypotheses", "closureRationale", "disciplineFactors", "disciplineRange"]));
  });
});

describe("describeZodIssues", () => {
  it("produces one concrete, actionable line per validation failure", () => {
    const result = ClassificationZ.safeParse(truncatedClassification());
    const description = describeZodIssues(result.error);
    expect(description).toContain("hypotheses: Expected array, received string");
    expect(description).toMatch(/closureRationale:.*Required/);
    expect(description).toMatch(/disciplineFactors:.*Required/);
    expect(description).toMatch(/disciplineRange:.*Required/);
  });
});

describe("callStructuredWithRetry", () => {
  beforeEach(() => {
    callStructured.mockReset();
  });

  it("recovers by feeding the exact validation failure back on retry, never fabricating the missing fields", async () => {
    callStructured
      .mockResolvedValueOnce(truncatedClassification())
      .mockResolvedValueOnce(wellFormedClassification());

    const result = await callStructuredWithRetry(
      "system prompt",
      "original case notes",
      {},
      "investigation_evidence_classification",
      ClassificationZ,
      16_384,
    );

    expect(result.closureRationale).toBe("Not enough information yet.");
    expect(Array.isArray(result.hypotheses)).toBe(true);
    expect(result.disciplineRange).toBeTruthy();
    expect(callStructured).toHaveBeenCalledTimes(2);

    // The retry must carry concrete corrective feedback, not a blind repeat
    // of the same prompt — and must still include the original content.
    const [, secondMessage, , , secondMaxTokens] = callStructured.mock.calls[1];
    expect(secondMessage).toContain("original case notes");
    expect(secondMessage).toContain("hypotheses");
    expect(secondMessage).toContain("closureRationale");
    expect(secondMessage).toContain("disciplineFactors");
    expect(secondMessage).toContain("disciplineRange");
    expect(secondMaxTokens).toBe(16_384);
  });

  it("fails clearly after exactly one bounded retry — no endless loop", async () => {
    callStructured.mockResolvedValue(truncatedClassification());

    await expect(
      callStructuredWithRetry("system prompt", "notes", {}, "investigation_evidence_classification", ClassificationZ, 16_384),
    ).rejects.toBeInstanceOf(ZodError);
    expect(callStructured).toHaveBeenCalledTimes(2);
  });

  it("never fabricates hypothesis objects from an arbitrary string when the retry also fails", async () => {
    callStructured.mockResolvedValue(truncatedClassification());

    let caught;
    try {
      await callStructuredWithRetry("s", "m", {}, "investigation_evidence_classification", ClassificationZ, 16_384);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ZodError);
    expect(caught.issues.some((issue) => issue.path.join(".") === "hypotheses" && issue.message.includes("array"))).toBe(true);
  });

  it("does not retry a non-validation error (e.g. an upstream API failure)", async () => {
    callStructured.mockRejectedValue(new Error("Anthropic error (529): overloaded"));

    await expect(
      callStructuredWithRetry("s", "m", {}, "investigation_evidence_classification", ClassificationZ, 16_384),
    ).rejects.toThrow("overloaded");
    expect(callStructured).toHaveBeenCalledTimes(1);
  });
});
