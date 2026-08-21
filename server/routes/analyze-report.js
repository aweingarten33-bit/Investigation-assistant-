import express from "express";
import { callStructured } from "../lib/ai.js";
import { createRateLimiter, clientIp } from "../lib/rate-limit.js";

const MAX_REPORT_TEXT_LENGTH = 100_000;
const MAX_BODY_BYTES = MAX_REPORT_TEXT_LENGTH * 4 + 16_384; // generous headroom over the text limit

const isRateLimited = createRateLimiter();

// ─── Classification integrity (HMAC) ─────────────────────────────────────────
// The classification from step 1 round-trips through the client into step 2.
// We sign it server-side so a tampered classification (e.g. a forged
// recommendationTier) is rejected before it can shape the report prompt.
// Falls back to whichever provider key is actually configured — with
// multiple providers possible now, ANTHROPIC_API_KEY alone is no longer a
// safe assumption to be set.
const SIGNING_SECRET = process.env.CLASSIFICATION_SIGNING_SECRET
  || process.env.ANTHROPIC_API_KEY
  || process.env.OPENAI_API_KEY
  || process.env.GEMINI_API_KEY
  || "";

if (!SIGNING_SECRET) {
  console.error(
    "WARNING: no CLASSIFICATION_SIGNING_SECRET and no provider API key found to derive one from — " +
    "the classification integrity check is running with an empty key. Set CLASSIFICATION_SIGNING_SECRET.",
  );
}

const VALID_DECISIONS = ["substantiated", "unsubstantiated", "needs_more_info"];
const VALID_RISK = ["low", "moderate", "high", "critical"];
const VALID_TIERS = ["re-education", "written_warning", "consider_termination", "recommend_termination"];

// Canonical, key-sorted JSON so client and server hash identical bytes.
function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function signClassification(classification) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonicalize(classification)));
  return Buffer.from(sig).toString("base64");
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Type/enum validation as defense-in-depth against prompt injection and crashes.
function isValidClassificationShape(c) {
  return (
    c && typeof c === "object" &&
    typeof c.decision === "string" && VALID_DECISIONS.includes(c.decision) &&
    typeof c.riskLevel === "string" && VALID_RISK.includes(c.riskLevel) &&
    typeof c.recommendationTier === "string" && VALID_TIERS.includes(c.recommendationTier) &&
    typeof c.violationType === "string" &&
    typeof c.violationCount === "string" &&
    Array.isArray(c.aggravatingFactors) &&
    Array.isArray(c.mitigatingFactors)
  );
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

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
  },
  required: ["decision", "riskLevel", "confidenceScore", "violationType", "violationCount", "recommendationTier", "aggravatingFactors", "mitigatingFactors", "notesCompleteness", "missingElements"],
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

// ─── Prompts ─────────────────────────────────────────────────────────────────

const CLASSIFICATION_PROMPT = `You are a HIPAA compliance severity classifier. Read the investigation notes and output a classification.

CRITICAL — ANTI-HALLUCINATION RULES:
- You may ONLY reference facts that are EXPLICITLY written in the notes.
- If the notes are vague, incomplete, or only a few sentences, classify as NEEDS_MORE_INFO.
- Do NOT assume any investigation steps were taken unless the notes explicitly say so.

SUBSTANTIATION RULES:
- SUBSTANTIATED: The notes contain specific facts establishing the violation (who, what, when, evidence).
- UNSUBSTANTIATED: The notes explicitly say the allegation was disproven or unfounded.
- NEEDS_MORE_INFO: The notes are too sparse, vague, or incomplete to make a determination.

SEVERITY SCALE (only if enough info to classify):
- "low": 1 isolated incident, no malice, accidental or habitual, cooperation shown
- "moderate": 2-3 incidents, OR negligence, OR first-time deliberate minor violation
- "high": 4-10 incidents, OR deliberate/knowing conduct, OR sensitive records
- "critical": 10+ incidents, OR willful pattern, OR malicious intent, OR large-scale breach

RECOMMENDATION TIER (must match severity):
- "re-education" → low severity
- "written_warning" → moderate severity
- "consider_termination" → high severity
- "recommend_termination" → critical severity`;

function buildReportPrompt(classification) {
  const tierInstructions = {
    "re-education": `RECOMMENDATION LEVEL: LOW — Include targeted re-education, verbal counseling, policy acknowledgment re-signature, 30-day monitoring. End with: "Any action taken rests within the discretion of Human Resources, Labor and Employee Relations and supervisory staff."`,
    "written_warning": `RECOMMENDATION LEVEL: MODERATE — Include formal written warning, mandatory HIPAA re-training, 90-180 day enhanced audit monitoring, access level review. State further violations may result in additional disciplinary action up to termination. End with: "Any action taken rests within the discretion of Human Resources, Labor and Employee Relations and supervisory staff."`,
    "consider_termination": `RECOMMENDATION LEVEL: HIGH — Present BOTH final written warning and termination as options. Include immediate access suspension, comprehensive audit of records accessed in past 12 months, breach risk assessment. State: "The Compliance and Privacy Department recommends that Human Resources consider termination." End with: "Any action taken rests within the discretion of Human Resources, Labor and Employee Relations and supervisory staff."`,
    "recommend_termination": `RECOMMENDATION LEVEL: CRITICAL — LEAD with termination recommendation. Include immediate access revocation, comprehensive audit, breach notification evaluation, legal counsel referral. End with: "Any action taken rests within the discretion of Human Resources, Labor and Employee Relations and supervisory staff."`,
  };

  const tier = tierInstructions[classification.recommendationTier] || tierInstructions["written_warning"];

  return `You are a report writer for a hospital Compliance and Privacy Department. Write in formal, professional, third-person voice. Refer to yourself as "The Compliance and Privacy Department" or "Compliance."

ABSOLUTE RULE — ZERO TOLERANCE FOR FABRICATION:
Every statement must be traceable to the investigation notes. NEVER fabricate interviews, audit results, dates, names, or details not in the notes. You are a scribe, not an investigator.

CLASSIFICATION (already determined — do NOT change these):
- Decision: ${classification.decision.toUpperCase()}
- Risk Level: ${classification.riskLevel.toUpperCase()}
- Violation Type: ${classification.violationType}
- Violations: ${classification.violationCount}
- Recommendation: ${classification.recommendationTier.replace(/_/g, " ").toUpperCase()}
${classification.aggravatingFactors.length > 0 ? `- Aggravating: ${classification.aggravatingFactors.join("; ")}` : ""}
${classification.mitigatingFactors.length > 0 ? `- Mitigating: ${classification.mitigatingFactors.join("; ")}` : ""}

TERMINOLOGY: Refer to accused as "the Implicated" and reporter as "the Source" after first identifying by name/title. If names not in notes, use "[Name not provided]".

HIPAA CITATIONS — Use where applicable: 45 CFR §§ 164.502(a), 164.508, 164.312(a)(1), 164.312(b), 164.308(a)(3), 164.530(b), 164.530(c), 164.400-414.

SECTIONS:
I. INTRODUCTION: Who reported, when, how. Only what notes say.
II. INCIDENT OVERVIEW: 3-5 sentences summarizing ONLY what the notes say.
III. INCIDENT DETAILS: ONLY investigation steps/evidence the notes EXPLICITLY mention.
IV. INVESTIGATION FINDINGS: "Through the course of investigation, the following was determined:" then list ONLY findings from notes.
V. RECOMMENDATIONS: ${classification.decision === "needs_more_info" ? "State additional information is needed." : `"Based on the foregoing, Compliance was able to ${classification.decision === "substantiated" ? "substantiate" : "not substantiate"} that the Implicated did [specific summary]."\n${tier}`}
VI. CONCLUSION: 2-3 sentences summarizing decision and risk level.`;
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
    const { reportText, step, classification: prevClassification } = payload;
    if (typeof reportText !== "string" || !reportText.trim()) {
      return res.status(400).json({ error: "No report text provided" });
    }
    if (reportText.length > MAX_REPORT_TEXT_LENGTH) {
      return res.status(413).json({ error: "Report text is too long. Maximum is 100,000 characters." });
    }

    if (step === "classify") {
      const classification = await callStructured(
        CLASSIFICATION_PROMPT,
        `Classify the following investigation notes. Assess completeness, count violations, determine severity.\n\n---\n${reportText}\n---`,
        classificationSchema,
        "severity_classification",
      );
      classification.confidenceScore = Math.max(0, Math.min(100, Number(classification.confidenceScore) || 0));
      const signature = await signClassification(classification);
      return res.json({ classification, signature });
    }

    if (step === "report" && prevClassification && typeof prevClassification === "object") {
      if (!isValidClassificationShape(prevClassification)) {
        return res.status(400).json({ error: "Invalid classification payload." });
      }

      const expectedSig = await signClassification(prevClassification);
      if (!timingSafeEqual(payload.signature, expectedSig)) {
        return res.status(400).json({ error: "Classification failed integrity check." });
      }

      const reportPrompt = buildReportPrompt(prevClassification);
      const report = await callStructured(
        reportPrompt,
        `Write the Incident Investigation Report for the following investigation notes. Decision: ${prevClassification.decision.toUpperCase()}, Risk: ${prevClassification.riskLevel.toUpperCase()}. Write ONLY what the notes say.\n\n---\n${reportText}\n---`,
        reportSchema,
        "compliance_report",
      );

      const result = {
        ...prevClassification,
        ...report,
        missingInfo: report.missingInfo?.length > 0 ? report.missingInfo : null,
      };
      return res.json(result);
    }

    return res.status(400).json({ error: "Invalid request: must specify step='classify' or step='report' with classification data" });
  } catch (e) {
    console.error("analyze-report error:", e);
    res.status(e.status || 500).json({ error: e.message || "Analysis failed" });
  }
});

router.use((req, res) => res.status(405).json({ error: "Method not allowed" }));

export default router;
