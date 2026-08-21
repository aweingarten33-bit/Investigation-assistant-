import { HttpError } from "./errors.js";

function apiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError("GEMINI_API_KEY is not configured", 500);
  return key;
}

// No hardcoded fallback model here on purpose — a guessed model ID is
// exactly what caused the last outage on the Anthropic side (see git log).
// Set it explicitly to whatever's actually valid for your account.
function model() {
  const m = process.env.GEMINI_MODEL;
  if (!m) throw new HttpError("GEMINI_MODEL is not configured — set it to a valid model id from ai.google.dev/gemini-api/docs/models", 500);
  return m;
}

function describeError(status, rawText) {
  try {
    const parsed = JSON.parse(rawText);
    const msg = parsed?.error?.message;
    if (typeof msg === "string" && msg.trim()) {
      return `Gemini error (${status}): ${msg.slice(0, 300)}`;
    }
  } catch {
    // not JSON — fall through
  }
  const trimmed = rawText.trim();
  return trimmed ? `Gemini error (${status}): ${trimmed.slice(0, 300)}` : `AI request failed (${status})`;
}

function statusFor(geminiStatus) {
  return geminiStatus === 429 ? 429 : geminiStatus >= 500 ? 503 : 502;
}

async function generateContent(body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model())}:generateContent?key=${encodeURIComponent(apiKey())}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Gemini API error:", response.status, text);
    throw new HttpError(describeError(response.status, text), statusFor(response.status));
  }
  return response.json();
}

// Structured output via forced function-calling.
export async function callStructured(systemPrompt, userMessage, schema, toolName) {
  const data = await generateContent({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    tools: [{ functionDeclarations: [{ name: toolName, description: `Output structured ${toolName} data.`, parameters: schema }] }],
    toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [toolName] } },
  });

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const call = parts.find((p) => p.functionCall)?.functionCall;
  if (!call?.args) {
    console.error("No function call in response:", JSON.stringify(data));
    throw new Error("No structured response from AI");
  }
  return call.args;
}

// Free-text output.
export async function callText(systemPrompt, userMessage) {
  const data = await generateContent({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
  });

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text).filter(Boolean).join("");
  if (!text) {
    console.error("No text in response:", JSON.stringify(data));
    throw new Error("No response from AI");
  }
  return text;
}

// Free-text output grounded in live Google Search — used to pull current
// regulatory/industry context into a recommendation before it's made.
export async function callTextWithSearch(systemPrompt, userMessage) {
  const data = await generateContent({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    tools: [{ google_search: {} }],
  });

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text).filter(Boolean).join("");

  const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources = [];
  const seen = new Set();
  for (const chunk of chunks) {
    const url = chunk.web?.uri || chunk.uri;
    const title = chunk.web?.title || chunk.title || url;
    if (url && !seen.has(url)) {
      seen.add(url);
      sources.push({ url, title });
    }
  }

  if (!text) {
    console.error("No text in search response:", JSON.stringify(data));
    throw new Error("No response from AI");
  }
  return { text, sources };
}
