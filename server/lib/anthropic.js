export class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function model() {
  // "claude-sonnet-4-6" (the old default here) isn't a real model ID — it
  // was never actually exercised against a live key before now, which is
  // exactly the 400 this replaces.
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
}

// Structured output via forced tool-use — used by analyze-report for the
// classify/report steps, which need a validated JSON shape back.
export async function callClaudeStructured(apiKey, systemPrompt, userMessage, schema, toolName) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: model(),
      max_tokens: 4096,
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
    throw new HttpError(
      `AI analysis failed (${response.status})`,
      response.status === 429 ? 429 : response.status === 529 ? 503 : 502,
    );
  }

  const data = await response.json();
  const toolUse = data.content?.find((block) => block.type === "tool_use");
  if (!toolUse) {
    console.error("No tool_use block in response:", JSON.stringify(data));
    throw new Error("No structured response from AI");
  }
  return toolUse.input;
}

// Free-text output — used by the letter generator and case analysis tools.
export async function callClaudeText(apiKey, systemPrompt, userMessage) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
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
    throw new HttpError(
      `AI request failed (${response.status})`,
      response.status === 429 ? 429 : response.status === 529 ? 503 : 502,
    );
  }

  const data = await response.json();
  const block = data.content?.find((b) => b.type === "text");
  if (!block?.text) {
    console.error("No text block in response:", JSON.stringify(data));
    throw new Error("No response from AI");
  }
  return block.text;
}
