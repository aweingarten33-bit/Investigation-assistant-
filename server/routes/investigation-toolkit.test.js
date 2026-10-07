// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";

vi.mock("../lib/ai.js", () => ({
  callStructured: vi.fn(),
  callTextDetailed: vi.fn(),
  callTextWithSearch: vi.fn(),
  supportsWebSearch: vi.fn(),
}));

import { callStructured, callTextDetailed, callTextWithSearch, supportsWebSearch } from "../lib/ai.js";
import { HttpError, SEARCH_UNSUPPORTED } from "../lib/errors.js";
import router from "./investigation-toolkit.js";

const RAW_PROVIDER_TEXT = /deepseek|AI_PROVIDER|anthropic|gemini|openai|api key|error \(\d+\)/i;
const NOTES = "Charge Nurse A reported that Employee B opened a coworker's chart without a work reason.";

let server;
let baseUrl;
beforeAll(async () => {
  const app = express();
  app.use("/api/investigation-toolkit", router);
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/investigation-toolkit`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => vi.resetAllMocks());

async function post(body) {
  const response = await fetch(baseUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, json: await response.json() };
}

describe("Similar Public Cases never leaks backend error text", () => {
  it("reports search capability so the UI can hide the feature", async () => {
    supportsWebSearch.mockReturnValue(false);
    const { json } = await post({ mode: "capabilities" });
    expect(json).toEqual({ webSearch: false });
  });

  it("returns 'unavailable' without calling the provider when web search isn't supported", async () => {
    supportsWebSearch.mockReturnValue(false);
    const { status, json } = await post({ mode: "public_case_research", caseNotes: NOTES });
    expect(status).toBe(200);
    expect(json.unavailable).toBe(true);
    expect(callTextWithSearch).not.toHaveBeenCalled();
    expect(JSON.stringify(json)).not.toMatch(RAW_PROVIDER_TEXT);
  });

  it("replaces a raw provider error with a safe message", async () => {
    supportsWebSearch.mockReturnValue(true);
    callStructured.mockResolvedValue({ category: "hipaa_unauthorized_access", setting: "hospital", pattern: "curiosity_access", intent: "intentional", scale: "single_event" });
    callTextWithSearch.mockRejectedValue(new HttpError(
      "DeepSeek does not support web search. Switch AI_PROVIDER to anthropic or gemini for regulatory web research.",
      400,
      { code: SEARCH_UNSUPPORTED, publicMessage: "Web search isn't available with the AI provider this app is using." },
    ));
    const { status, json } = await post({ mode: "public_case_research", caseNotes: NOTES });
    expect(callTextWithSearch).toHaveBeenCalledTimes(1);
    expect(status).toBe(400);
    expect(json.error).toBe("Web search isn't available with the AI provider this app is using.");
    expect(JSON.stringify(json)).not.toMatch(RAW_PROVIDER_TEXT);
  });

  it("never forwards an unexpected provider error's message", async () => {
    supportsWebSearch.mockReturnValue(true);
    callStructured.mockRejectedValue(new HttpError("DeepSeek error (400): Thinking mode does not support this tool_choice", 502));
    const { json } = await post({ mode: "public_case_research", caseNotes: NOTES });
    expect(json.error).toBe("The AI request failed. Please try again.");
  });
});

describe("letter generation reports truncation", () => {
  it("returns truncated: true when the provider stopped at its length limit", async () => {
    callTextDetailed.mockResolvedValue({ text: "MEMORANDUM\nTo: Human Resources\nThe investigation found that the empl", truncated: true });
    const { json } = await post({ mode: "generate_letter", letterType: "hr_referral", caseDetails: NOTES });
    expect(json.truncated).toBe(true);
    expect(callTextDetailed.mock.calls[0][2]).toEqual({ maxTokens: 4096 });
  });

  it("uses the longer limit when asked to regenerate", async () => {
    callTextDetailed.mockResolvedValue({ text: "Complete memo.", truncated: false });
    const { json } = await post({ mode: "generate_letter", letterType: "hr_referral", caseDetails: NOTES, extendedLength: true });
    expect(json).toEqual({ text: "Complete memo.", truncated: false });
    expect(callTextDetailed.mock.calls[0][2]).toEqual({ maxTokens: 8192 });
  });
});

describe("next-step plan provenance", () => {
  it("does not let the plan's bottom line claim an unsupplied record was reviewed", async () => {
    const notes = "Per the unit roster, Employee B was on Unit 4.\nOriginal roster not supplied, investigator summary only.";
    callStructured.mockResolvedValue({
      bottomLine: "Presence is confirmed by roster records; focus on purpose.",
      immediateActions: [], recordsToObtain: ["Obtain the original roster."], peopleToInterview: [], interviewQuestions: [],
      contradictionsToResolve: [], analysisChecks: [], correctiveActionIdeas: [], retestPlan: [],
      readyToClose: false, closeoutReason: "Documentary evidence corroborates presence but purpose is open.",
    });
    const { json } = await post({ mode: "investigator_plan", caseNotes: notes, analysisSummary: JSON.stringify({ evidenceItems: [{ provenance: "investigator_summary" }] }) });
    expect(json.plan.bottomLine).not.toMatch(/confirmed by roster records/i);
    expect(json.plan.closeoutReason).not.toMatch(/documentary evidence corroborates/i);
    expect(json.plan.recordsToObtain).toEqual(["Obtain the original roster."]);
  });
});
