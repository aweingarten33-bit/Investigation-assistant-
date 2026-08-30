// Verifies the JS port against the same hand-verified worked example as the
// upstream Python selftest (radarist/structured-analytic-skills,
// analysis-of-competing-hypotheses/scripts/ach.py, SELFTEST_CASE) — same
// numbers, same ranking, same diagnosticity, just re-expressed in the
// six-value mark vocabulary this app uses (strongly_consistent/consistent/
// neutral/inconsistent/strongly_inconsistent/not_applicable in place of
// CC/C/N/I/II/NA) so a faithful port is provable, not just plausible.
import { describe, expect, it } from "vitest";
import {
  diagnosticityFlag,
  inconsistencyTotals,
  markSpread,
  mostDiagnostic,
  rankHypotheses,
  scoreAch,
  sensitivityAnalysis,
} from "./ach.js";

const HYPOTHESES = [
  { id: "H1", label: "Adoption is genuinely slow" },
  { id: "H2", label: "Pivot to a different segment" },
  { id: "H3", label: "Null — market noise" },
];

// Effective weights: E1=0.9, E2=0.8, E3=0.75x0.8=0.6, E4=0.5, E5=0.4.
const EVIDENCE = [
  { evidenceId: "E1", weight: 0.9, marks: { H1: "consistent", H2: "consistent", H3: "strongly_inconsistent" } },
  { evidenceId: "E2", weight: 0.8, marks: { H1: "consistent", H2: "neutral", H3: "inconsistent" } },
  { evidenceId: "E3", credibility: 0.75, relevance: 0.8, marks: { H1: "inconsistent", H2: "consistent", H3: "neutral" } },
  { evidenceId: "E4", weight: 0.5, marks: { H1: "consistent", H2: "inconsistent", H3: "strongly_consistent" } },
  { evidenceId: "E5", weight: 0.4, marks: { H1: "neutral", H2: "not_applicable", H3: "neutral" } },
];

describe("ach.js — ported scoring algorithm (parity with upstream ach.py selftest)", () => {
  it("computes weighted inconsistency totals matching the upstream worked example", () => {
    const totals = inconsistencyTotals(HYPOTHESES, EVIDENCE);
    expect(totals.H1.weighted).toBeCloseTo(0.6);
    expect(totals.H2.weighted).toBeCloseTo(0.5);
    expect(totals.H3.weighted).toBeCloseTo(2.6);
    expect(totals.H1.raw).toBe(1);
    expect(totals.H2.raw).toBe(1);
    expect(totals.H3.raw).toBe(3);
  });

  it("ranks H2 (fewest weighted inconsistencies) as the leader, then H1, then H3", () => {
    const totals = inconsistencyTotals(HYPOTHESES, EVIDENCE);
    const ranked = rankHypotheses(HYPOTHESES, totals).map((h) => h.id);
    expect(ranked).toEqual(["H2", "H1", "H3"]);
  });

  it("computes diagnosticity spreads matching the upstream worked example", () => {
    const hypIds = HYPOTHESES.map((h) => h.id);
    const spreads = EVIDENCE.map((row) => markSpread(row, hypIds));
    expect(spreads).toEqual([3, 2, 2, 3, 0]);
  });

  it("flags E5 as non-diagnostic (uniform neutral over applicable cells)", () => {
    const hypIds = HYPOTHESES.map((h) => h.id);
    const flag = diagnosticityFlag(EVIDENCE[4], hypIds);
    expect(flag).toMatch(/neutral/i);
  });

  it("identifies E1 and E4 as the most diagnostic evidence (spread 3)", () => {
    const hypIds = HYPOTHESES.map((h) => h.id);
    const { evidenceIds, spread } = mostDiagnostic(EVIDENCE, hypIds);
    expect(evidenceIds.sort()).toEqual(["E1", "E4"]);
    expect(spread).toBe(3);
  });

  it("excludes not_applicable from spread: {inconsistent, not_applicable, strongly_inconsistent} -> spread 1, not 2", () => {
    const row = { marks: { H1: "inconsistent", H2: "not_applicable", H3: "strongly_inconsistent" } };
    expect(markSpread(row, ["H1", "H2", "H3"])).toBe(1);
  });

  it("scoreAch bundles ranking + diagnosticity consistently with the individual functions", () => {
    const result = scoreAch(HYPOTHESES, EVIDENCE);
    expect(result.ranking[0].hypothesisId).toBe("H2");
    expect(result.ranking.map((r) => r.hypothesisId)).toEqual(["H2", "H1", "H3"]);
    expect(result.mostDiagnosticEvidenceIds.sort()).toEqual(["E1", "E4"]);
    expect(result.mostDiagnosticSpread).toBe(3);
  });

  it("a hypothesis with more confirming marks can still lose to one with fewer, more serious inconsistencies", () => {
    // H3 has one strongly_consistent (E4) and several consistent-ish/neutral
    // marks but ALSO a strongly_inconsistent (E1) and an inconsistent (E2) —
    // ACH must not let the confirmations outweigh the disconfirmations.
    const totals = inconsistencyTotals(HYPOTHESES, EVIDENCE);
    expect(totals.H3.weighted).toBeGreaterThan(totals.H2.weighted);
    const ranked = rankHypotheses(HYPOTHESES, totals);
    expect(ranked[0].id).not.toBe("H3");
  });

  describe("sensitivityAnalysis (new: implements Heuer step 6 in code)", () => {
    it("identifies E3 as pivotal — removing it flips the leader from H2 to H1", () => {
      // Without E3 (the only inconsistent mark against H1), H1's weighted
      // inconsistency drops to 0 while H2's stays 0.5 — the ranking flips.
      const result = sensitivityAnalysis(HYPOTHESES, EVIDENCE);
      expect(result.currentLeaderId).toBe("H2");
      expect(result.pivotalEvidenceIds).toContain("E3");
      const flip = result.flips.find((f) => f.evidenceId === "E3");
      expect(flip.newLeaderId).toBe("H1");
    });

    it("does not flag non-pivotal evidence (e.g. E5, which has no inconsistency marks at all)", () => {
      const result = sensitivityAnalysis(HYPOTHESES, EVIDENCE);
      expect(result.pivotalEvidenceIds).not.toContain("E5");
    });

    it("reports no pivotal evidence when the leader's margin is not evidence-dependent", () => {
      const hyps = [{ id: "H1", label: "A" }, { id: "H2", label: "B" }];
      const evidence = [
        { evidenceId: "E1", marks: { H1: "consistent", H2: "strongly_inconsistent" } },
        { evidenceId: "E2", marks: { H1: "consistent", H2: "strongly_inconsistent" } },
      ];
      // Two independent strongly_inconsistent marks against H2 — removing
      // either one alone still leaves H2 behind H1.
      const result = sensitivityAnalysis(hyps, evidence);
      expect(result.currentLeaderId).toBe("H1");
      expect(result.pivotalEvidenceIds).toEqual([]);
    });
  });
});
