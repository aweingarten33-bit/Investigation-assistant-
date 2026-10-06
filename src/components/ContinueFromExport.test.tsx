import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContinueFromExport } from "./ContinueFromExport";

const extractDocxText = vi.fn();
vi.mock("@/lib/file-text", () => ({
  extractDocxText: (file: File) => extractDocxText(file),
  extractPdfText: vi.fn(),
}));

const EXPORT_TEXT = [
  "Compliance Investigation Report",
  "Case: CASE-42",
  "AI decision support: NEEDS MORE INFO  |  Risk: HIGH",
  "Investigation closure status: NOT READY TO CLOSE",
  "INVESTIGATION SUFFICIENCY / CLOSURE GATE",
  "NOT READY TO CLOSE",
  "The business reason has not been tested.",
  "IV. INVESTIGATION FINDINGS",
  "•  Access is confirmed by the audit log.",
].join("\n");

function openCardAndGetExportInput(container: HTMLElement) {
  fireEvent.click(screen.getByText("Continue from a previous export"));
  return container.querySelector('input[type="file"][accept^=".docx,application"]') as HTMLInputElement;
}

describe("ContinueFromExport", () => {
  it("rejects a non-.docx export upload", async () => {
    const { container } = render(<ContinueFromExport />);
    const input = openCardAndGetExportInput(container);
    fireEvent.change(input, { target: { files: [new File(["x"], "notes.pdf")] } });
    expect(await screen.findByText(/Upload the Word \(\.docx\) report exported by this app/)).toBeInTheDocument();
    expect(extractDocxText).not.toHaveBeenCalled();
  });

  it("explains, instead of guessing, when the Word file is not an export", async () => {
    extractDocxText.mockResolvedValueOnce("Interview Notes\nEmployee denied access");
    const { container } = render(<ContinueFromExport />);
    fireEvent.change(openCardAndGetExportInput(container), { target: { files: [new File(["x"], "notes.docx")] } });
    expect(await screen.findByText(/isn't recognised as a report exported by this app/)).toBeInTheDocument();
    expect(screen.queryByText("Build My Next Steps")).not.toBeInTheDocument();
  });

  it("shows what was recovered and offers the planner for a valid export", async () => {
    extractDocxText.mockResolvedValueOnce(EXPORT_TEXT);
    const { container } = render(<ContinueFromExport />);
    fireEvent.change(openCardAndGetExportInput(container), { target: { files: [new File(["x"], "Compliance_Report_CASE-42.docx")] } });
    await waitFor(() => expect(screen.getByText("Recovered from the export")).toBeInTheDocument());
    expect(screen.getByText("Case: CASE-42")).toBeInTheDocument();
    expect(screen.getByText("Closure status: not ready to close")).toBeInTheDocument();
    expect(screen.getByText("My Final Decision: not recorded")).toBeInTheDocument();
    expect(screen.getByText("Build My Next Steps")).toBeInTheDocument();
  });
});
