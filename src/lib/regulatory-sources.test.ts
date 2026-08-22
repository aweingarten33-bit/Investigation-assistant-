import { describe, expect, it } from "vitest";
import { REGULATORY_SOURCES, isRegulatorySourceStale } from "./regulatory-sources";

describe("regulatory source registry", () => {
  it("requires traceable governance metadata on every source", () => {
    for (const source of Object.values(REGULATORY_SOURCES)) {
      expect(source.id).toBeTruthy();
      expect(source.authority).toBeTruthy();
      expect(source.jurisdiction).toBeTruthy();
      expect(source.citation).toBeTruthy();
      expect(source.url).toMatch(/^https:\/\//);
      expect(source.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(source.version).toBeTruthy();
      expect(source.revisionHistory.length).toBeGreaterThan(0);
      expect(source.revisionHistory.at(-1)?.version).toBe(source.version);
      expect(source.revisionHistory.at(-1)?.verifiedOn).toBe(source.lastVerified);
    }
  });

  it("does not assign an effective date to a proposed rule", () => {
    expect(REGULATORY_SOURCES.hipaa_security_nprm_2024.status).toBe("proposed");
    expect(REGULATORY_SOURCES.hipaa_security_nprm_2024.effectiveDate).toBeNull();
  });

  it("contains current hospital-specific reporting sources", () => {
    expect(REGULATORY_SOURCES.nyports_hospital_adverse_events.status).toBe("current");
    expect(REGULATORY_SOURCES.ny_hospital_professional_misconduct.status).toBe("current");
    expect(REGULATORY_SOURCES.dea_theft_significant_loss.status).toBe("current");
    expect(REGULATORY_SOURCES.emtala_recipient_hospital_reporting.status).toBe("current");
  });

  it("contains current Part 2, New York privacy, and LTC timing sources", () => {
    expect(REGULATORY_SOURCES.part2_breach_notification.effectiveDate).toBe("2026-02-16");
    expect(REGULATORY_SOURCES.ny_data_breach_899aa.status).toBe("current");
    expect(REGULATORY_SOURCES.cms_ltc_alleged_violations.status).toBe("current");
    expect(REGULATORY_SOURCES.ny_phl_2803d.status).toBe("current");
  });

  it("flags a source for re-verification after the freshness threshold", () => {
    const source = REGULATORY_SOURCES.hipaa_individual_notice;
    expect(isRegulatorySourceStale(source, new Date("2026-12-01T00:00:00Z"), 365)).toBe(false);
    expect(isRegulatorySourceStale(source, new Date("2027-09-01T00:00:00Z"), 365)).toBe(true);
  });
});