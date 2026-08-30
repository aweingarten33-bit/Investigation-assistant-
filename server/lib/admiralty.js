// Label data adapted from radarist/structured-analytic-skills, skills/
// rate-source-admiralty (MIT License — see THIRD_PARTY_NOTICES.md at the
// repo root), scripts/admiralty.py RELIABILITY/CREDIBILITY tables. Deliberately
// light-touch: this is reference data for two independent axes, not a
// scoring algorithm, and it stays that way here — no combined "trust
// score," no aggregation across sources, no inference about a person's
// honesty. Source reliability (track record) and information credibility
// (corroboration of this item) are kept as two separate, optional,
// model-supplied gradings; grade F / credibility 6 means "no basis to
// judge," not "false" or "unreliable person."
//
// Method: NATO STANAG 2511 / AJP-2.1, 2003; U.S. Army FM 2-22.3 (2006),
// Appendix B.

export const SOURCE_RELIABILITY_GRADES = ["A", "B", "C", "D", "E", "F"];
export const INFORMATION_CREDIBILITY_GRADES = ["1", "2", "3", "4", "5", "6"];

export const SOURCE_RELIABILITY_LABELS = {
  A: "Completely reliable",
  B: "Usually reliable",
  C: "Fairly reliable",
  D: "Not usually reliable",
  E: "Unreliable",
  F: "Reliability cannot be judged",
};

export const INFORMATION_CREDIBILITY_LABELS = {
  1: "Confirmed by other sources",
  2: "Probably true",
  3: "Possibly true",
  4: "Doubtful",
  5: "Improbable",
  6: "Truth cannot be judged",
};

// A one-sentence, display-only description of a graded evidence item —
// never a number, never combined into a single "trust" figure.
export function describeAdmiraltyGrade(sourceReliability, informationCredibility) {
  const letter = SOURCE_RELIABILITY_LABELS[sourceReliability] ? sourceReliability : "F";
  const digit = INFORMATION_CREDIBILITY_LABELS[informationCredibility] ? informationCredibility : "6";
  return `${letter}${digit} — ${SOURCE_RELIABILITY_LABELS[letter]}; ${INFORMATION_CREDIBILITY_LABELS[digit]}`;
}
