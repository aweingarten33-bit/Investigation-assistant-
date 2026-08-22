export const RESEARCH_CATEGORIES = [
  "hipaa_unauthorized_access",
  "hipaa_impermissible_disclosure",
  "hipaa_security_incident",
  "hipaa_breach_notification",
  "substance_use_part2",
  "false_claims_billing",
  "overpayment",
  "anti_kickback",
  "stark",
  "controlled_substance_diversion",
  "patient_safety",
  "abuse_neglect",
  "retaliation_whistleblower",
  "conflict_of_interest",
  "documentation_integrity",
  "exclusion_screening",
  "research_compliance",
  "workplace_conduct",
  "other_healthcare_compliance",
  "insufficient",
];

export const RESEARCH_SETTINGS = [
  "hospital",
  "long_term_care",
  "physician_practice",
  "pharmacy",
  "home_health",
  "behavioral_health",
  "payer",
  "other_healthcare",
  "unknown",
];

export const RESEARCH_PATTERNS = [
  "curiosity_access",
  "work_related_access_dispute",
  "impermissible_disclosure",
  "documentation_falsification",
  "upcoding_or_unsupported_billing",
  "controlled_substance_discrepancy",
  "resident_abuse",
  "resident_neglect",
  "patient_safety_event",
  "retaliation_after_reporting",
  "conflict_or_self_dealing",
  "excluded_individual",
  "kickback_or_remuneration",
  "overpayment_retention",
  "general_compliance_issue",
  "unknown",
];

export const RESEARCH_INTENTS = ["accidental", "negligent", "reckless", "intentional", "disputed", "unknown"];
export const RESEARCH_SCALES = ["single_event", "small_pattern", "repeated_pattern", "systemic", "unknown"];

export const RESEARCH_TOPICS = {
  hipaa_unauthorized_access: "HIPAA unauthorized workforce access to patient records",
  hipaa_impermissible_disclosure: "HIPAA impermissible disclosure of protected health information",
  hipaa_security_incident: "HIPAA Security Rule security incident involving electronic protected health information",
  hipaa_breach_notification: "HIPAA Breach Notification Rule assessment and notification obligations",
  substance_use_part2: "42 CFR Part 2 confidentiality of substance use disorder patient records",
  false_claims_billing: "healthcare False Claims Act billing and documentation compliance",
  overpayment: "Medicare Medicaid identified overpayment report and return obligations",
  anti_kickback: "federal Anti-Kickback Statute healthcare remuneration compliance",
  stark: "federal physician self-referral Stark Law compliance",
  controlled_substance_diversion: "healthcare controlled substance diversion investigation and reporting",
  patient_safety: "healthcare patient safety incident investigation and reporting",
  abuse_neglect: "healthcare abuse neglect exploitation allegation reporting and investigation",
  retaliation_whistleblower: "healthcare compliance retaliation and whistleblower protections",
  conflict_of_interest: "healthcare conflict of interest compliance and governance",
  documentation_integrity: "healthcare record documentation integrity falsification and compliance",
  exclusion_screening: "healthcare federal exclusion screening and excluded individual entity compliance",
  research_compliance: "healthcare human subjects research compliance and research misconduct",
  workplace_conduct: "healthcare workplace conduct investigation compliance considerations",
  other_healthcare_compliance: "general healthcare compliance investigation regulatory obligations",
  insufficient: "",
};

const SETTING_PHRASES = {
  hospital: "hospital or health-system setting",
  long_term_care: "long-term care or nursing-facility setting",
  physician_practice: "physician-practice setting",
  pharmacy: "pharmacy setting",
  home_health: "home-health setting",
  behavioral_health: "behavioral-health setting",
  payer: "health-plan or payer setting",
  other_healthcare: "healthcare-organization setting",
  unknown: "healthcare setting",
};

const PATTERN_PHRASES = {
  curiosity_access: "employee curiosity or non-work-related record access",
  work_related_access_dispute: "disputed whether record access had a legitimate work purpose",
  impermissible_disclosure: "impermissible disclosure of patient information",
  documentation_falsification: "possible falsification or post-hoc alteration of healthcare documentation",
  upcoding_or_unsupported_billing: "upcoding or billing unsupported by documentation",
  controlled_substance_discrepancy: "controlled-substance discrepancy or possible diversion",
  resident_abuse: "resident abuse allegation",
  resident_neglect: "resident neglect or delayed-care allegation",
  patient_safety_event: "patient-safety event or care-process failure",
  retaliation_after_reporting: "retaliation allegation after compliance or whistleblower reporting",
  conflict_or_self_dealing: "conflict of interest or self-dealing",
  excluded_individual: "employment or contracting involving an excluded individual",
  kickback_or_remuneration: "possible kickback, remuneration, or referral-inducement issue",
  overpayment_retention: "identified overpayment or delayed repayment issue",
  general_compliance_issue: "healthcare compliance investigation",
  unknown: "healthcare compliance investigation",
};

const INTENT_PHRASES = {
  accidental: "apparently accidental conduct",
  negligent: "apparently negligent conduct",
  reckless: "apparently reckless conduct",
  intentional: "apparently intentional conduct",
  disputed: "intent is disputed",
  unknown: "intent not established",
};

const SCALE_PHRASES = {
  single_event: "single event or single subject",
  small_pattern: "limited multi-event pattern",
  repeated_pattern: "repeated pattern",
  systemic: "potentially systemic issue",
  unknown: "scope not yet established",
};

export function topicForCategory(category) {
  return RESEARCH_TOPICS[category] || "";
}

export function buildResearchProfile(profile) {
  const topic = topicForCategory(profile?.category);
  if (!topic) return "";

  const setting = SETTING_PHRASES[profile?.setting] || SETTING_PHRASES.unknown;
  const pattern = PATTERN_PHRASES[profile?.pattern] || PATTERN_PHRASES.unknown;
  const intent = INTENT_PHRASES[profile?.intent] || INTENT_PHRASES.unknown;
  const scale = SCALE_PHRASES[profile?.scale] || SCALE_PHRASES.unknown;

  return [topic, setting, pattern, intent, scale].join("; ");
}
