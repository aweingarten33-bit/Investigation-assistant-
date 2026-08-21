import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── CORS / rate limiting / body caps ────────────────────────────────────────
// Mirrors the hardening applied to analyze-report (see AUDIT.md): origin
// allowlist, best-effort per-IP rate limiting, and a hard byte cap enforced
// while streaming the body (not just via Content-Length).

function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get("origin") || "";
  const configured = Deno.env.get("ALLOWED_ORIGINS")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (configured?.length) {
    return configured.includes(origin) ? origin : "null";
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

const MAX_FIELD_LENGTH = 20_000;
const MAX_BODY_BYTES = MAX_FIELD_LENGTH * 4 + 4_096;
const MIN_FIELD_LENGTH = 20;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const rateBuckets = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  rateBuckets.set(ip, hits);
  return hits.length > RATE_LIMIT_MAX;
}

async function readBodyWithLimit(req: Request, limit: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(merged);
}

// ─── Letter types ─────────────────────────────────────────────────────────

const LETTER_TYPES: Record<string, { label: string; instructions: string }> = {
  hr_referral: {
    label: "HR Referral Memo",
    instructions: "An INTERNAL memo FROM the Compliance and Privacy Department TO Human Resources — this is not sent to the employee. It hands off a substantiated finding to HR for review and action. Include: a concise summary of what was investigated and found, the specific policy/HIPAA provisions violated, the recommended disciplinary action and why (referencing severity, intent, and any prior history), and an explicit request that HR review the recommendation, make the final determination, and lead the notification to the employee. Close by noting Compliance is available for questions and that the final decision rests with HR, Labor and Employee Relations, and supervisory staff.",
  },
  verbal_counseling: {
    label: "Verbal Counseling Memo",
    instructions: "Level 1 — first-time minor violation. Document a coaching conversation, targeted re-education, and a policy acknowledgment re-signature. This memo stays in the compliance file, not the personnel file. Tone: corrective, not punitive.",
  },
  written_warning: {
    label: "Written Warning",
    instructions: "Level 2 — repeat or moderate violation. Formal written warning for the personnel file. Include mandatory HIPAA re-training with a competency check and an enhanced audit/monitoring period. State clearly that further violations may result in additional discipline up to termination.",
  },
  final_warning: {
    label: "Final Warning / Suspension",
    instructions: "Level 3 — serious violation. Final written warning explicitly stating that a further violation results in termination. Include any suspension terms, immediate access review, and an extended monitoring period.",
  },
  termination: {
    label: "Termination Letter",
    instructions: "Level 4 — willful, fraudulent, or pattern violation. Lead with the termination decision and effective date. Reference the specific policy and HIPAA provisions violated, prior warnings if any, and next steps (access revocation, return of property).",
  },
  not_substantiated: {
    label: "Not Substantiated Closure",
    instructions: "The investigation could not substantiate the allegation. Explain plainly that this does not mean the report was false — only that the evidence was insufficient to make a determination. Note the matter is closed.",
  },
  unfounded: {
    label: "Unfounded Closure",
    instructions: "The evidence affirmatively disproves the allegation. State the finding is unfounded and the matter is closed with no action against the subject.",
  },
  inconclusive: {
    label: "Inconclusive Closure",
    instructions: "Evidence was genuinely split and no determination could be made. Explain the limitation, note any monitoring or process improvements, and state the matter is closed.",
  },
  exoneration: {
    label: "Exoneration Letter",
    instructions: "Clear the subject completely. State the investigation found the conduct did not occur or was fully justified, and confirm no record of the allegation will affect their standing.",
  },
  reporter_update: {
    label: "Reporter Update",
    instructions: "A status update to the person who reported the concern. Confirm the matter was investigated and appropriate action was taken, WITHOUT disclosing the outcome, discipline, or any details about the person investigated.",
  },
  regulatory_disclosure: {
    label: "Self-Disclosure Template",
    instructions: "An OIG/OCR self-disclosure letter template. Include: what happened, which programs/records were affected, the estimated scope, the time period, and corrective actions already taken. Use bracketed placeholders for anything not in the case details.",
  },
};

// ─── Anthropic helper (free-text, non-streaming) ────────────────────────────

class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function callClaudeText(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Anthropic API error:", response.status, text);
    throw new HttpError(
      `AI request failed (${response.status})`,
      response.status === 429 ? 429 : response.status === 529 ? 503 : 502,
    );
  }

  const data = await response.json();
  const block = (data.content as Array<{ type: string; text?: string }> | undefined)
    ?.find((b) => b.type === "text");
  if (!block?.text) {
    console.error("No text block in response:", JSON.stringify(data));
    throw new Error("No response from AI");
  }
  return block.text;
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

function buildLetterPrompt(letterType: string): string {
  const meta = LETTER_TYPES[letterType];
  return `You are a report writer for a hospital Compliance and Privacy Department. Write in formal, professional, third-person voice. Refer to yourself as "The Compliance and Privacy Department" or "Compliance."

Generate a ${meta.label}. ${meta.instructions}

ABSOLUTE RULE: Every statement must be traceable to the case details provided. Never fabricate names, dates, or facts not given — use bracketed placeholders like [Employee Name] or [Date] for anything missing.

Format as a complete, ready-to-send business letter/memo: date line, recipient line, subject line, body, and a closing signature block for "The Compliance and Privacy Department." End with: "Any action taken rests within the discretion of Human Resources, Labor and Employee Relations and supervisory staff." unless this is a Reporter Update or Self-Disclosure, which have their own closings.`;
}

const CASE_ANALYSIS_PROMPT = `You are a senior hospital compliance and privacy investigator. Analyze the case facts and provide a concise, structured regulatory read.

Be concise — bullet points, not paragraphs. No preamble, no restating the facts back. Keep the total response under 500 words. Only reference facts explicitly present in what's provided; flag gaps instead of guessing.

## Root Cause
- 1-2 sentences: primary root cause, system vs. individual failure

## HIPAA / Regulatory Exposure
- Applicable 45 CFR sections (one line each)
- Penalty range if substantiated
- Any mandatory reporting deadlines triggered (e.g., 60-day breach notification)

## Risk Level: [Critical/High/Medium/Low]
- One line each: regulatory, reputational, patient-trust

## Suggested Next Steps
- Numbered, max 6 steps — what to pull, who to interview, in what order

## Likely Determination
- Tentative finding + recommendation tier (re-education / written warning / consider termination / recommend termination), 1-2 sentences
- Note explicitly that this is a preliminary read, not a substitute for the full investigation`;

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const clientIp = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (isRateLimited(clientIp)) {
    return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
    });
  }

  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "Request body is too large." }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const rawBody = await readBodyWithLimit(req, MAX_BODY_BYTES);
    if (rawBody === null) {
      return new Response(JSON.stringify({ error: "Request body is too large." }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const { mode } = payload;

    if (mode === "generate_letter") {
      const { letterType, caseDetails } = payload;
      if (typeof letterType !== "string" || !(letterType in LETTER_TYPES)) {
        return new Response(JSON.stringify({ error: "Invalid letter type." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof caseDetails !== "string" || caseDetails.trim().length < MIN_FIELD_LENGTH) {
        return new Response(JSON.stringify({ error: "Please provide more case detail." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (caseDetails.length > MAX_FIELD_LENGTH) {
        return new Response(JSON.stringify({ error: "Case details are too long." }), {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const text = await callClaudeText(
        ANTHROPIC_API_KEY,
        buildLetterPrompt(letterType),
        `Generate the letter for this case:\n\n---\n${caseDetails.trim()}\n---`,
      );
      return new Response(JSON.stringify({ text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "case_analysis") {
      const { caseFacts } = payload;
      if (typeof caseFacts !== "string" || caseFacts.trim().length < MIN_FIELD_LENGTH) {
        return new Response(JSON.stringify({ error: "Please provide more case detail." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (caseFacts.length > MAX_FIELD_LENGTH) {
        return new Response(JSON.stringify({ error: "Case facts are too long." }), {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const text = await callClaudeText(
        ANTHROPIC_API_KEY,
        CASE_ANALYSIS_PROMPT,
        `## Case Facts\n${caseFacts.trim()}`,
      );
      return new Response(JSON.stringify({ text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid request: mode must be 'generate_letter' or 'case_analysis'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("investigation-toolkit error:", e);
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Request failed";
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
