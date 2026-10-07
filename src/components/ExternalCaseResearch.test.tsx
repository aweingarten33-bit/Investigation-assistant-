import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExternalCaseResearch } from "./ExternalCaseResearch";
import { callApi } from "@/lib/api";
import { resetCapabilitiesForTests } from "@/lib/capabilities";

vi.mock("@/lib/api", () => ({ callApi: vi.fn() }));
const mockedCallApi = vi.mocked(callApi);

const NOTES = "Charge Nurse A reported that Employee B opened a coworker's chart without a work reason.";
const RAW_PROVIDER_TEXT = /deepseek|AI_PROVIDER|anthropic|gemini|error \(\d+\)/i;

function respond(handlers: Record<string, () => { data: unknown; error: Error | null }>) {
  mockedCallApi.mockImplementation(async (_route, body) => {
    const mode = (body as { mode: string }).mode;
    return handlers[mode]() as never;
  });
}

beforeEach(() => {
  mockedCallApi.mockReset();
  resetCapabilitiesForTests();
});

describe("Similar Public Cases", () => {
  it("is hidden when the configured AI provider can't search the web", async () => {
    respond({ capabilities: () => ({ data: { webSearch: false }, error: null }) });
    const { container } = render(<ExternalCaseResearch caseNotes={NOTES} />);
    await waitFor(() => expect(mockedCallApi).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(mockedCallApi).not.toHaveBeenCalledWith("investigation-toolkit", expect.objectContaining({ mode: "public_case_research" }));
  });

  it("never shows backend error text, even if the server sends it", async () => {
    respond({
      capabilities: () => ({ data: { webSearch: true }, error: null }),
      public_case_research: () => ({ data: null, error: new Error("DeepSeek does not support web search. Switch AI_PROVIDER to anthropic or gemini for regulatory web research.") }),
    });
    render(<ExternalCaseResearch caseNotes={NOTES} autoSearch={false} />);
    (await screen.findByRole("button", { name: /Search Similar Public Cases/ })).click();
    expect(await screen.findByText(/Similar public cases couldn't be loaded right now/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(RAW_PROVIDER_TEXT);
  });
});
