import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import Index from "./Index";
import { callApi } from "@/lib/api";
import { extractDocxText, extractPdfText } from "@/lib/file-text";
import { resetCapabilitiesForTests } from "@/lib/capabilities";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/api", () => ({ callApi: vi.fn() }));
vi.mock("@/lib/file-text", () => ({ extractDocxText: vi.fn(), extractPdfText: vi.fn() }));

const mockedExtractDocx = vi.mocked(extractDocxText);
const mockedExtractPdf = vi.mocked(extractPdfText);
const NOTES = "Case #2026-0412\nCharge Nurse A reported that Employee B opened a coworker's chart without a work reason.";

function renderIndex() {
  render(<MemoryRouter><Index /></MemoryRouter>);
}

function upload(...files: File[]) {
  fireEvent.change(screen.getByTestId("source-file-input"), { target: { files } });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetCapabilitiesForTests();
  vi.mocked(callApi).mockResolvedValue({ data: { webSearch: false }, error: null } as never);
});

describe("main page input is upload-only", () => {
  it("has no Type/Paste option or notes textarea", () => {
    renderIndex();
    expect(screen.queryByText(/Type \/ Paste/)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/paste your investigation notes/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText(/Drop one or more investigation files here, or click to upload/)).toBeInTheDocument();
  });

  it("uses the new copy and keeps Try Sample and the privacy line", () => {
    renderIndex();
    expect(screen.getByText("Upload your investigation notes (Word or PDF). It maps every fact to its source, flags contradictions, weighs the evidence, and writes the report — with citations for every line.")).toBeInTheDocument();
    expect(screen.getByText("Upload a Word or PDF file to get started.")).toBeInTheDocument();
    expect(screen.getByText("Optional: add your policy or discipline matrix — it weighs corrective action against it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try Sample/ })).toBeInTheDocument();
    expect(screen.getByText(/Privacy-first demo\./)).toBeInTheDocument();
  });

  it("loads the sample as a file and enables Analyze", () => {
    renderIndex();
    fireEvent.click(screen.getByRole("button", { name: /Try Sample/ }));
    expect(screen.getByText("Sample report", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeEnabled();
  });
});

describe("upload toasts", () => {
  it("shows no error after a successful extraction", async () => {
    mockedExtractDocx.mockResolvedValue(NOTES);
    renderIndex();
    upload(new File(["x"], "notes.docx"));
    expect(await screen.findByText("notes.docx")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("names only the file that failed, without an error, when the others load", async () => {
    mockedExtractDocx.mockResolvedValue(NOTES);
    mockedExtractPdf.mockRejectedValue(new Error("Invalid PDF structure"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderIndex();
    upload(new File(["x"], "notes.docx"), new File(["y"], "broken.pdf"));
    expect(await screen.findByText("notes.docx")).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("broken.pdf"));
  });

  it("ignores an earlier overlapping upload that fails after a later one succeeds", async () => {
    let failFirst: (error: Error) => void = () => {};
    mockedExtractDocx
      .mockImplementationOnce(() => new Promise((_, reject) => { failFirst = reject; }))
      .mockResolvedValueOnce(NOTES);
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderIndex();
    upload(new File(["x"], "first.docx"));
    upload(new File(["x"], "second.docx"));
    expect(await screen.findByText("second.docx")).toBeInTheDocument();
    failFirst(new Error("superseded read failed"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByText("second.docx")).toBeInTheDocument();
  });

  it("still reports a real failure when nothing could be read", async () => {
    mockedExtractDocx.mockRejectedValue(new Error("not a zip file"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderIndex();
    upload(new File(["x"], "corrupt.docx"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("corrupt.docx")));
  });
});
