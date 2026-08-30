// Adapted from radarist/structured-analytic-skills, skills/key-assumptions-
// check/SKILL.md (MIT License — see THIRD_PARTY_NOTICES.md at the repo
// root). That skill ships no companion script (it is a prompting technique,
// not an arithmetic one); the one piece of it that IS a small deterministic
// rule — the grounding x sensitivity grid that sorts a challenged premise
// into a category — is ported here as code, so an assumption's category is
// computed, not asserted by the model. The three source categories
// (basically solid / correct with some caveats / unsupported or
// questionable) are Heuer & Pherson's (Structured Analytic Techniques,
// 2014/2019 ch. 7); the "unsupported or questionable" bucket is what the
// U.S. Government Tradecraft Primer (2009) calls a key uncertainty.
//
// Method: U.S. Government, A Tradecraft Primer: Structured Analytic
// Techniques for Improving Intelligence Analysis, 2009, pp. 7-9. R. J.
// Heuer Jr. & R. H. Pherson, Structured Analytic Techniques for
// Intelligence Analysis, 3rd ed., CQ Press/SAGE, 2019, ch. 7.

export const ASSUMPTION_GROUNDING = ["weak", "partial", "strong"];
export const ASSUMPTION_SENSITIVITY = ["low", "medium", "high"];

export const ASSUMPTION_CATEGORIES = [
  "basically_solid",
  "correct_with_caveats",
  "unsupported_questionable", // = key uncertainty
  "deprioritize",
];

// | Grounding x sensitivity      | Category                |
// | ----------------------------- | ------------------------ |
// | Evidence-backed (strong)      | basically_solid          |
// | Partly supported / scope-limited | correct_with_caveats  |
// | Weak AND high sensitivity     | unsupported_questionable |
// | Weak, low/medium sensitivity  | deprioritize              |
export function categorizeAssumption(grounding, sensitivity) {
  if (grounding === "strong") return "basically_solid";
  if (grounding === "partial") return "correct_with_caveats";
  if (grounding === "weak" && sensitivity === "high") return "unsupported_questionable";
  return "deprioritize";
}

// A key uncertainty (unsupported_questionable) is only a real investigative
// gap if it can plausibly be closed — otherwise it is a limitation to
// document, not an action to recommend. "bound" and "flag" mean the
// premise itself was judged unresolvable within reach; "re-source" and
// "test" are open work.
export function isResolvableAssumptionGap(assumption) {
  return assumption.category === "unsupported_questionable"
    && (assumption.disposition === "re-source" || assumption.disposition === "test");
}
