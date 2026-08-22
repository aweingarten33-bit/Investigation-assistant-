export type RegulatorySourceStatus = "current" | "proposed" | "guidance";

export type RegulatorySource = {
  id: string;
  title: string;
  authority: string;
  jurisdiction: string;
  sourceType: "statute" | "regulation" | "agency-guidance" | "proposed-rule" | "compliance-guidance";
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
    version: "2026-08-22.2",
    revisionHistory: [
      {
        version: "2026-08-22.1",
        verifiedOn: "2026-08-22",
        note: "Verified 60-day outer limit and without-unreasonable-delay language against HHS guidance and the codified rule.",
      },
      {
        version: "2026-08-22.2",
        verifiedOn: "2026-08-22",
        note: "Re-verified discovery-based timing, individual notice, and media-notice relationship during full deadline audit.",
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
    version: "2026-08-22.2",
    revisionHistory: [
      {
        version: "2026-08-22.1",
        verifiedOn: "2026-08-22",
        note: "Verified separate reporting timing for breaches affecting 500 or more individuals and fewer than 500 individuals.",
      },
      {
        version: "2026-08-22.2",
        verifiedOn: "2026-08-22",
        note: "Re-verified against HHS breach-reporting page last reviewed February 13, 2026; page now covers HIPAA and Part 2 reporting.",
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
    version: "2026-08-22.2",
    revisionHistory: [
      {
        version: "2026-08-22.1",
        verifiedOn: "2026-08-22",
        note: "Verified business-associate notification requirement and 60-day federal outer limit; contractual BAAs may be shorter.",
      },
      {
        version: "2026-08-22.2",
        verifiedOn: "2026-08-22",
        note: "Re-verified during full deadline audit; contractual notice periods remain separate from the federal outer limit.",
      },
    ],
  },
  part2_breach_notification: {
    id: "part2_breach_notification",
    title: "42 CFR Part 2 — Breach Notification",
    authority: "U.S. Department of Health and Human Services, Office for Civil Rights (HHS OCR)",
    jurisdiction: "United States — Federal / Part 2 programs",
    sourceType: "regulation",
    citation: "42 CFR §2.16(b); HIPAA Breach Notification framework",
    url: "https://www.hhs.gov/hipaa/part-2/index.html",
    status: "current",
    effectiveDate: "2026-02-16",
    publishedDate: "2024-02-16",
    lastVerified: "2026-08-22",
    version: "2026-08-22.1",
    revisionHistory: [
      {
        version: "2026-08-22.1",
        verifiedOn: "2026-08-22",
        note: "Added after the February 16, 2026 Part 2 compliance date; Part 2 programs now follow HIPAA-style breach notification requirements for unsecured Part 2 records.",
      },
    ],
  },
  hipaa_right_of_access: {
    id: "hipaa_right_of_access",
    title: "HIPAA Individual Right of Access",
    authority: "U.S. Department of Health and Human Services (HHS)",
    jurisdiction: "United States — Federal",
    sourceType: "regulation",
    citation: "45 CFR §164.524(b)(2)",
    url: "https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/access/index.html",
    status: "current",
    effectiveDate: "2013-03-26",
    lastVerified: "2026-08-22",
    version: "2026-08-22.1",
    revisionHistory: [
      {
        version: "2026-08-22.1",
        verifiedOn: "2026-08-22",
        note: "Verified 30-calendar-day outer limit and one additional extension of no more than 30 calendar days with timely written notice.",
      },
    ],
  },
  cms_ltc_alleged_violations: {
    id: "cms_ltc_alleged_violations",
    title: "LTC Reporting of Alleged Violations and Investigation Results",
    authority: "Centers for Medicare & Medicaid Services (CMS)",
    jurisdiction: "United States — Federal / Medicare and Medicaid LTC facilities",
    sourceType: "regulation",
    citation: "42 CFR §483.12(c); State Operations Manual Appendix PP, F609",
    url: "https://www.cms.gov/files/document/qso-25-14-nh-revised-2025-03-10.pdf",
    status: "current",
    effectiveDate: "2016-11-28",
    lastVerified: "2026-08-22",
    version: "2026-08-22.2",
    revisionHistory: [
      {
        version: "2026-08-22.1",
        verifiedOn: "2026-08-22",
        note: "Verified that the 2-hour/24-hour framework is scoped to covered LTC alleged-violation reporting under §483.12(c), not a universal hospital deadline.",
      },
      {
        version: "2026-08-22.2",
        verifiedOn: "2026-08-22",
        note: "Added the separate requirement to report investigation results within 5 working days and re-verified current F609 guidance.",
      },
    ],
  },
  cms_ltc_suspected_crime: {
    id: "cms_ltc_suspected_crime",
    title: "LTC Reasonable Suspicion of a Crime Reporting",
    authority: "Centers for Medicare & Medicaid Services (CMS)",
    jurisdiction: "United States — Federal / federally funded LTC facilities",
    sourceType: "regulation",
    citation: "42 CFR §483.12(b)(5); Social Security Act §1150B",
    url: "https://www.cms.gov/files/document/qso-25-14-nh-revised-2025-03-10.pdf",
    status: "current",
    effectiveDate: "2016-11-28",
    lastVerified: "2026-08-22",
    version: "2026-08-22.1",
    revisionHistory: [
      {
        version: "2026-08-22.1",
        verifiedOn: "2026-08-22",
        note: "Added as a separate obligation from facility alleged-violation reporting: covered individuals report reasonable suspicion of a crime to the State Agency and local law enforcement within the statutory timeframe.",
      },
    ],
  },
  ny_phl_2803d: {
    id: "ny_phl_2803d",
    title: "New York Residential Health Care Facility Abuse Reporting",
    authority: "New York State Legislature / New York State Department of Health",
    jurisdiction: "New York — Residential health care facilities",
    sourceType: "statute",
    citation: "N.Y. Public Health Law §2803-d(3)",
    url: "https://www.nysenate.gov/legislation/laws/PBH/2803-D",
    status: "current",
    effectiveDate: null,
    lastVerified: "2026-08-22",
    version: "2026-08-22.1",
    revisionHistory: [
      {
        version: "2026-08-22.1",
        verifiedOn: "2026-08-22",
        note: "Verified current statutory requirement for mandated reporters to report suspected abuse, mistreatment, neglect, or misappropriation immediately by telephone and in writing within 48 hours to NYSDOH.",
      },
    ],
  },
  ny_data_breach_899aa: {
    id: "ny_data_breach_899aa",
    title: "New York Private Information Breach Notification",
    authority: "New York State Legislature / Office of the New York Attorney General",
    jurisdiction: "New York — Residents' private information",
    sourceType: "statute",
    citation: "N.Y. General Business Law §899-aa",
    url: "https://www.nysenate.gov/legislation/laws/GBS/899-AA",
    status: "current",
    effectiveDate: null,
    lastVerified: "2026-08-22",
    version: "2026-08-22.1",
    revisionHistory: [
      {
        version: "2026-08-22.1",
        verifiedOn: "2026-08-22",
        note: "Verified current 30-day outer limit for affected-resident notice, state-agency notification requirements, and the separate 5-business-day NY Attorney General notice after HHS notification for HIPAA/HITECH breaches.",
      },
    ],
  },
  medicare_overpayment_401305: {
    id: "medicare_overpayment_401305",
    title: "Medicare Parts A and B Overpayment Reporting and Return",
    authority: "Centers for Medicare & Medicaid Services (CMS)",
    jurisdiction: "United States — Federal / Medicare Parts A and B providers and suppliers",
    sourceType: "regulation",
    citation: "42 CFR §401.305(a)-(b); CY 2025 PFS Final Rule",
    url: "https://www.federalregister.gov/d/2024-25382",
    status: "current",
    effectiveDate: "2025-01-01",
    publishedDate: "2024-12-09",
    lastVerified: "2026-08-22",
    version: "2026-08-22.1",
    revisionHistory: [
      {
        version: "2026-08-22.1",
        verifiedOn: "2026-08-22",
        note: "Verified current 60-day report-and-return rule and up-to-180-day suspension for a timely, good-faith investigation of related overpayments; the 180 days is not a blanket pre-identification investigation period.",
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
    url: "https://www.hhs.gov/hipaa/for-professionals/security/hipaa-security-rule-nprm/index.html",
    status: "proposed",
    effectiveDate: null,
    publishedDate: "2025-01-06",
    lastVerified: "2026-08-22",
    version: "2026-08-22.2",
    revisionHistory: [
      {
        version: "2026-08-22.1",
        verifiedOn: "2026-08-22",
        note: "Verified that the 72-hour item concerns proposed restoration procedures for certain systems/data; it is not a 72-hour HHS breach-notification deadline.",
      },
      {
        version: "2026-08-22.2",
        verifiedOn: "2026-08-22",
        note: "Re-verified against HHS Security Rule pages updated in 2026; the proposal remains an NPRM and the current Security Rule remains in effect.",
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
    version: "2026-08-22.2",
    revisionHistory: [
      {
        version: "2026-08-22.1",
        verifiedOn: "2026-08-22",
        note: "Registered as compliance-program guidance, not a universal investigation deadline.",
      },
      {
        version: "2026-08-22.2",
        verifiedOn: "2026-08-22",
        note: "Re-verified as current voluntary, nonbinding guidance; no universal internal investigation completion deadline was inferred from it.",
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
