import { HttpError } from "./errors.js";
import { fetchWithTimeout } from "./fetch-with-timeout.js";

function model() {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
}

function apiKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new HttpError("ANTHROPIC_API_KEY is not configured", 500);
  return key;
}

// Anthropic's error bodies are small, safe-to-show validation messages
// (e.g. "model: claude-x not found", "x-api-key header is required") — not
// sensitive. Surfacing the real reason directly beats a bare status code.
function describeError(status, rawText) {
  try {
    const parsed = JSON.parse(rawText);
    const msg = parsed?.error?.message;
    if (typeof msg === "string" && msg.trim()) {
      return `Anthropic error (${status}): ${msg.slice(0, 300)}`;
    }
  } catch {
    // not JSON — fall through to the raw-text version below
  }
  const trimmed = rawText.trim();
  return trimmed ? `Anthropic error (${status}): ${trimmed.slice(0, 300)}` : `AI request failed (${status})`;
}

function statusFor(anthropicStatus) {
  return anthropicStatus === 429 ? 429 : anthropicStatus === 529 ? 503 : 502;
}

// Structured output via forced tool-use — used by analyze-report for the
// classify/report steps, which need a validated JSON shape back.
export async function callStructured(systemPrompt, userMessage, schema, toolName, maxTokens = 4096) {
  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey(),
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: model(),
      max_tokens: maxTokens,
      system: systemPrompt,
      tools: [{
        name: toolName,
        description: `Output structured ${toolName} data.`,
        input_schema: schema,
      }],
      tool_choice: { type: "tool", name: toolName },
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Anthropic API error:", response.status, text);
    throw new HttpError(describeError(response.status, text), statusFor(response.status));
  }

  const data = await response.json();
  if (data.stop_reason === "max_tokens") {
    // Confirms (rather than infers) that the response was cut off mid-
    // generation — this is the direct signal, not a guess from which
    // fields happened to be missing downstream.
    console.error(`Anthropic response for ${toolName} was truncated: stop_reason=max_tokens at maxTokens=${maxTokens}.`);
  }
  const toolUse = data.content?.find((block) => block.type === "tool_use");
  if (!toolUse) {
    console.error("No tool_use block in response:", JSON.stringify(data));
    throw new Error("No structured response from AI");
  }
  return toolUse.input;
}

// Free-text output — used by the letter generator and case analysis tools.
export async function callText(systemPrompt, userMessage) {
  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey(),
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: model(),
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Anthropic API error:", response.status, text);
    throw new HttpError(describeError(response.status, text), statusFor(response.status));
  }

  const data = await response.json();
  const block = data.content?.find((b) => b.type === "text");
  if (!block?.text) {
    console.error("No text block in response:", JSON.stringify(data));
    throw new Error("No response from AI");
  }
  return block.text;
}

// Free-text output grounded in live web search — used to pull current
// regulatory/industry context into a recommendation before it's made.
// Uses the basic web_search_20250305 tool type (rather than the newer
// dynamic-filtering variant) since ANTHROPIC_MODEL is user-configured and
// not guaranteed to support the newer tool version.
export async function callTextWithSearch(systemPrompt, userMessage, maxUses = 3) {
  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey(),
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: model(),
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxUses }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Anthropic API error:", response.status, text);
    throw new HttpError(describeError(response.status, text), statusFor(response.status));
  }

  const data = await response.json();
  const content = data.content || [];
  const text = content.filter((b) => b.type === "text").map((b) => b.text).join("");

  const sources = [];
  const seen = new Set();
  for (const block of content) {
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
    for (const result of block.content) {
      if (result.type === "web_search_result" && result.url && !seen.has(result.url)) {
        seen.add(result.url);
        sources.push({ url: result.url, title: result.title || result.url });
      }
    }
  }

  if (!text.trim()) {
    console.error("No text block in search response:", JSON.stringify(data));
    throw new Error("No response from AI");
  }
  return { text, sources };
}
