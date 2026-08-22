import * as anthropic from "./anthropic.js";
import * as openai from "./openai.js";
import * as gemini from "./gemini.js";

export { HttpError } from "./errors.js";

const PROVIDERS = { anthropic, openai, gemini };

function currentProvider() {
  const name = (process.env.AI_PROVIDER || "anthropic").trim().toLowerCase();
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`Unknown AI_PROVIDER "${name}" — must be one of: ${Object.keys(PROVIDERS).join(", ")}`);
  }
  return provider;
}

// Structured output via forced tool/function-calling — used by
// analyze-report for the classify/report steps, which need a validated
// JSON shape back.
export async function callStructured(systemPrompt, userMessage, schema, toolName) {
  return currentProvider().callStructured(systemPrompt, userMessage, schema, toolName);
}

// Free-text output — used by the letter generator and case analysis tools.
export async function callText(systemPrompt, userMessage) {
  return currentProvider().callText(systemPrompt, userMessage);
}

// Free-text output grounded in live web search — returns { text, sources }.
// maxUses lets investigation research spend more search calls when looking
// for analogous public enforcement cases while still keeping a hard cap.
export async function callTextWithSearch(systemPrompt, userMessage, maxUses = 3) {
  return currentProvider().callTextWithSearch(systemPrompt, userMessage, maxUses);
}
