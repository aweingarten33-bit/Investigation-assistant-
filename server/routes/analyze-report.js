import express from "express";
import { randomBytes, timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";
import { z, ZodError } from "zod";
import { callStructured, callTextWithSearch } from "../lib/ai.js";
import { createRateLimiter, clientIp } from "../lib/rate-limit.js";
import {
  buildInputHash,
  hydrateEvidenceTraceability,
  groundReportFindings,
  MAX_ORG_CONTEXT_LENGTH,
  normalizeOrganizationContext,
  numberReportLines,
} from "../lib/investigation-utils.js";
import { RESEARCH_CATEGORIES, topicForCategory } from "../lib/research-taxonomy.js";

const MAX_REPORT_TEXT_LENGTH = 100_000;
// The step="report" request echoes the full classification (evidenceItems,
// findings, hypotheses, sufficiency checks, discipline factors, etc.) back from
// the client. Budget above the schema-valid worst case so a thorough case does
// not get rejected merely because its evidence map is detailed.
const MAX_CLASSIFICATION_JSON_BYTES = 1_500_000;
const MAX_BODY_BYTES = (MAX_REPORT_TEXT_LENGTH + MAX_ORG_CONTEXT_LENGTH) * 4
  + MAX_CLASSIFICATION_JSON_BYTES + 32_768;
const isRateLimited = createRateLimiter();

const configuredSigningSecret = process.env.CLASSIFICATION_SIGNING_SECRET
  || process.env.ANTHROPIC_API_KEY
  || process.env.OPENAI_API_KEY
  || process.env.GEMINI_API_KEY;
const SIGNING_SECRET = configuredSigningSecret || randomBytes(32).toString("hex");
if (!configuredSigningSecret) {
  console.error("WARNING: no persistent classification signing secret configured; using an ephemeral process secret. Set CLASSIFICATION_SIGNING_SECRET in production.");
}

const VALID_DECISIONS = ["substantiated", "unsubstantiated", "needs_more_info"];
const VALID_RISK = ["low", "moderate", "high", "critical"];
const VALID_TIERS = ["re-education", "written_warning", "consider_termination", "recommend_termination", "policy_review"];
const EVIDENCE_TYPES = ["document", "interview", "audit", "system_record", "policy", "other"];
const EVIDENCE_STANCES = ["supports", "contradicts", "context"];
const EVIDENCE_STATUSES = ["corroborated", "supported", "single_source", "contradicted", "insufficient"];
const DISCIPLINE_IMPACTS = ["mitigating", "neutral", "aggravating", "unknown"];
const HYPOTHESIS_STATES = ["supported", "partially_supported", "weakened", "unresolved", "contradicted"];
const SUFFICIENCY_CHECK_STATUSES = ["satisfied", "unresolved", "not_applicable"];
const SUFFICIENCY_CHECK_IDS = [
  "finding_support",
  "contradictory_evidence",
  "objective_records",
  "key_witnesses",
  "material_inconsistencies",
  "policy_regulatory_context",
  "standard_of_proof",
  "reporting_escalation",
];
const DISCIPLINE_FACTORS = [
  "intent", "role_expectations", "sensitivity", "actual_harm", "potential_harm", "concealment",
  "cooperation", "prior_discipline", "prior_training", "policy_language", "precedent", "cba_union",
  "leadership_role", "retaliation", "personal_benefit", "fraud", "patient_safety", "regulatory_reporting",
];

const evidenceItemSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    sourceLabel: { type: "string" },
    lineStart: { type: "integer" },
    lineEnd: { type: "integer" },
    evidenceType: { type: "string", enum: EVIDENCE_TYPES },
    stance: { type: "string", enum: EVIDENCE_STANCES },
    summary: { type: "string" },
  },
  required: ["id", "sourceLabel", "lineStart", "lineEnd", "evidenceType", "stance", "summary"],
};

const findingSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    statement: { type: "string" },
    inference: { type: "string" },
    evidenceStatus: { type: "string", enum: EVIDENCE_STATUSES },
    supportingEvidenceIds: { type: "array", items: { type: "string" } },
    contradictingEvidenceIds: { type: "array", items: { type: "string" } },
  },
  required: ["id", "statement", "inference", "evidenceStatus", "supportingEvidenceIds", "contradictingEvidenceIds"],
};

const hypothesisSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    description: { type: "string" },
    state: { type: "string", enum: HYPOTHESIS_STATES },
    supportingEvidenceIds: { type: "array", items: { type: "string" } },
    contradictingEvidenceIds: { type: "array", items: { type: "string" } },
    unresolvedQuestions: { type: "array", items: { type: "string" } },
  },
  required: ["id", "label", "description", "state", "supportingEvidenceIds", "contradictingEvidenceIds", "unresolvedQuestions"],
};

const sufficiencyCheckSchema = {
  type: "object",
  properties: {
    id: { type: "string", enum: SUFFICIENCY_CHECK_IDS },
    status: { type: "string", enum: SUFFICIENCY_CHECK_STATUSES },
    material: { type: "boolean" },
    resolvable: { type: "boolean" },
    rationale: { type: "string" },
    nextAction: { type: "string" },
    evidenceIds: { type: "array", items: { type: "string" } },
  },
  required: ["id", "status", "material", "resolvable", "rationale", "nextAction", "evidenceIds"],
};

const conclusionChangeFactorSchema = {
  type: "object",
  properties: {
    description: { type: "string" },
    evidenceNeeded: { type: "string" },
    impact: { type: "string" },
  },
  required: ["description", "evidenceNeeded", "impact"],
};

const disciplineFactorSchema = {
  type: "object",
  properties: {
    factor: { type: "string", enum: DISCIPLINE_FACTORS },
    assessment: { type: "string" },
    impact: { type: "string", enum: DISCIPLINE_IMPACTS },
    evidenceIds: { type: "array", items: { type: "string" } },
  },
  required: ["factor", "assessment", "impact", "evidenceIds"],
};

const classificationSchema = {
  type: "object",
  properties: {
    decision: { type: "string", enum: VALID_DECISIONS },
    riskLevel: { type: "string", enum: VALID_RISK },
    violationType: { type: "string" },
    violationCount: { type: "string" },
    recommendationTier: { type: "string", enum: VALID_TIERS },
    aggravatingFactors: { type: "array", items: { type: "string" } },
    mitigatingFactors: { type: "array", items: { type: "string" } },
    notesCompleteness: { type: "string", enum: ["complete", "partial", "insufficient"] },
    missingElements: { type: "array", items: { type: "string" } },
    evidenceItems: { type: "array", items: evidenceItemSchema },
    findings: { type: "array", items: findingSchema },
    hypotheses: { type: "array", items: hypothesisSchema },
    sufficiencyChecks: { type: "array", items: sufficiencyCheckSchema },
    closureRationale: { type: "string" },
    whatWouldChangeConclusion: { type: "array", items: conclusionChangeFactorSchema },
    disciplineFactors: { type: "array", items: disciplineFactorSchema },
    disciplineRange: {
      type: "object",
      properties: {
        minimum: { type: "string" },
        maximum: { type: "string" },
        recommended: { type: "string" },
        rationale: { type: "string" },
        policyDependent: { type: "boolean" },
        requiresHrLegalReview: { type: "boolean" },
      },
      required: ["minimum", "maximum", "recommended", "rationale", "policyDependent", "requiresHrLegalReview"],
    },
    policyQuestions: { type: "array", items: { type: "string" } },
  },
  required: [
    "decision", "riskLevel", "violationType", "violationCount", "recommendationTier",
    "aggravatingFactors", "mitigatingFactors", "notesCompleteness", "missingElements", "evidenceItems",
    "findings", "hypotheses", "sufficiencyChecks", "closureRationale", "whatWouldChangeConclusion",
    "disciplineFactors", "disciplineRange", "policyQuestions",
  ],
};

const reportSchema = {
  type: "object",
  properties: {
    introduction: { type: "string" },
    incidentOverview: { type: "string" },
    incidentDetails: { type: "string" },
    investigationFindings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          statement: { type: "string" },
          supportingFindingIds: { type: "array", items: { type: "string" } },
        },
        required: ["statement", "supportingFindingIds"],
      },
    },
    regulationsCited: { type: "array", items: { type: "string" } },
    recommendations: { type: "string" },
    conclusion: { type: "string" },
    missingInfo: { type: "array", items: { type: "string" } },
  },
  required: ["introduction", "incidentOverview", "incidentDetails", "investigationFindings", "regulationsCited", "recommendations", "conclusion", "missingInfo"],
};

const researchTaxonomySchema = {
  type: "object",
  properties: { category: { type: "string", enum: RESEARCH_CATEGORIES } },
  required: ["category"],
};

const EvidenceZ = z.object({
  id: z.string().min(1).max(80),
  sourceLabel: z.string().min(1).max(120),
  lineStart: z.number().int().positive(),
  lineEnd: z.number().int().positive(),
  evidenceType: z.enum(EVIDENCE_TYPES),
  stance: z.enum(EVIDENCE_STANCES),
  summary: z.string().min(1).max(1000),
});
// ID-reference lists below all use .catch([]): a model omitting or
// null-ing one of these is common and always safe to treat as "none cited"
// rather than failing the entire classify/report call over it. Object
// identity/content fields (id, statement, summary, etc.) stay strict —
// those are core content, not auxiliary references, and a malformed one
// should surface as an error rather than vanish silently.
const FindingZ = z.object({
  id: z.string().min(1).max(80),
  statement: z.string().min(1).max(2000),
  inference: z.string().max(2000),
  evidenceStatus: z.enum(EVIDENCE_STATUSES),
  supportingEvidenceIds: z.array(z.string().max(80)).max(50).catch([]),
  contradictingEvidenceIds: z.array(z.string().max(80)).max(50).catch([]),
});
const HypothesisZ = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  state: z.enum(HYPOTHESIS_STATES),
  supportingEvidenceIds: z.array(z.string().max(80)).max(50).catch([]),
  contradictingEvidenceIds: z.array(z.string().max(80)).max(50).catch([]),
  unresolvedQuestions: z.array(z.string().max(1000)).max(20).catch([]),
});
const SufficiencyCheckZ = z.object({
  id: z.enum(SUFFICIENCY_CHECK_IDS),
  status: z.enum(SUFFICIENCY_CHECK_STATUSES),
  material: z.boolean(),
  resolvable: z.boolean(),
  rationale: z.string().min(1).max(2000),
  nextAction: z.string().max(1500),
  // Tolerate null/missing/malformed rather than requiring perfect model
  // compliance on a brand-new field — an empty list is always a safe
  // fallback here (it just skips the staleness check in hydration for that
  // one item; it can never crash the whole classify/report call).
  evidenceIds: z.array(z.string().max(80)).max(50).catch([]),
});
const ConclusionChangeFactorZ = z.object({
  description: z.string().min(1).max(1500),
  evidenceNeeded: z.string().min(1).max(1500),
  impact: z.string().min(1).max(1500),
});
const DisciplineFactorZ = z.object({
  factor: z.enum(DISCIPLINE_FACTORS),
  assessment: z.string().min(1).max(1200),
  impact: z.enum(DISCIPLINE_IMPACTS),
  evidenceIds: z.array(z.string().max(80)).max(50).catch([]),
});
const ClassificationZ = z.object({
  decision: z.enum(VALID_DECISIONS),
  riskLevel: z.enum(VALID_RISK),
  violationType: z.string().max(500),
  violationCount: z.string().max(200),
  recommendationTier: z.enum(VALID_TIERS),
  aggravatingFactors: z.array(z.string().max(1000)).max(30).catch([]),
  mitigatingFactors: z.array(z.string().max(1000)).max(30).catch([]),
  notesCompleteness: z.enum(["complete", "partial", "insufficient"]),
  missingElements: z.array(z.string().max(1000)).max(30).catch([]),
  evidenceItems: z.array(EvidenceZ).max(100),
  findings: z.array(FindingZ).max(50),
  hypotheses: z.array(HypothesisZ).min(1).max(6),
  // NOT validated strictly here on purpose: requiring the model to return
  // exactly 8 checks with exactly the right 8 IDs, every single time, is a
  // hard compliance bar to hit perfectly on every call, and this was the
  // last brittle field left after the previous two rounds of hardening.
  // Accept anything array-shaped here; normalizeSufficiencyChecks (below)
  // deterministically guarantees exactly the 8 canonical checks downstream
  // regardless of what the model actually returned — including synthesizing
  // a conservative, closure-blocking placeholder for any check the model
  // dropped, so this is strictly safer than the old hard-fail, not looser.
  sufficiencyChecks: z.array(z.unknown()).catch([]),
  closureRationale: z.string().min(1).max(3000),
  whatWouldChangeConclusion: z.array(ConclusionChangeFactorZ).max(12).catch([]),
  disciplineFactors: z.array(DisciplineFactorZ).max(30),
  disciplineRange: z.object({
    minimum: z.string().min(1).max(300),
    maximum: z.string().min(1).max(300),
    recommended: z.string().min(1).max(500),
    rationale: z.string().min(1).max(3000),
    policyDependent: z.boolean(),
    requiresHrLegalReview: z.boolean(),
  }),
  policyQuestions: z.array(z.string().max(1000)).max(30).catch([]),
});

// Guarantees exactly the 8 canonical sufficiency checks, well-formed, no
// matter what the model actually returned. Any check the model omitted, or
// duplicated, or tagged with an unrecognized id, gets replaced with a
// conservative placeholder — status "unresolved", material and resolvable
// both true — so a gap in the model's output blocks closure by default
// instead of either crashing the request or silently defaulting to
// ready_to_close (deriveClosureAssessment can't tell "the model skipped
// this" from "there's genuinely nothing left to resolve").
function normalizeSufficiencyChecks(rawChecks) {
  const byId = new Map();
  for (const raw of Array.isArray(rawChecks) ? rawChecks : []) {
    if (!raw || typeof raw !== "object") continue;
    if (!SUFFICIENCY_CHECK_IDS.includes(raw.id) || byId.has(raw.id)) continue;
    byId.set(raw.id, {
      id: raw.id,
      status: SUFFICIENCY_CHECK_STATUSES.includes(raw.status) ? raw.status : "unresolved",
      material: typeof raw.material === "boolean" ? raw.material : true,
      resolvable: typeof raw.resolvable === "boolean" ? raw.resolvable : true,
      rationale: typeof raw.rationale === "string" && raw.rationale.trim()
        ? raw.rationale.slice(0, 2000)
        : "The AI did not return a usable rationale for this check.",
      nextAction: typeof raw.nextAction === "string" ? raw.nextAction.slice(0, 1500) : "",
      evidenceIds: Array.isArray(raw.evidenceIds) ? raw.evidenceIds.filter((id) => typeof id === "string").slice(0, 50) : [],
    });
  }
  return SUFFICIENCY_CHECK_IDS.map((id) => byId.get(id) || {
    id,
    status: "unresolved",
    material: true,
    resolvable: true,
    rationale: "The AI did not return an assessment for this check; treating it as unresolved pending review.",
    nextAction: "Review this item manually before closing the case.",
    evidenceIds: [],
  });
}

// investigationFindings moved from plain strings to { statement,
// supportingFindingIds } objects — a real shape change, not just a new
// field, so it gets the most defensive treatment in this file:
// - a plain string (the old shape, in case the model reverts to habit) is
//   coerced into the new shape with no grounding, rather than rejected;
// - a missing/invalid statement never blocks the item — groundReportFindings
//   already drops anything with no valid supportingFindingIds, so an
//   ungrounded item disappearing from the final report is correct behavior,
//   not a bug;
// - the whole array falls back to [] rather than failing the entire report
//   over one malformed entry.
const InvestigationFindingZ = z.preprocess(
  (item) => {
    if (typeof item === "string") return { statement: item, supportingFindingIds: [] };
    if (item && typeof item === "object") return item;
    return { statement: "", supportingFindingIds: [] };
  },
  z.object({
    statement: z.string().max(2000).catch(""),
    supportingFindingIds: z.array(z.string().max(80)).max(20).catch([]),
  }),
);
const ReportZ = z.object({
  introduction: z.string(),
  incidentOverview: z.string(),
  incidentDetails: z.string(),
  investigationFindings: z.array(InvestigationFindingZ).catch([]),
  regulationsCited: z.array(z.string()).catch([]),
  recommendations: z.string(),
  conclusion: z.string(),
  missingInfo: z.array(z.string()).catch([]),
});
const ResearchTaxonomyZ = z.object({ category: z.enum(RESEARCH_CATEGORIES) });

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function signClassification(classification, inputHash) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signedPayload = canonicalize({ classification, inputHash });
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  return Buffer.from(sig).toString("base64");
}

function signaturesMatch(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && cryptoTimingSafeEqual(left, right);
}

const CLASSIFICATION_PROMPT = `You are a healthcare compliance investigation decision-support analyst. You do NOT make employment decisions. Your job is to organize evidence, test competing explanations, assess whether the evidence supports a finding, identify uncertainty, determine whether the investigation is sufficient to close, and propose a reviewable range of possible corrective actions.

ABSOLUTE EVIDENCE RULES:
- The case notes arrive with immutable line labels like [L0001]. Every case-specific factual claim must trace to those lines.
- Create evidenceItems only for actual information in those notes. Cite lineStart/lineEnd; never invent a source, interview, audit, policy, date, witness, or record.
- A finding must reference evidence item IDs. Record contradictory evidence instead of hiding it.
- If the evidence is sparse, conflicting, or lacks who/what/evidence needed to support the allegation, use NEEDS_MORE_INFO.
- UNSUBSTANTIATED means the available evidence does not support the allegation or affirmatively supports a contrary conclusion. Do not treat lack of proof as proof the reporter lied.
- Regulatory research and organization-specific rules are CONTEXT, never case facts.

HYPOTHESIS-DRIVEN INVESTIGATION RULES:
- Build 1-6 competing hypotheses before deciding. Include the allegation/violation hypothesis and, when the notes actually support or leave room for one, the strongest plausible innocent, authorized, mistaken, or alternative explanation.
- Do not invent an alternative explanation merely to create balance. A single hypothesis is appropriate once alternatives have been genuinely eliminated by the evidence. A hypothesis may be contradicted or weakened when evidence points against it.
- Do NOT assign percentages, probabilities, odds, or pseudo-scientific confidence to hypotheses. Use only: supported, partially_supported, weakened, unresolved, contradicted.
- Every hypothesis must identify supporting and contradicting evidence IDs and the unresolved questions that still matter.
- Explicitly challenge the leading hypothesis: identify what evidence would have to exist for the current conclusion to be wrong or materially different.

INVESTIGATION SUFFICIENCY / CLOSURE GATE:
- Return EXACTLY one check for each of these IDs: finding_support, contradictory_evidence, objective_records, key_witnesses, material_inconsistencies, policy_regulatory_context, standard_of_proof, reporting_escalation.
- status=satisfied means the issue is adequately addressed for the present case; unresolved means an important question remains; not_applicable means the check truly does not apply.
- material=true only when the unresolved issue could reasonably change the finding, the ability to defend it, required escalation/reporting, or whether the case can fairly close. Missing discipline-only context should not by itself block the investigative finding.
- resolvable=true only when a realistic remaining investigative step can still answer the issue (obtain a record, interview an available witness, verify access/assignment, check policy, etc.).
- For unresolved checks, nextAction must say the concrete action to take. If the information is unavailable or cannot realistically be recovered, resolvable must be false and nextAction should say to document the limitation.
- evidenceIds must list the evidence item IDs this check's status is actually based on (e.g. the IDs that make finding_support satisfied, or that key_witnesses unresolved). Leave it empty only when no evidence bears on the check yet.
- Do not decide the closure status yourself. The server derives it deterministically: any material unresolved + resolvable issue = NOT READY TO CLOSE; material unresolved issues that are all unresolvable = READY WITH UNRESOLVED LIMITATIONS; no material unresolved issues = READY TO CLOSE.
- closureRationale should explain the evidence sufficiency and remaining uncertainty without naming a closure-status label.
- whatWouldChangeConclusion must list only evidence or facts that could materially change the current finding. State the evidence needed and how it would affect the conclusion. This is a challenge function, not generic brainstorming.

DISCIPLINE / CORRECTIVE-ACTION RULES:
- NEVER map incident count or risk level mechanically to discipline. One deliberate highly sensitive access can be more serious than multiple low-risk mistakes.
- RiskLevel describes compliance/privacy/patient/regulatory risk. It is not a disciplinary level.
- Evaluate each independently when evidence exists: intent; role/access expectations; data/record sensitivity; actual harm; potential harm; concealment; cooperation; prior discipline; prior training; policy language; organizational precedent; union/CBA constraints; leadership role; retaliation; personal benefit; fraud; patient safety; regulatory reporting implications.
- If policy language, precedent, prior history, HR rules, or CBA constraints are missing and could materially affect discipline, disciplineRange.policyDependent MUST be true and policyQuestions must say what needs review.
- disciplineRange must give a reasonable minimum-to-maximum range, not pretend there is one universal answer. recommended may be "defer pending policy/HR review" when appropriate.
- recommendationTier is only a coarse workflow label for legacy letter routing. It must follow the full factor analysis, NEVER a hard risk/count table. Use policy_review when organization-specific information is necessary before choosing a tier.
- Termination must never be framed as automatic. For serious actions, requiresHrLegalReview must be true.

SEARCH CONTEXT:
- A CURRENT REGULATORY CONTEXT section may appear. It is general background, not a fact about this case. Use it only to identify regulatory considerations and uncertainty; never let it manufacture evidence or dictate employee discipline.

ORGANIZATION CONTEXT:
- An ORGANIZATION-SPECIFIC DISCIPLINE CONTEXT section may appear with policy excerpts, precedent, CBA rules, or an internal disciplinary matrix. Treat it as decision criteria, not case evidence. If absent, do not invent organization rules.`;

const RESEARCH_TAXONOMY_PROMPT = `Classify the healthcare compliance issue into exactly one allowed regulatory research category. Return only the structured category. This is taxonomy selection, not case analysis. Do not include or repeat any name, employer, date, location, patient information, employee information, quotation, or other identifier in the output.`;

const RESEARCH_PROMPT = `You are researching current general background for a healthcare compliance investigator. You will receive only a server-owned generic regulatory topic, never the case notes.

Search for current, authoritative information relevant to that topic, prioritizing primary sources such as HHS/OCR, CMS, OIG, DOJ, EEOC, state agencies, statutes, and regulations. Focus on:
- current regulatory obligations and enforcement themes;
- reporting/breach-analysis considerations;
- current guidance that could materially affect investigation handling.

Do NOT search for employer disciplinary norms as though they were law, and do NOT turn regulator penalties into an employee-discipline formula. Answer in 3-5 short bullets.`;

async function researchContext(reportText) {
  try {
    const rawTaxonomy = await callStructured(
      RESEARCH_TAXONOMY_PROMPT,
      `Select a generic research category for these untrusted case notes. Do not echo any case detail.\n\n---\n${reportText.slice(0, 8000)}\n---`,
      researchTaxonomySchema,
      "regulatory_research_taxonomy",
    );
    const { category } = ResearchTaxonomyZ.parse(rawTaxonomy);
    const topic = topicForCategory(category);
    if (!topic) return null;

    // Privacy boundary: the search-enabled provider call receives ONLY a
    // server-owned topic string selected from a closed enum. No free-text
    // model output and no raw case note can reach this call.
    const { text, sources } = await callTextWithSearch(
      RESEARCH_PROMPT,
      `Generic regulatory topic: ${topic}`,
    );
    return { category, topic, text, sources };
  } catch (error) {
    console.error("Web-search grounding unavailable, continuing without it:", error.message);
    return null;
  }
}

function buildReportPrompt(classification) {
  return `You are a report writer for a hospital Compliance and Privacy Department. Write in formal, neutral, professional third-person voice. You are a scribe, not the investigator and not the employment decision-maker.

ABSOLUTE RULE — ZERO FABRICATION:
Every case-specific statement must be traceable to the signed classification/evidence map below, not merely to the investigation notes in general. Never fabricate interviews, audit results, names, dates, policy language, intent, prior history, or facts.

SIGNED DECISION-SUPPORT CLASSIFICATION:
${JSON.stringify({
  decision: classification.decision,
  riskLevel: classification.riskLevel,
  violationType: classification.violationType,
  findings: classification.findings,
  hypotheses: classification.hypotheses,
  sufficiencyChecks: classification.sufficiencyChecks,
  closureAssessment: classification.closureAssessment,
  disciplineRange: classification.disciplineRange,
  policyQuestions: classification.policyQuestions,
}, null, 2)}

INVESTIGATION SUFFICIENCY LANGUAGE:
- The server-derived closureAssessment is authoritative for whether the investigation is presently sufficient to close.
- If status is not_ready_to_close, write the report as an interim investigation report and do not imply the matter has reached a final investigative conclusion. Identify the material remaining work.
- If status is ready_with_unresolved_limitations, expressly document the unresolved limitation and why further resolution is not reasonably available.
- If status is ready_to_close, the conclusion may state that the evidence is sufficient to document a defensible finding, subject to final human review.
- Preserve the strongest plausible alternative hypothesis and explain how the evidence supports, weakens, contradicts, or leaves it unresolved.

DISCIPLINE LANGUAGE:
- Present discipline as decision support and a range subject to organization policy, precedent, CBA/union obligations, HR, Legal, and supervisory review.
- Do not state that a particular action is automatic merely because of risk level or incident count.
- If disciplineRange.policyDependent is true, explicitly state what organization-specific review is still needed.

CITATIONS:
- Include a regulation only when it is clearly applicable to the facts supplied. Do not dump a stock list of HIPAA sections.
- If applicability is uncertain, omit the citation and flag the issue for legal/compliance verification instead.

INVESTIGATION FINDINGS FORMAT:
- investigationFindings must be an array of { statement, supportingFindingIds } objects, not plain strings.
- supportingFindingIds must list the id(s) from the "findings" array in the signed classification above that the statement is actually based on.
- A statement whose supportingFindingIds does not resolve to a real finding id will be removed before the report reaches the reader — do not submit a statement you cannot ground this way.

SECTIONS:
I. INTRODUCTION — reporting/assignment facts only if notes provide them.
II. INCIDENT OVERVIEW — concise neutral summary.
III. INCIDENT DETAILS — only investigation steps and evidence actually documented.
IV. INVESTIGATION FINDINGS — findings consistent with the signed evidence map; acknowledge material contradictory evidence and relevant competing hypotheses.
V. RECOMMENDATIONS — remaining investigative work when applicable, corrective-action range, process controls, and any HR/Legal/policy review still required.
VI. CONCLUSION — summarize determination, evidence strength, closure sufficiency, risk, and remaining uncertainty.`;
}

const router = express.Router();
router.use(express.json({ limit: MAX_BODY_BYTES }));

router.post("/", async (req, res) => {
  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    res.set("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests. Please slow down." });
  }

  try {
    const payload = req.body;
    const { reportText, step, classification: previousClassification } = payload;
    const organizationContext = normalizeOrganizationContext(payload.organizationContext);

    if (typeof reportText !== "string" || !reportText.trim()) {
      return res.status(400).json({ error: "No report text provided" });
    }
    if (reportText.length > MAX_REPORT_TEXT_LENGTH) {
      return res.status(413).json({ error: "Report text is too long. Maximum is 100,000 characters." });
    }
    if (typeof payload.organizationContext === "string" && payload.organizationContext.length > MAX_ORG_CONTEXT_LENGTH) {
      return res.status(413).json({ error: `Organization context is too long. Maximum is ${MAX_ORG_CONTEXT_LENGTH.toLocaleString()} characters.` });
    }

    const inputHash = buildInputHash(reportText, organizationContext);

    if (step === "classify") {
      const research = await researchContext(reportText);
      const contextBlock = research?.text
        ? `\n\nCURRENT REGULATORY CONTEXT (general background only; not case evidence):\n${research.text}`
        : "";
      const organizationBlock = organizationContext
        ? `\n\nORGANIZATION-SPECIFIC DISCIPLINE CONTEXT (decision criteria only; not case evidence):\n${organizationContext}`
        : "\n\nORGANIZATION-SPECIFIC DISCIPLINE CONTEXT: Not provided. Mark policy-dependent decisions accordingly.";

      const rawClassification = await callStructured(
        CLASSIFICATION_PROMPT,
        `Analyze the line-numbered investigation notes below. Build an evidence map, test competing hypotheses, assess the investigative finding, complete all eight sufficiency checks, identify what could change the conclusion, then evaluate corrective-action factors.\n\n--- CASE NOTES ---\n${numberReportLines(reportText)}\n--- END CASE NOTES ---${contextBlock}${organizationBlock}`,
        classificationSchema,
        "investigation_evidence_classification",
      );

      const parsed = ClassificationZ.parse(rawClassification);
      parsed.sufficiencyChecks = normalizeSufficiencyChecks(parsed.sufficiencyChecks);
      const classification = hydrateEvidenceTraceability(parsed, reportText);
      const signature = await signClassification(classification, inputHash);
      return res.json({
        classification,
        signature,
        inputHash,
        sources: research?.sources || [],
        researchTopic: research?.topic || null,
        researchCategory: research?.category || null,
      });
    }

    if (step === "report" && previousClassification && typeof previousClassification === "object") {
      const parsedClassification = ClassificationZ.parse(previousClassification);
      parsedClassification.sufficiencyChecks = normalizeSufficiencyChecks(parsedClassification.sufficiencyChecks);
      const classification = hydrateEvidenceTraceability(parsedClassification, reportText);

      if (payload.inputHash !== inputHash) {
        return res.status(400).json({ error: "Investigation notes or organization context changed after classification. Re-run classification first." });
      }
      const expectedSignature = await signClassification(classification, inputHash);
      if (!signaturesMatch(payload.signature, expectedSignature)) {
        return res.status(400).json({ error: "Classification failed integrity check." });
      }

      const rawReport = await callStructured(
        buildReportPrompt(classification),
        `Write the Incident Investigation Report from the exact notes below. Do not add facts.\n\n---\n${numberReportLines(reportText)}\n---`,
        reportSchema,
        "compliance_report",
      );
      const report = ReportZ.parse(rawReport);
      const investigationFindings = groundReportFindings(report.investigationFindings, classification);
      return res.json({
        ...classification,
        ...report,
        investigationFindings,
        missingInfo: report.missingInfo.length > 0 ? report.missingInfo : null,
      });
    }

    return res.status(400).json({ error: "Invalid request: specify step='classify' or step='report' with signed classification data" });
  } catch (error) {
    console.error("analyze-report error:", error);
    if (error instanceof ZodError) {
      // The client only ever sees a generic message, but log exactly which
      // field(s) failed and why — without this, "invalid structured
      // response" is undiagnosable from the client side alone.
      console.error("Zod validation failure detail:", JSON.stringify(error.issues, null, 2));
      return res.status(502).json({ error: "AI returned an invalid structured response. Please try again." });
    }
    res.status(error.status || 500).json({ error: error.message || "Analysis failed" });
  }
});

router.use((req, res) => res.status(405).json({ error: "Method not allowed" }));
export default router;