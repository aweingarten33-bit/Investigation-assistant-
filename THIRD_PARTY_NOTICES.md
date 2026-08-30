# Third-Party Notices

This project adapts a small amount of code and reference data from
[radarist/structured-analytic-skills](https://github.com/radarist/structured-analytic-skills),
used under the MIT License.

## What was adapted

- `server/lib/ach.js` ports the scoring algorithm (weighted-inconsistency
  ranking and evidence diagnosticity) from
  `skills/analysis-of-competing-hypotheses/scripts/ach.py`, translated from
  Python to JavaScript and re-expressed in a six-value mark vocabulary
  (`strongly_consistent` / `consistent` / `neutral` / `inconsistent` /
  `strongly_inconsistent` / `not_applicable`) equivalent to upstream's
  `CC`/`C`/`N`/`I`/`II`/`NA`. `sensitivityAnalysis()` in that file is new
  code, not present upstream, built on top of the ported scoring functions.
- `server/lib/key-assumptions-check.js` adapts the grounding x sensitivity
  category grid described in `skills/key-assumptions-check/SKILL.md`.

(A prior version of this branch also adapted `rate-source-admiralty`'s
source-reliability/information-credibility label tables into
`server/lib/admiralty.js`. It was removed: the fields it added to the
evidence schema never fed any actual reasoning decision — no scoring, gap
identification, or recommendation logic read them. Carrying unused
methodology code was worse than not having it; it can come back if a real
decision starts depending on it.)

Method attribution (see each skill's `SKILL.md` for full citations):

- Analysis of Competing Hypotheses: Richards J. Heuer Jr., CIA — *Psychology
  of Intelligence Analysis*, 1999, ch. 8.
- Key Assumptions Check: U.S. Government, *A Tradecraft Primer: Structured
  Analytic Techniques for Improving Intelligence Analysis*, 2009; R. J.
  Heuer Jr. & R. H. Pherson, *Structured Analytic Techniques for
  Intelligence Analysis*, 3rd ed., 2019, ch. 7.

## License

```
MIT License

Copyright (c) 2025-2026 Claudio Babelis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
