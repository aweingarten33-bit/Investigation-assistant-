import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get("origin") || "";
  const configured = Deno.env.get("ALLOWED_ORIGINS")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  // If ALLOWED_ORIGINS is set in Supabase secrets, enforce it strictly.
  // Otherwise allow all origins so the app works before production hardening.
  // Set ALLOWED_ORIGINS=https://your-app.vercel.app in Supabase Edge Function secrets.
  if (configured?.length) {
    return configured.includes(origin) ? origin : configured[0];
  }
  return "*";
}

function corsHeadersFor(req: Request) {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(req),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}

const MAX_REPORT_TEXT_LENGTH = 100_000;

// ─── Schemas ─────────────────────────────────────────────────────────────────

const classificationSchema = {
  type: "object" as const,
  properties: {
    decision: {
      type: "string" as const,
      enum: ["substantiated", "unsubstantiated", "needs_more_info"],
    },
    riskLevel: {
      type: "string" as const,
      enum: ["low", "moderate", "high", "critical"],
    },
    confidenceScore: { type: "integer" as const },
    violationType: { type: "string" as const },
    violationCount: { type: "string" as const },
    recommendationTier: {
      type: "string" as const,
      enum: ["re-education", "written_warning", "consider_termination", "recommend_termination"],
    },
    aggravatingFactors: { type: "array" as const, items: { type: "string" as const } },
    mitigatingFactors: { type: "array" as const, items: { type: "string" as const } },
    notesCompleteness: { type: "string" as const, enum: ["complete", "partial", "insufficient"] },
    missingElements: { type: "array" as const, items: { type: "string" as const } },
  },
  required: ["decision", "riskLevel", "confidenceScore", "violationType", "violationCount", "recommendationTier", "aggravatingFactors", "mitigatingFactors", "notesCompleteness", "missingElements"],
};

const reportSchema = {
  type: "object" as const,
  properties: {
    introduction: { type: "string" as const },
    incidentOverview: { type: "string" as const },
    incidentDetails: { type: "string" as const },
    investigationFindings: { type: "array" as const, items: { type: "string" as const } },
    regulationsCited: { type: "array" as const, items: { type: "string" as const } },
    recommendations: { type: "string" as const },
    conclusion: { type: "string" as const },
    missingInfo: { type: "array" as const, items: { type: "string" as const } },
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

function buildReportPrompt(classification: any): string {
  const tierInstructions: Record<string, string> = {
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

// ─── Anthropic Claude Helper ─────────────────────────────────────────────────

async function callClaudeStructured(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  schema: any,
  toolName: string,
): Promise<any> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      tools: [{
        name: toolName,
        description: `Output structured ${toolName} data.`,
        input_schema: schema,
      }],
      tool_choice: { type: "tool", name: toolName },
      messages: [
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Anthropic API error:", response.status, text);
    const err = new Error(`AI analysis failed (${response.status}): ${text}`);
    (err as any).status = response.status === 429 ? 429 : response.status === 529 ? 503 : 502;
    throw err;
  }

  const data = await response.json();

  const toolUse = data.content?.find((block: any) => block.type === "tool_use");
  if (!toolUse) {
    console.error("No tool_use block in response:", JSON.stringify(data));
    throw new Error("No structured response from AI");
  }

  return toolUse.input;
}

// ─── Main Handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reportText, step, classification: prevClassification } = payload;
    if (typeof reportText !== "string" || !reportText.trim()) {
      return new Response(JSON.stringify({ error: "No report text provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (reportText.length > MAX_REPORT_TEXT_LENGTH) {
      return new Response(JSON.stringify({ error: "Report text is too long. Maximum is 100,000 characters." }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    if (step === "classify") {
      console.log("Step 1: Classifying...");
      const classification = await callClaudeStructured(
        ANTHROPIC_API_KEY,
        CLASSIFICATION_PROMPT,
        `Classify the following investigation notes. Assess completeness, count violations, determine severity.\n\n---\n${reportText}\n---`,
        classificationSchema,
        "severity_classification",
      );
      classification.confidenceScore = Math.max(0, Math.min(100, Number(classification.confidenceScore) || 0));
      console.log("Classification:", JSON.stringify(classification));
      return new Response(JSON.stringify({ classification }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (step === "report" && prevClassification && typeof prevClassification === "object") {
      console.log("Step 2: Generating report...");
      const reportPrompt = buildReportPrompt(prevClassification);
      const report = await callClaudeStructured(
        ANTHROPIC_API_KEY,
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

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid request: must specify step='classify' or step='report' with classification data" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("analyze-report error:", e);
    const status = e.status || 500;
    return new Response(JSON.stringify({ error: e.message || "Analysis failed" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
