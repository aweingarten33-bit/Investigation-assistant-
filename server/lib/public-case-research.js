import { RESEARCH_CATEGORIES, topicForCategory } from "./research-taxonomy.js";

export const PUBLIC_RESEARCH_SETTINGS = [
  "hospital_health_system",
  "ltc_snf",
  "physician_practice",
  "pharmacy",
  "home_health_hospice",
  "behavioral_health",
  "substance_use_treatment",
  "payer_health_plan",
  "laboratory",
  "other_healthcare",
  "unknown",
];

export const PUBLIC_RESEARCH_PATTERNS = [
  "unauthorized_record_access",
  "impermissible_disclosure",
  "security_incident",
  "billing_documentation_falsification",
  "unsupported_or_upcoded_billing",
  "overpayment_retention",
  "kickback_or_remuneration",
  "self_referral",
  "controlled_substance_discrepancy",
  "controlled_substance_diversion",
  "resident_or_patient_abuse",
  "resident_or_patient_neglect",
  "retaliation",
  "conflict_of_interest",
  "documentation_integrity",
  "exclusion_screening",
  "patient_safety",
  "other_compliance",
  "unclear",
];

export const PUBLIC_RESEARCH_INTENT = [
  "accidental",
  "negligent",
  "reckless",
  "intentional",
  "disputed",
  "unknown",
];

export const PUBLIC_RESEARCH_SCOPE = [
  "single_event",
  "repeated_pattern",
  "multiple_people_or_records",
  "systemic_process_issue",
  "unknown",
];

export const PUBLIC_RESEARCH_FACTORS = [
  "sensitive_or_behavioral_health_records",
  "personal_relationship_or_curiosity",
  "personal_or_financial_gain",
  "concealment_or_falsification",
  "patient_or_resident_harm",
  "potential_patient_or_resident_harm",
  "government_program_billing",
  "prior_training_or_clear_policy",
  "leadership_or_supervisory_role",
  "retaliation_or_whistleblower_activity",
  "large_scale_or_many_records",
  "reporting_or_breach_implications",
  "objective_system_or_audit_evidence",
  "conflicting_witness_accounts",
  "individual_responsibility_unclear",
  "none_identified",
];

const SETTING_LABELS = {
  hospital_health_system: "hospital or health system",
  ltc_snf: "long-term care or skilled nursing facility",
  physician_practice: "physician or outpatient practice",
  pharmacy: "pharmacy",
  home_health_hospice: "home health or hospice",
  behavioral_health: "behavioral health setting",
  substance_use_treatment: "substance-use treatment setting",
  payer_health_plan: "payer or health plan",
  laboratory: "laboratory",
  other_healthcare: "healthcare organization",
  unknown: "healthcare setting not specified",
};

const PATTERN_LABELS = {
  unauthorized_record_access: "unauthorized workforce access to patient records",
  impermissible_disclosure: "impermissible disclosure of patient information",
  security_incident: "healthcare information-security incident",
  billing_documentation_falsification: "billing or clinical-documentation falsification",
  unsupported_or_upcoded_billing: "unsupported or upcoded healthcare billing",
  overpayment_retention: "identified healthcare overpayment retained or not timely returned",
  kickback_or_remuneration: "potential healthcare kickback or improper remuneration",
  self_referral: "potential physician self-referral issue",
  controlled_substance_discrepancy: "controlled-substance discrepancy with responsibility not yet established",
  controlled_substance_diversion: "controlled-substance diversion",
  resident_or_patient_abuse: "resident or patient abuse allegation",
  resident_or_patient_neglect: "resident or patient neglect allegation",
  retaliation: "compliance or whistleblower retaliation allegation",
  conflict_of_interest: "healthcare conflict of interest",
  documentation_integrity: "healthcare documentation-integrity issue",
  exclusion_screening: "excluded individual or entity screening issue",
  patient_safety: "patient or resident safety investigation",
  other_compliance: "healthcare compliance investigation",
  unclear: "healthcare compliance issue with unclear fact pattern",
};

const INTENT_LABELS = {
  accidental: "apparently accidental conduct",
  negligent: "apparently negligent conduct",
  reckless: "apparently reckless conduct",
  intentional: "apparently intentional conduct",
  disputed: "intent is disputed",
  unknown: "intent is unknown",
};

const SCOPE_LABELS = {
  single_event: "single event",
  repeated_pattern: "repeated pattern",
  multiple_people_or_records: "multiple people, records, claims, or events",
  systemic_process_issue: "possible systemic process/control issue",
  unknown: "scope is unknown",
};

const FACTOR_LABELS = {
  sensitive_or_behavioral_health_records: "sensitive or behavioral-health information",
  personal_relationship_or_curiosity: "personal relationship or curiosity motive",
  personal_or_financial_gain: "personal or financial gain",
  concealment_or_falsification: "concealment or falsification",
  patient_or_resident_harm: "actual patient/resident harm",
  potential_patient_or_resident_harm: "potential patient/resident harm",
  government_program_billing: "government-program billing",
  prior_training_or_clear_policy: "prior training or clear policy expectations",
  leadership_or_supervisory_role: "leadership/supervisory role",
  retaliation_or_whistleblower_activity: "retaliation or whistleblower activity",
  large_scale_or_many_records: "large scale or many records/events",
  reporting_or_breach_implications: "possible reporting or breach implications",
  objective_system_or_audit_evidence: "objective system/audit evidence",
  conflicting_witness_accounts: "conflicting witness accounts",
  individual_responsibility_unclear: "individual responsibility is unclear",
  none_identified: "no additional distinguishing factor identified",
};

export function isAllowedPublicResearchProfile(profile) {
  return Boolean(
    profile
    && RESEARCH_CATEGORIES.includes(profile.issueCategory)
    && PUBLIC_RESEARCH_SETTINGS.includes(profile.setting)
    && PUBLIC_RESEARCH_PATTERNS.includes(profile.pattern)
    && PUBLIC_RESEARCH_INTENT.includes(profile.intent)
    && PUBLIC_RESEARCH_SCOPE.includes(profile.scope)
    && Array.isArray(profile.factors)
    && profile.factors.every((factor) => PUBLIC_RESEARCH_FACTORS.includes(factor))
  );
}

export function describePublicResearchProfile(profile) {
  if (!isAllowedPublicResearchProfile(profile)) return "";
  const issue = topicForCategory(profile.issueCategory) || "general healthcare compliance investigation";
  const factors = profile.factors
    .filter((factor) => factor !== "none_identified")
    .map((factor) => FACTOR_LABELS[factor]);

  return [
    issue,
    SETTING_LABELS[profile.setting],
    PATTERN_LABELS[profile.pattern],
    INTENT_LABELS[profile.intent],
    SCOPE_LABELS[profile.scope],
    factors.length ? `distinguishing factors: ${factors.join(", ")}` : null,
  ].filter(Boolean).join("; ");
}

export function buildPublicResearchQuery(profile) {
  const description = describePublicResearchProfile(profile);
  if (!description) return "";
  return `Find analogous public healthcare compliance enforcement, investigation, settlement, corrective-action, and organizational response examples for this de-identified profile: ${description}. Prioritize official government/regulator sources and primary public healthcare-organization materials.`;
}
