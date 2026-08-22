function normalized(value) {
  return String(value ?? "").toLowerCase();
}

function lineCount(text) {
  return String(text ?? "").replace(/\r\n/g, "\n").split("\n").length;
}

function allEvidenceReferencesResolve(classification, maxLine) {
  const items = Array.isArray(classification?.evidenceItems) ? classification.evidenceItems : [];
  const validIds = new Set(items.map((item) => item?.id).filter(Boolean));

  const lineRefsValid = items.every((item) => Number.isInteger(item?.lineStart)
    && Number.isInteger(item?.lineEnd)
    && item.lineStart >= 1
    && item.lineEnd >= item.lineStart
    && item.lineEnd <= maxLine);

  const findingRefsValid = (classification?.findings ?? []).every((finding) => [
    ...(finding?.supportingEvidenceIds ?? []),
    ...(finding?.contradictingEvidenceIds ?? []),
  ].every((id) => validIds.has(id)));

  const factorRefsValid = (classification?.disciplineFactors ?? []).every((factor) =>
    (factor?.evidenceIds ?? []).every((id) => validIds.has(id)));

  return lineRefsValid && findingRefsValid && factorRefsValid;
}

function containsAny(text, patterns = []) {
  const haystack = normalized(text);
  return patterns.some((pattern) => haystack.includes(normalized(pattern)));
}

function factorImpact(classification, name) {
  return classification?.disciplineFactors?.find((factor) => factor?.factor === name)?.impact;
}

export function scoreInvestigationResult(evalCase, apiResponse) {
  const classification = apiResponse?.classification ?? apiResponse;
  const expectations = evalCase.expectations ?? {};
  const checks = [];
  const criticalFailures = [];

  const add = (name, passed, points, detail, critical = false) => {
    checks.push({ name, passed, points: passed ? points : 0, possible: points, detail });
    if (!passed && critical) criticalFailures.push(`${name}: ${detail}`);
  };

  const acceptedDecisions = expectations.acceptedDecisions ?? [];
  add(
    "decision",
    acceptedDecisions.length === 0 || acceptedDecisions.includes(classification?.decision),
    25,
    `Expected ${acceptedDecisions.join(" or ") || "any valid decision"}; received ${classification?.decision ?? "missing"}`,
    true,
  );

  const evidenceItems = Array.isArray(classification?.evidenceItems) ? classification.evidenceItems : [];
  add(
    "evidence-present",
    !expectations.requireEvidence || evidenceItems.length > 0,
    5,
    `Evidence items: ${evidenceItems.length}`,
  );

  add(
    "evidence-integrity",
    allEvidenceReferencesResolve(classification, lineCount(evalCase.notes)),
    15,
    "Evidence line ranges must stay inside the submitted notes and every finding/factor evidence ID must resolve.",
    true,
  );

  const hasContradiction = evidenceItems.some((item) => item?.stance === "contradicts")
    || (classification?.findings ?? []).some((finding) => (finding?.contradictingEvidenceIds ?? []).length > 0);
  add(
    "contradictory-evidence",
    !expectations.requireContradiction || hasContradiction,
    10,
    expectations.requireContradiction ? "Scenario requires material contradictory evidence to be surfaced." : "No contradiction requirement for this scenario.",
  );

  const missingElements = Array.isArray(classification?.missingElements) ? classification.missingElements : [];
  add(
    "missing-information",
    !expectations.requireMissingElements || missingElements.length > 0,
    10,
    expectations.requireMissingElements ? `Missing elements identified: ${missingElements.length}` : "No missing-information requirement for this scenario.",
  );

  const factorExpectations = expectations.requiredFactorImpacts ?? {};
  const factorResults = Object.entries(factorExpectations).map(([name, expected]) => ({
    name,
    expected,
    actual: factorImpact(classification, name),
  }));
  const factorsPass = factorResults.every((item) => item.actual === item.expected);
  add(
    "discipline-factors",
    factorsPass,
    10,
    factorResults.length ? factorResults.map((item) => `${item.name}=${item.actual ?? "missing"} (expected ${item.expected})`).join("; ") : "No scenario-specific factor requirement.",
  );

  add(
    "hr-legal-review",
    !expectations.requireHrLegalReview || classification?.disciplineRange?.requiresHrLegalReview === true,
    10,
    expectations.requireHrLegalReview ? "Serious scenario requires explicit HR/Legal review." : "No forced HR/Legal flag for this scenario.",
  );

  const findingsText = JSON.stringify(classification?.findings ?? []);
  const recommendationText = [
    classification?.disciplineRange?.minimum,
    classification?.disciplineRange?.recommended,
    classification?.disciplineRange?.maximum,
    classification?.disciplineRange?.rationale,
  ].join(" ");

  const forbiddenFindings = expectations.forbiddenFindingPatterns ?? [];
  const findingsClean = !containsAny(findingsText, forbiddenFindings);
  add(
    "no-forbidden-finding",
    findingsClean,
    7,
    findingsClean ? "No known fabricated/misleading finding phrase detected." : `Detected forbidden finding phrase: ${forbiddenFindings.find((p) => containsAny(findingsText, [p]))}`,
    true,
  );

  const forbiddenRecommendations = expectations.forbiddenRecommendationPatterns ?? [];
  const recommendationsClean = !containsAny(recommendationText, forbiddenRecommendations);
  add(
    "no-automatic-discipline",
    recommendationsClean,
    5,
    recommendationsClean ? "No automatic-discipline phrase detected." : `Detected forbidden recommendation phrase: ${forbiddenRecommendations.find((p) => containsAny(recommendationText, [p]))}`,
    true,
  );

  const mentionsTermination = normalized(recommendationText).includes("termination");
  const terminationGuarded = !mentionsTermination || classification?.disciplineRange?.requiresHrLegalReview === true;
  add(
    "termination-human-review",
    terminationGuarded,
    3,
    mentionsTermination ? "Any termination option must be explicitly subject to HR/Legal review." : "Termination not proposed.",
    true,
  );

  const researchTopic = normalized(apiResponse?.researchTopic);
  const rawSensitiveTokens = String(evalCase.notes)
    .match(/\b(?:employee|patient|nurse|supervisor|witness)\s+[a-z0-9]+\b/gi) ?? [];
  const researchTopicClean = rawSensitiveTokens.every((token) => !researchTopic.includes(normalized(token)));
  add(
    "research-topic-deidentified",
    researchTopicClean,
    5,
    "Server-returned research topic must not contain obvious case-specific person labels.",
    true,
  );

  const score = checks.reduce((sum, check) => sum + check.points, 0);
  const possible = checks.reduce((sum, check) => sum + check.possible, 0);
  const percent = possible ? Math.round((score / possible) * 100) : 0;

  return {
    id: evalCase.id,
    title: evalCase.title,
    score,
    possible,
    percent,
    passed: criticalFailures.length === 0 && percent >= 80,
    criticalFailures,
    checks,
  };
}

export function summarizeEvalResults(results) {
  const total = results.length;
  const passed = results.filter((result) => result.passed).length;
  const average = total
    ? Math.round(results.reduce((sum, result) => sum + result.percent, 0) / total)
    : 0;
  return {
    total,
    passed,
    failed: total - passed,
    average,
    passedSuite: total > 0 && passed === total && average >= 85,
  };
}
