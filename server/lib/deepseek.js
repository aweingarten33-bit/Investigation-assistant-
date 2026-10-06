import { HttpError } from "./errors.js";
import { fetchWithTimeout } from "./fetch-with-timeout.js";

function apiKey() {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new HttpError("DEEPSEEK_API_KEY is not configured", 500);
  return key;
}

// Defaults to deepseek-flash; set DEEPSEEK_MODEL to override.
function model() {
  return process.env.DEEPSEEK_MODEL || "deepseek-flash";
}

function describeError(status, rawText) {
  try {
    const parsed = JSON.parse(rawText);
    const msg = parsed?.error?.message;
    if (typeof msg === "string" && msg.trim()) {
      return `DeepSeek error (${status}): ${msg.slice(0, 300)}`;
    }
  } catch {
    // not JSON — fall through
  }
  const trimmed = rawText.trim();
  return trimmed ? `DeepSeek error (${status}): ${trimmed.slice(0, 300)}` : `AI request failed (${status})`;
}

function statusFor(deepseekStatus) {
  return deepseekStatus === 429 ? 429 : deepseekStatus >= 500 ? 503 : 502;
}

// DeepSeek's API is OpenAI-compatible (Chat Completions shape).
async function chatCompletion(body) {
  const response = await fetchWithTimeout("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: model(), ...body }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("DeepSeek API error:", response.status, text);
    throw new HttpError(describeError(response.status, text), statusFor(response.status));
  }
  const data = await response.json();
  if (data.choices?.[0]?.finish_reason === "length") {
    console.error(`DeepSeek response was truncated: finish_reason=length at max_tokens=${body.max_tokens}.`);
  }
  return data;
}

// Structured output via function-calling. DeepSeek's thinking mode rejects a
// forced (named) tool_choice, so tool_choice is omitted (defaults to auto) and
// the system prompt tells the model to answer through the single tool.
export async function callStructured(systemPrompt, userMessage, schema, toolName, maxTokens = 4096) {
  const data = await chatCompletion({
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: `${systemPrompt}\n\nRespond only by calling the ${toolName} function.` },
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

// DeepSeek's API has no web-search tool, so grounded calls fail clearly
// instead of silently returning ungrounded text.
export async function callTextWithSearch() {
  throw new HttpError(
    "DeepSeek does not support web search. Switch AI_PROVIDER to anthropic or gemini for regulatory web research.",
    400,
  );
}
