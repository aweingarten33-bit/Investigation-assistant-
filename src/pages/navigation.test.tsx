import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, Link } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Index from "./Index";
import Toolkit from "./Toolkit";
import { callApi } from "@/lib/api";
import { resetCapabilitiesForTests } from "@/lib/capabilities";
import { extractDocxText } from "@/lib/file-text";
import type { AnalysisResult } from "@/lib/types";

vi.mock("@/lib/api", () => ({ callApi: vi.fn() }));
// pdf.js needs browser APIs jsdom lacks; extraction is mocked.
vi.mock("@/lib/file-text", () => ({ extractDocxText: vi.fn(), extractPdfText: vi.fn() }));
const mockedCallApi = vi.mocked(callApi);
const mockedExtractDocx = vi.mocked(extractDocxText);

const NOTES = "Case #2026-0412\nCharge Nurse A reported that Employee B opened a coworker's chart without a work reason on 3/10.";

function report(): Omit<AnalysisResult, "caseId"> {
  return {
    decision: "needs_more_info",
    riskLevel: "moderate",
    violationType: "privacy",
    violationCount: "1",
    recommendationTier: "policy_review",
    aggravatingFactors: [],
    mitigatingFactors: [],
    notesCompleteness: "partial",
    evidenceItems: [],
    findings: [],
    hypotheses: [],
    sufficiencyChecks: [],
    closureAssessment: { status: "not_ready_to_close", rationale: "The purpose of the access is unresolved.", unresolvedMaterialIssues: [], whatWouldChangeConclusion: [] },
    disciplineFactors: [],
    disciplineRange: { minimum: "coaching", maximum: "termination", recommended: "defer", rationale: "Policy needed.", policyDependent: true, requiresHrLegalReview: true },
    policyQuestions: [],
    introduction: "Introduction.",
    incidentOverview: "Overview.",
    incidentDetails: "Details.",
    investigationFindings: [],
    regulationsCited: [],
    recommendations: "Recommendations.",
    conclusion: "Distinctive conclusion of the finished report.",
    missingInfo: null,
  };
}

const PLAN = {
  bottomLine: "Distinctive bottom line of the generated plan.",
  immediateActions: [], recordsToObtain: [], peopleToInterview: [], interviewQuestions: [],
  contradictionsToResolve: [], analysisChecks: [], correctiveActionIdeas: [], retestPlan: [],
  readyToClose: false, closeoutReason: "Purpose unresolved.",
};

beforeEach(() => {
  resetCapabilitiesForTests();
  mockedExtractDocx.mockReset();
  mockedExtractDocx.mockResolvedValue(NOTES);
  mockedCallApi.mockReset();
  mockedCallApi.mockImplementation(async (_route, body) => {
    const payload = body as { mode?: string; step?: string };
    if (payload.mode === "capabilities") return { data: { webSearch: false }, error: null } as never;
    if (payload.step === "classify") return { data: { classification: { evidenceItems: [], findings: [], hypotheses: [] }, signature: "s", inputHash: "h", sources: [] }, error: null } as never;
    if (payload.step === "report") return { data: report(), error: null } as never;
    if (payload.mode === "investigator_plan") return { data: { plan: PLAN }, error: null } as never;
    return { data: null, error: new Error("unexpected call") } as never;
  });
});

async function uploadNotes() {
  fireEvent.change(screen.getByTestId("source-file-input"), { target: { files: [new File(["x"], "notes.docx")] } });
  expect(await screen.findByText("notes.docx")).toBeInTheDocument();
}

function renderApp() {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Link to="/toolkit">test: open toolkit</Link>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/toolkit" element={<Toolkit />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Toolkit -> Interview Templates -> Back to Report Generator, as in the audit.
async function visitInterviewTemplatesAndComeBack() {
  fireEvent.click(screen.getByText("test: open toolkit"));
  const nav = await screen.findAllByText("Interview Templates");
  fireEvent.click(nav[nav.length - 1]);
  expect((await screen.findAllByText("Witness Interview")).length).toBeGreaterThan(0);
  fireEvent.click(screen.getAllByText("Back to Report Generator")[0]);
}

describe("internal navigation keeps the session's work", () => {
  it("keeps the uploaded notes", async () => {
    renderApp();
    await uploadNotes();
    await visitInterviewTemplatesAndComeBack();
    expect(await screen.findByText("notes.docx")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeEnabled();
  });

  it("keeps the completed report and the generated plan", async () => {
    renderApp();
    await uploadNotes();
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    expect(await screen.findByText("Distinctive conclusion of the finished report.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Build My Next Steps/ }));
    expect(await screen.findByText(PLAN.bottomLine)).toBeInTheDocument();

    await visitInterviewTemplatesAndComeBack();

    expect(await screen.findByText("Distinctive conclusion of the finished report.")).toBeInTheDocument();
    expect(screen.getByText(PLAN.bottomLine)).toBeInTheDocument();
    // Returning didn't re-run anything.
    expect(mockedCallApi.mock.calls.filter(([, body]) => (body as { mode?: string }).mode === "investigator_plan")).toHaveLength(1);
    expect(mockedCallApi.mock.calls.filter(([, body]) => (body as { step?: string }).step === "classify")).toHaveLength(1);
  });

  it("asks before New Analysis discards a finished report", async () => {
    renderApp();
    await uploadNotes();
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await screen.findByText("Distinctive conclusion of the finished report.");

    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "New Analysis" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Distinctive conclusion of the finished report.")).toBeInTheDocument();
    confirm.mockRestore();
  });
});

describe("reload/close warning", () => {
  it("is registered once there is work to lose", async () => {
    renderApp();
    const before = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(before);
    expect(before.defaultPrevented).toBe(false);

    await uploadNotes();
    await waitFor(() => {
      const after = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(after);
      expect(after.defaultPrevented).toBe(true);
    });
  });
});
