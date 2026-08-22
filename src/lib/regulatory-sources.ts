export type RegulatorySourceStatus = "current" | "proposed" | "guidance";

export type RegulatorySource = {
  id: string;
  title: string;
  authority: string;
  jurisdiction: string;
  sourceType: "regulation" | "agency-guidance" | "proposed-rule" | "compliance-guidance";
  citation: string;
  url: string;
  status: RegulatorySourceStatus;
  effectiveDate: string | null;
  publishedDate?: string;
  lastVerified: string;
  version: string;
  revisionHistory: Array<{
    version: string;
    verifiedOn: string;
    note: string;
  }>;
};

export const REGULATORY_SOURCES = {
  hipaa_individual_notice: {
    id: "hipaa_individual_notice",
    title: "HIPAA Breach Notification — Notice to Individuals",
    authority: "U.S. Department of Health and Human Services (HHS)",
    jurisdiction: "United States — Federal",
    sourceType: "regulation",
    citation: "45 CFR §164.404",
    url: "https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html",
    status: "current",
    effectiveDate: "2013-03-26",
    lastVerified: "2026-08-22",
    version: "2026-08-22.1",
    revisionHistory: [
      {
        version: "2026-08-22.1",
        verifiedOn: "2026-08-22",
        note: "Verified 60-day outer limit and without-unreasonable-delay language against current HHS guidance and codified rule.",
      },
    ],
  },
  hipaa_secretary_notice: {
    id: "hipaa_secretary_notice",
    title: "HIPAA Breach Notification — Notice to the Secretary",
    authority: "U.S. Department of Health and Human Services (HHS)",
    jurisdiction: "United States — Federal",
    sourceType: "regulation",
    citation: "45 CFR §164.408",
    url: "https://www.hhs.gov/hipaa/for-professionals/breach-notification/breach-reporting/index.html",
    status: "current",
    effectiveDate: "2013-03-26",
    lastVerified: "2026-08-22",
    version: "2026-08-22.1",
    revisionHistory: [
      {
        version: "2026-08-22.1",
        verifiedOn: "2026-08-22",
        note: "Verified separate reporting timing for breaches affecting 500 or more individuals and fewer than 500 individuals.",
      },
    ],
  },
  hipaa_business_associate_notice: {
    id: "hipaa_business_associate_notice",
    title: "HIPAA Breach Notification — Business Associate Notice",
    authority: "U.S. Department of Health and Human Services (HHS)",
    jurisdiction: "United States — Federal",
    sourceType: "regulation",
    citation: "45 CFR §164.410",
    url: "https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html",
    status: "current",
    effectiveDate: "2013-03-26",
    lastVerified: "2026-08-22",
    version: "2026-08-22.1",
    revisionHistory: [
      {
        version: "2026-08-22.1",
        verifiedOn: "2026-08-22",
        note: "Verified business-associate notification requirement and 60-day federal outer limit; contractual BAAs may be shorter.",
      },
    ],
  },
  cms_ltc_alleged_violations: {
    id: "cms_ltc_alleged_violations",
    title: "LTC Reporting of Alleged Violations",
    authority: "Centers for Medicare & Medicaid Services (CMS)",
    jurisdiction: "United States — Federal / Medicare and Medicaid LTC facilities",
    sourceType: "regulation",
    citation: "42 CFR §483.12(c); State Operations Manual Appendix PP, F609",
    url: "https://www.cms.gov/medicare/provider-enrollment-and-certification/guidanceforlawsandregulations/nursing-homes",
    status: "current",
    effectiveDate: "2016-11-28",
    lastVerified: "2026-08-22",
    version: "2026-08-22.1",
    revisionHistory: [
      {
        version: "2026-08-22.1",
        verifiedOn: "2026-08-22",
        note: "Verified that the 2-hour/24-hour framework is scoped to covered LTC alleged-violation reporting under §483.12(c), not a universal hospital deadline.",
      },
    ],
  },
  hipaa_security_nprm_2024: {
    id: "hipaa_security_nprm_2024",
    title: "HIPAA Security Rule Notice of Proposed Rulemaking",
    authority: "U.S. Department of Health and Human Services (HHS)",
    jurisdiction: "United States — Federal",
    sourceType: "proposed-rule",
    citation: "HIPAA Security Rule NPRM (published January 6, 2025)",
    url: "https://www.hhs.gov/hipaa/for-professionals/security/hipaa-security-rule-nprm/factsheet/index.html",
    status: "proposed",
    effectiveDate: null,
    publishedDate: "2025-01-06",
    lastVerified: "2026-08-22",
    version: "2026-08-22.1",
    revisionHistory: [
      {
        version: "2026-08-22.1",
        verifiedOn: "2026-08-22",
        note: "Verified that the 72-hour item concerns proposed restoration procedures for certain systems/data; it is not a 72-hour HHS breach-notification deadline.",
      },
    ],
  },
  oig_gcpg: {
    id: "oig_gcpg",
    title: "General Compliance Program Guidance",
    authority: "HHS Office of Inspector General (OIG)",
    jurisdiction: "United States — Federal healthcare compliance guidance",
    sourceType: "compliance-guidance",
    citation: "OIG General Compliance Program Guidance (November 2023)",
    url: "https://oig.hhs.gov/compliance/general-compliance-program-guidance/",
    status: "guidance",
    effectiveDate: null,
    publishedDate: "2023-11-06",
    lastVerified: "2026-08-22",
    version: "2026-08-22.1",
    revisionHistory: [
      {
        version: "2026-08-22.1",
        verifiedOn: "2026-08-22",
        note: "Registered as compliance-program guidance, not a universal investigation deadline.",
      },
    ],
  },
} as const satisfies Record<string, RegulatorySource>;

export type RegulatorySourceId = keyof typeof REGULATORY_SOURCES;

export function getRegulatorySource(id: RegulatorySourceId): RegulatorySource {
  return REGULATORY_SOURCES[id];
}

export function isRegulatorySourceStale(
  source: RegulatorySource,
  asOf = new Date(),
  maxAgeDays = 365,
): boolean {
  const verified = new Date(`${source.lastVerified}T00:00:00Z`);
  if (Number.isNaN(verified.getTime())) return true;
  const ageMs = asOf.getTime() - verified.getTime();
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
}
