import { HttpError } from "./errors.js";
import { fetchWithTimeout } from "./fetch-with-timeout.js";

function apiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new HttpError("OPENAI_API_KEY is not configured", 500);
  return key;
}

// No hardcoded fallback model here on purpose — a guessed model ID is
// exactly what caused the last outage on the Anthropic side (see git log).
// Set it explicitly to whatever's actually valid for your account.
function model() {
  const m = process.env.OPENAI_MODEL;
  if (!m) throw new HttpError("OPENAI_MODEL is not configured — set it to a valid model id from platform.openai.com/docs/models", 500);
  return m;
}

function describeError(status, rawText) {
  try {
    const parsed = JSON.parse(rawText);
    const msg = parsed?.error?.message;
    if (typeof msg === "string" && msg.trim()) {
      return `OpenAI error (${status}): ${msg.slice(0, 300)}`;
    }
  } catch {
    // not JSON — fall through
  }
  const trimmed = rawText.trim();
  return trimmed ? `OpenAI error (${status}): ${trimmed.slice(0, 300)}` : `AI request failed (${status})`;
}

function statusFor(openaiStatus) {
  return openaiStatus === 429 ? 429 : openaiStatus >= 500 ? 503 : 502;
}

async function chatCompletion(body) {
  const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: model(), ...body }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("OpenAI API error:", response.status, text);
    throw new HttpError(describeError(response.status, text), statusFor(response.status));
  }
  return response.json();
}

// Structured output via forced function-calling.
export async function callStructured(systemPrompt, userMessage, schema, toolName, maxTokens = 4096) {
  const data = await chatCompletion({
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    tools: [{
      type: "function",
      function: {
        name: toolName,
        description: `Output structured ${toolName} data.`,
        parameters: schema,
      },
    }],
    tool_choice: { type: "function", function: { name: toolName } },
  });

  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) {
    console.error("No tool call in response:", JSON.stringify(data));
    throw new Error("No structured response from AI");
  }
  try {
    return JSON.parse(call.function.arguments);
  } catch {
    console.error("Tool call arguments were not valid JSON:", call.function.arguments);
    throw new Error("No structured response from AI");
  }
}

// Free-text output.
export async function callText(systemPrompt, userMessage) {
  const data = await chatCompletion({
    max_tokens: 2048,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    console.error("No content in response:", JSON.stringify(data));
    throw new Error("No response from AI");
  }
  return text;
}

// Free-text output grounded in live web search.
//
// Unlike Anthropic/Gemini, OpenAI's Chat Completions API (which this file
// uses) has no optional web-search tool that works with an arbitrary model —
// search is instead baked into specific "-search-preview" models, which
// always search on every call. Getting toggleable search on any model
// requires OpenAI's separate Responses API, a different request/response
// shape from Chat Completions — out of scope here since it would mean a
// second code path for a feature this app doesn't otherwise need. If
// OPENAI_MODEL isn't a search-preview model, fail clearly instead of
// silently skipping grounding.
export async function callTextWithSearch(systemPrompt, userMessage) {
  if (!model().includes("search-preview")) {
    throw new HttpError(
      `OPENAI_MODEL "${model()}" does not support web search. OpenAI's Chat Completions API only searches ` +
      `with a "-search-preview" model (e.g. gpt-4o-search-preview) — set OPENAI_MODEL to one of those, or switch ` +
      `AI_PROVIDER to anthropic or gemini, both of which support search on any configured model.`,
      400,
    );
  }
  return callText(systemPrompt, userMessage).then((text) => ({ text, sources: [] }));
}
