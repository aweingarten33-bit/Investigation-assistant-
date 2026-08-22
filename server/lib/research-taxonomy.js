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

export function topicForCategory(category) {
  return RESEARCH_TOPICS[category] || "";
}
