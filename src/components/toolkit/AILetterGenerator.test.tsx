import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AILetterGenerator from "./AILetterGenerator";
import { callApi } from "@/lib/api";

vi.mock("@/lib/api", () => ({ callApi: vi.fn() }));
const mockedCallApi = vi.mocked(callApi);

const DETAILS = "Employee B opened a coworker's chart without a work reason; HR referral needed.";

function renderGenerator() {
  render(<AILetterGenerator initialLetterType="hr_referral" initialCaseDetails={DETAILS} />);
}

beforeEach(() => mockedCallApi.mockReset());

describe("AI Letter Generator with a length-limited response", () => {
  it("flags a cut-off letter and disables Copy", async () => {
    mockedCallApi.mockResolvedValueOnce({ data: { text: "MEMORANDUM\n\nTo: Human Resources\n\nThe investigation found that the empl", truncated: true }, error: null });
    renderGenerator();
    fireEvent.click(screen.getByRole("button", { name: /Generate Letter/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/This letter was cut short/);
    expect(screen.getByRole("button", { name: /^Copy$/ })).toBeDisabled();
  });

  it("regenerates with the longer limit, and enables Copy once the letter is complete", async () => {
    mockedCallApi
      .mockResolvedValueOnce({ data: { text: "MEMORANDUM ... the empl", truncated: true }, error: null })
      .mockResolvedValueOnce({ data: { text: "MEMORANDUM\n\nThe complete memo.", truncated: false }, error: null });
    renderGenerator();
    fireEvent.click(screen.getByRole("button", { name: /Generate Letter/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Regenerate with a longer limit/ }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(mockedCallApi).toHaveBeenLastCalledWith("investigation-toolkit", expect.objectContaining({ mode: "generate_letter", extendedLength: true }));
    expect(await screen.findByText(/The complete memo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Copy$/ })).toBeEnabled();
  });
});
