// Route-level input validation, tested directly against the exported pure
// functions rather than through an HTTP harness — same convention as
// analyze-report.test.js (describeZodIssues/callStructuredWithRetry). These
// are the guards that keep malformed human input from ever reaching the
// graph via POST /resume, and malformed case setup from ever reaching
// POST /start.
import { describe, expect, it } from "vitest";
import { parseResumeBody, parseStartBody } from "./investigations.js";

describe("parseStartBody", () => {
  it("accepts a minimal valid body", () => {
    const result = parseStartBody({ caseNotes: "Medication count discrepancy on Unit 4B." });
    expect(result.success).toBe(true);
    expect(result.data.caseNotes).toBe("Medication count discrepancy on Unit 4B.");
    expect(result.data.caseObjective).toBe("");
  });

  it("rejects an empty caseNotes", () => {
    const result = parseStartBody({ caseNotes: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing body entirely", () => {
    const result = parseStartBody(undefined);
    expect(result.success).toBe(false);
  });

  it("tolerates a non-string optional field by falling back rather than failing the whole request", () => {
    const result = parseStartBody({ caseNotes: "Valid notes here.", caseObjective: 12345 });
    expect(result.success).toBe(true);
    expect(result.data.caseObjective).toBe("");
  });
});

describe("parseResumeBody", () => {
  it("accepts a valid human result", () => {
    const result = parseResumeBody({ resultType: "interview_notes", text: "Alvarez states she did not administer the second dose." });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown resultType", () => {
    const result = parseResumeBody({ resultType: "not_a_real_type", text: "something" });
    expect(result.success).toBe(false);
  });

  it("rejects empty text", () => {
    const result = parseResumeBody({ resultType: "response", text: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing body entirely", () => {
    const result = parseResumeBody(undefined);
    expect(result.success).toBe(false);
  });

  it("rejects text that is not a string", () => {
    const result = parseResumeBody({ resultType: "response", text: 42 });
    expect(result.success).toBe(false);
  });
});
