import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisProgress } from "./AnalysisProgress";

describe("AnalysisProgress", () => {
  it("shows the evidence analysis as running and the report as not started during the first request", () => {
    render(<AnalysisProgress step={1} classifyStartedAt={Date.now()} reportStartedAt={null} classifySummary={null} />);
    expect(screen.getByText("Analyzing the evidence")).toBeInTheDocument();
    expect(screen.getByText(/one AI call that maps evidence to source lines/)).toBeInTheDocument();
    expect(screen.getByText("Writing the report")).toBeInTheDocument();
  });

  it("reports the real counts from the finished analysis while the report is written", () => {
    const start = Date.now() - 42_000;
    render(
      <AnalysisProgress
        step={2}
        classifyStartedAt={start}
        reportStartedAt={start + 40_000}
        classifySummary={{ evidenceCount: 12, findingCount: 3, hypothesisCount: 1 }}
      />,
    );
    expect(screen.getByText(/Mapped 12 evidence items into 3 findings; tested 1 competing explanation;/)).toBeInTheDocument();
    expect(screen.getByText("40s")).toBeInTheDocument();
  });
});
