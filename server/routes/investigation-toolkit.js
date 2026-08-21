import express from "express";
import { callClaudeText, HttpError } from "../lib/anthropic.js";
import { createRateLimiter, clientIp } from "../lib/rate-limit.js";

const MAX_FIELD_LENGTH = 20_000;
const MAX_BODY_BYTES = MAX_FIELD_LENGTH * 4 + 4_096;
const MIN_FIELD_LENGTH = 20;

const isRateLimited = createRateLimiter();

const LETTER_TYPES = {
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

function buildLetterPrompt(letterType) {
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

const router = express.Router();

router.use(express.json({ limit: MAX_BODY_BYTES }));

router.post("/", async (req, res) => {
  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    res.set("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests. Please slow down." });
  }

  try {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const { mode } = req.body;

    if (mode === "generate_letter") {
      const { letterType, caseDetails } = req.body;
      if (typeof letterType !== "string" || !(letterType in LETTER_TYPES)) {
        return res.status(400).json({ error: "Invalid letter type." });
      }
      if (typeof caseDetails !== "string" || caseDetails.trim().length < MIN_FIELD_LENGTH) {
        return res.status(400).json({ error: "Please provide more case detail." });
      }
      if (caseDetails.length > MAX_FIELD_LENGTH) {
        return res.status(413).json({ error: "Case details are too long." });
      }

      const text = await callClaudeText(
        ANTHROPIC_API_KEY,
        buildLetterPrompt(letterType),
        `Generate the letter for this case:\n\n---\n${caseDetails.trim()}\n---`,
      );
      return res.json({ text });
    }

    if (mode === "case_analysis") {
      const { caseFacts } = req.body;
      if (typeof caseFacts !== "string" || caseFacts.trim().length < MIN_FIELD_LENGTH) {
        return res.status(400).json({ error: "Please provide more case detail." });
      }
      if (caseFacts.length > MAX_FIELD_LENGTH) {
        return res.status(413).json({ error: "Case facts are too long." });
      }

      const text = await callClaudeText(ANTHROPIC_API_KEY, CASE_ANALYSIS_PROMPT, `## Case Facts\n${caseFacts.trim()}`);
      return res.json({ text });
    }

    return res.status(400).json({ error: "Invalid request: mode must be 'generate_letter' or 'case_analysis'" });
  } catch (e) {
    console.error("investigation-toolkit error:", e);
    const status = e instanceof HttpError ? e.status : 500;
    res.status(status).json({ error: e.message || "Request failed" });
  }
});

router.use((req, res) => res.status(405).json({ error: "Method not allowed" }));

export default router;
