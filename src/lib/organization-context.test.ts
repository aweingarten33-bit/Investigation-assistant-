import { describe, expect, it } from "vitest";
import {
  buildOrganizationContext,
  EMPTY_ORGANIZATION_DISCIPLINE_CONFIG,
  organizationConfigHasContent,
} from "./organization-context";

describe("organization discipline context", () => {
  it("serializes only organization-provided decision criteria with clear labels", () => {
    const context = buildOrganizationContext({
      ...EMPTY_ORGANIZATION_DISCIPLINE_CONFIG,
      standardOfProof: "More likely than not",
      actionMatrix: "Serious intentional privacy violations require HR review; available range is final warning through termination.",
      cbaLabor: "Progressive discipline applies unless serious-misconduct exception is met.",
    });

    expect(context).toContain("STANDARD OF PROOF / FINDING RULE:\nMore likely than not");
    expect(context).toContain("ORGANIZATION DISCIPLINARY / CORRECTIVE-ACTION MATRIX:");
    expect(context).toContain("CBA / UNION / DUE-PROCESS REQUIREMENTS:");
    expect(context).not.toContain("ANONYMIZED COMPARABLE PRECEDENT:");
  });

  it("reports whether any organization-specific criteria were supplied", () => {
    expect(organizationConfigHasContent(EMPTY_ORGANIZATION_DISCIPLINE_CONFIG)).toBe(false);
    expect(organizationConfigHasContent({
      ...EMPTY_ORGANIZATION_DISCIPLINE_CONFIG,
      requiredApprovals: "Termination requires HR + Legal approval",
    })).toBe(true);
  });
});
