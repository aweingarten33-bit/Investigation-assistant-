export interface OrganizationDisciplineConfig {
  standardOfProof: string;
  policyRules: string;
  actionMatrix: string;
  precedent: string;
  cbaLabor: string;
  priorHistoryRules: string;
  trainingRoleExpectations: string;
  requiredApprovals: string;
  additionalContext: string;
}

export const EMPTY_ORGANIZATION_DISCIPLINE_CONFIG: OrganizationDisciplineConfig = {
  standardOfProof: "",
  policyRules: "",
  actionMatrix: "",
  precedent: "",
  cbaLabor: "",
  priorHistoryRules: "",
  trainingRoleExpectations: "",
  requiredApprovals: "",
  additionalContext: "",
};

const SECTIONS: Array<[keyof OrganizationDisciplineConfig, string]> = [
  ["standardOfProof", "STANDARD OF PROOF / FINDING RULE"],
  ["policyRules", "APPLICABLE POLICY / CODE OF CONDUCT RULES"],
  ["actionMatrix", "ORGANIZATION DISCIPLINARY / CORRECTIVE-ACTION MATRIX"],
  ["precedent", "ANONYMIZED COMPARABLE PRECEDENT"],
  ["cbaLabor", "CBA / UNION / DUE-PROCESS REQUIREMENTS"],
  ["priorHistoryRules", "PRIOR-DISCIPLINE / PROGRESSIVE-DISCIPLINE RULES"],
  ["trainingRoleExpectations", "TRAINING / ROLE / ACCESS EXPECTATIONS"],
  ["requiredApprovals", "REQUIRED HR / LEGAL / LEADERSHIP APPROVALS"],
  ["additionalContext", "OTHER ORGANIZATION-SPECIFIC DECISION CRITERIA"],
];

export function buildOrganizationContext(config: OrganizationDisciplineConfig): string {
  return SECTIONS
    .map(([key, label]) => {
      const value = config[key].trim();
      return value ? `${label}:\n${value}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function organizationConfigHasContent(config: OrganizationDisciplineConfig): boolean {
  return Object.values(config).some((value) => value.trim().length > 0);
}
