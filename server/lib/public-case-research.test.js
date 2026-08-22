// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildPublicResearchQuery,
  describePublicResearchProfile,
  isAllowedPublicResearchProfile,
} from "./public-case-research.js";

const safeProfile = {
  issueCategory: "hipaa_unauthorized_access",
  setting: "hospital_health_system",
  pattern: "unauthorized_record_access",
  intent: "intentional",
  scope: "repeated_pattern",
  factors: ["sensitive_or_behavioral_health_records", "personal_relationship_or_curiosity"],
};

describe("public-case research profile", () => {
  it("builds a useful query entirely from allow-listed profile values", () => {
    expect(isAllowedPublicResearchProfile(safeProfile)).toBe(true);
    const query = buildPublicResearchQuery(safeProfile);
    expect(query).toContain("HIPAA unauthorized workforce access");
    expect(query).toContain("hospital or health system");
    expect(query).toContain("repeated pattern");
    expect(query).toContain("sensitive or behavioral-health information");
  });

  it("rejects injected/free-text values instead of letting them become a public search query", () => {
    const malicious = {
      ...safeProfile,
      setting: "Hospital X employee John Smith patient Jane Doe",
    };
    expect(isAllowedPublicResearchProfile(malicious)).toBe(false);
    expect(buildPublicResearchQuery(malicious)).toBe("");
    expect(describePublicResearchProfile(malicious)).toBe("");
  });

  it("does not require names, dates, quotes, or employer identifiers to create a specific analog search", () => {
    const query = buildPublicResearchQuery(safeProfile);
    expect(query).not.toMatch(/John|Jane|Hospital X|2026-08-22|\"/);
    expect(query.length).toBeGreaterThan(150);
  });
});
