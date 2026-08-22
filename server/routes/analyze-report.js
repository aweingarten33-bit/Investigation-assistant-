import express from "express";
import { randomBytes, timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";
import { z, ZodError } from "zod";
import { callStructured, callTextWithSearch } from "../lib/ai.js";
import { createRateLimiter, clientIp } from "../lib/rate-limit.js";
import {
  buildInputHash,
  hydrateEvidenceTraceability,
  normalizeOrganizationContext,
  numberReportLines,
} from "../lib/investigation-utils.js";
import { RESEARCH_CATEGORIES, topicForCategory } from "../lib/research-taxonomy.js";

const MAX_REPORT_TEXT_LENGTH = 100_000;
const MAX_ORG_CONTEXT_LENGTH = 20_000;
const MAX_BODY_BYTES = (MAX_REPORT_TEXT_LENGTH + MAX_ORG_CONTEXT_LENGTH) * 4 + 32_768;
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
    confidenceScore: { type: "integer" },
    violationType: { type: "string" },
    violationCount: { type: "string" },
    recommendationTier: { type: "string", enum: VALID_TIERS },
    aggravatingFactors: { type: "array", items: { type: "string" } },
    mitigatingFactors: { type: "array", items: { type: "string" } },
    notesCompleteness: { type: "string", enum: ["complete", "partial", "insufficient"] },
    missingElements: { type: "array", items: { type: "string" } },
    evidenceItems: { type: "array", items: evidenceItemSchema },
    findings: { type: "array", items: findingSchema },
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
    "decision", "riskLevel", "confidenceScore", "violationType", "violationCount", "recommendationTier",
    "aggravatingFactors", "mitigatingFactors", "notesCompleteness", "missingElements", "evidenceItems",
    "findings", "disciplineFactors", "disciplineRange", "policyQuestions",
  ],
};

const reportSchema = {
  type: "object",
  properties: {
    introduction: { type: "string" },
    incidentOverview: { type: "string" },
    incidentDetails: { type: "string" },
    investigationFindings: { type: "array", items: { type: "string" } },
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
const FindingZ = z.object({
  id: z.string().min(1).max(80),
  statement: z.string().min(1).max(2000),
  inference: z.string().max(2000),
  evidenceStatus: z.enum(EVIDENCE_STATUSES),
  supportingEvidenceIds: z.array(z.string().max(80)).max(50),
  contradictingEvidenceIds: z.array(z.string().max(80)).max(50),
});
const DisciplineFactorZ = z.object({
  factor: z.enum(DISCIPLINE_FACTORS),
  assessment: z.string().min(1).max(1200),
  impact: z.enum(DISCIPLINE_IMPACTS),
  evidenceIds: z.array(z.string().max(80)).max(50),
});
const ClassificationZ = z.object({
  decision: z.enum(VALID_DECISIONS),
  riskLevel: z.enum(VALID_RISK),
  confidenceScore: z.coerce.number().int().min(0).max(100),
  violationType: z.string().max(500),
  violationCount: z.string().max(200),
  recommendationTier: z.enum(VALID_TIERS),
  aggravatingFactors: z.array(z.string().max(1000)).max(30),
  mitigatingFactors: z.array(z.string().max(1000)).max(30),
  notesCompleteness: z.enum(["complete", "partial", "insufficient"]),
  missingElements: z.array(z.string().max(1000)).max(30),
  evidenceItems: z.array(EvidenceZ).max(100),
  findings: z.array(FindingZ).max(50),
  disciplineFactors: z.array(DisciplineFactorZ).max(30),
  disciplineRange: z.object({
    minimum: z.string().min(1).max(300),
    maximum: z.string().min(1).max(300),
    recommended: z.string().min(1).max(500),
    rationale: z.string().min(1).max(3000),
    policyDependent: z.boolean(),
    requiresHrLegalReview: z.boolean(),
  }),
  policyQuestions: z.array(z.string().max(1000)).max(30),
});
const ReportZ = z.object({
  introduction: z.string(),
  incidentOverview: z.string(),
  incidentDetails: z.string(),
  investigationFindings: z.array(z.string()),
  regulationsCited: z.array(z.string()),
  recommendations: z.string(),
  conclusion: z.string(),
  missingInfo: z.array(z.string()),
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

const CLASSIFICATION_PROMPT = `You are a healthcare compliance investigation decision-support analyst. You do NOT make employment decisions. Your job is to organize evidence, assess whether the evidence supports a finding, identify uncertainty, and propose a reviewable range of possible corrective actions.

ABSOLUTE EVIDENCE RULES:
- The case notes arrive with immutable line labels like [L0001]. Every case-specific factual claim must trace to those lines.
- Create evidenceItems only for actual information in those notes. Cite lineStart/lineEnd; never invent a source, interview, audit, policy, date, witness, or record.
- A finding must reference evidence item IDs. Record contradictory evidence instead of hiding it.
- If the evidence is sparse, conflicting, or lacks who/what/evidence needed to support the allegation, use NEEDS_MORE_INFO.
- UNSUBSTANTIATED means the available evidence does not support the allegation or affirmatively supports a contrary conclusion. Do not treat lack of proof as proof the reporter lied.
- Regulatory research and organization-specific rules are CONTEXT, never case facts.

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
Every case-specific statement must be traceable to the investigation notes and consistent with the signed classification/evidence map below. Never fabricate interviews, audit results, names, dates, policy language, intent, prior history, or facts.

SIGNED DECISION-SUPPORT CLASSIFICATION:
${JSON.stringify({
  decision: classification.decision,
  riskLevel: classification.riskLevel,
  confidenceScore: classification.confidenceScore,
  violationType: classification.violationType,
  findings: classification.findings,
  disciplineRange: classification.disciplineRange,
  policyQuestions: classification.policyQuestions,
}, null, 2)}

DISCIPLINE LANGUAGE:
- Present discipline as decision support and a range subject to organization policy, precedent, CBA/union obligations, HR, Legal, and supervisory review.
- Do not state that a particular action is automatic merely because of risk level or incident count.
- If disciplineRange.policyDependent is true, explicitly state what organization-specific review is still needed.

CITATIONS:
- Include a regulation only when it is clearly applicable to the facts supplied. Do not dump a stock list of HIPAA sections.
- If applicability is uncertain, omit the citation and flag the issue for legal/compliance verification instead.

SECTIONS:
I. INTRODUCTION — reporting/assignment facts only if notes provide them.
II. INCIDENT OVERVIEW — concise neutral summary.
III. INCIDENT DETAILS — only investigation steps and evidence actually documented.
IV. INVESTIGATION FINDINGS — findings consistent with the signed evidence map; acknowledge material contradictory evidence.
V. RECOMMENDATIONS — corrective-action range, process controls, and any HR/Legal/policy review still required.
VI. CONCLUSION — summarize determination, evidence strength, risk, and remaining uncertainty.`;
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
      return res.status(413).json({ error: "Organization context is too long. Maximum is 20,000 characters." });
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
        `Analyze the line-numbered investigation notes below. Build an evidence map first, then findings, then the decision-support and corrective-action range.\n\n--- CASE NOTES ---\n${numberReportLines(reportText)}\n--- END CASE NOTES ---${contextBlock}${organizationBlock}`,
        classificationSchema,
        "investigation_evidence_classification",
      );

      const parsed = ClassificationZ.parse(rawClassification);
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
      return res.json({
        ...classification,
        ...report,
        missingInfo: report.missingInfo.length > 0 ? report.missingInfo : null,
      });
    }

    return res.status(400).json({ error: "Invalid request: specify step='classify' or step='report' with signed classification data" });
  } catch (error) {
    console.error("analyze-report error:", error);
    if (error instanceof ZodError) {
      return res.status(502).json({ error: "AI returned an invalid structured response. Please try again." });
    }
    res.status(error.status || 500).json({ error: error.message || "Analysis failed" });
  }
});

router.use((req, res) => res.status(405).json({ error: "Method not allowed" }));
export default router;
