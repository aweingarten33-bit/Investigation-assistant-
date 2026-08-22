import { createHash } from "node:crypto";

export function normalizeOrganizationContext(value) {
  return typeof value === "string" ? value.trim().slice(0, 20_000) : "";
}

export function splitReportLines(reportText) {
  return reportText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

export function numberReportLines(reportText) {
  return splitReportLines(reportText)
    .map((line, index) => `[L${String(index + 1).padStart(4, "0")}] ${line}`)
    .join("\n");
}

export function buildInputHash(reportText, organizationContext = "") {
  return createHash("sha256")
    .update(reportText)
    .update("\n---ORGANIZATION-CONTEXT---\n")
    .update(normalizeOrganizationContext(organizationContext))
    .digest("hex");
}

function isValidEvidenceRange(item, maxLine) {
  if (!item || typeof item.id !== "string" || !item.id.trim()) return false;
  const start = Number(item.lineStart);
  const end = Number(item.lineEnd);
  return Number.isInteger(start)
    && Number.isInteger(end)
    && start >= 1
    && end >= start
    && end <= maxLine;
}

function normalizeLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function verifiedSourceLabel(lines, item, start, end) {
  const claimed = String(item.sourceLabel || "").trim().slice(0, 120);
  const normalizedClaim = normalizeLabel(claimed);
  if (!normalizedClaim || normalizedClaim === "investigation notes" || normalizedClaim === "notes") {
    return "Investigation Notes";
  }

  // Source headings are normally immediately above a quoted passage. Search a
  // small local window only; a matching heading 100 lines away should not make
  // this excerpt look like it came from that source.
  const windowStart = Math.max(0, start - 7);
  const windowEnd = Math.min(lines.length, end + 2);
  const nearby = lines.slice(windowStart, windowEnd);
  const verified = nearby.some((line) => {
    const normalizedLine = normalizeLabel(line);
    if (!normalizedLine) return false;
    return normalizedLine.includes(normalizedClaim) || normalizedClaim.includes(normalizedLine);
  });

  return verified ? claimed : "Investigation Notes";
}

export function deriveClosureAssessment(classification) {
  const checks = Array.isArray(classification.sufficiencyChecks) ? classification.sufficiencyChecks : [];
  const unresolvedMaterial = checks.filter((check) => check.material && check.status === "unresolved");
  const actionable = unresolvedMaterial.filter((check) => check.resolvable);

  let status;
  if (actionable.length > 0) {
    status = "not_ready_to_close";
  } else if (unresolvedMaterial.length > 0) {
    status = "ready_with_unresolved_limitations";
  } else {
    status = "ready_to_close";
  }

  // A NEEDS_MORE_INFO classification cannot be silently labelled ready when
  // the model failed to identify the corresponding sufficiency problem. If
  // the outstanding issue is explicitly unresolvable, the limitations state
  // above is still allowed so an inconclusive case can eventually be closed.
  if (classification.decision === "needs_more_info" && status === "ready_to_close") {
    status = "not_ready_to_close";
  }

  const unresolvedMaterialIssues = unresolvedMaterial.map((check) => {
    const action = check.nextAction ? ` Next action: ${check.nextAction}` : "";
    return `${check.rationale}${action}`.trim();
  });

  const baseRationale = String(classification.closureRationale || "").trim();
  let fallbackRationale = "The available evidence is sufficient to document a defensible conclusion, subject to human review.";
  if (status === "not_ready_to_close") {
    fallbackRationale = "At least one material, still-investigable issue remains unresolved and could change the finding.";
  } else if (status === "ready_with_unresolved_limitations") {
    fallbackRationale = "Material uncertainty remains, but the outstanding issue is not reasonably resolvable with available investigative steps; close only with the limitation documented.";
  }

  return {
    status,
    rationale: baseRationale || fallbackRationale,
    unresolvedMaterialIssues,
    whatWouldChangeConclusion: Array.isArray(classification.whatWouldChangeConclusion)
      ? classification.whatWouldChangeConclusion
      : [],
  };
}

export function hydrateEvidenceTraceability(classification, reportText) {
  const lines = splitReportLines(reportText);
  const maxLine = lines.length;
  const seenIds = new Set();

  // Never "repair" an AI citation by clamping an impossible line number to a
  // real line. An out-of-range citation is discarded so the dependent finding
  // becomes unsupported/insufficient instead of appearing verified.
  const evidenceItems = (classification.evidenceItems || [])
    .filter((item) => {
      if (!isValidEvidenceRange(item, maxLine)) return false;
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    })
    .map((item) => {
      const start = Number(item.lineStart);
      const end = Number(item.lineEnd);
      const sourceLabel = verifiedSourceLabel(lines, item, start, end);
      const excerpt = lines.slice(start - 1, end).join("\n").trim();
      return {
        ...item,
        lineStart: start,
        lineEnd: end,
        sourceLabel,
        reference: `${sourceLabel} — line${start === end ? "" : "s"} ${start}${start === end ? "" : `–${end}`}`,
        excerpt,
      };
    });

  const validEvidenceIds = new Set(evidenceItems.map((item) => item.id));
  const findings = (classification.findings || []).map((finding, index) => {
    const supportingEvidenceIds = (finding.supportingEvidenceIds || []).filter((id) => validEvidenceIds.has(id));
    const contradictingEvidenceIds = (finding.contradictingEvidenceIds || []).filter((id) => validEvidenceIds.has(id));

    let evidenceStatus = finding.evidenceStatus;
    if (supportingEvidenceIds.length === 0 && contradictingEvidenceIds.length === 0) evidenceStatus = "insufficient";
    else if (supportingEvidenceIds.length === 0 && contradictingEvidenceIds.length > 0) evidenceStatus = "contradicted";
    else if (supportingEvidenceIds.length >= 2 && contradictingEvidenceIds.length === 0) evidenceStatus = "corroborated";
    else if (supportingEvidenceIds.length > 0 && contradictingEvidenceIds.length > 0) evidenceStatus = "contradicted";
    else if (supportingEvidenceIds.length === 1 && contradictingEvidenceIds.length === 0) evidenceStatus = "single_source";

    return {
      ...finding,
      id: finding.id || `F${index + 1}`,
      supportingEvidenceIds,
      contradictingEvidenceIds,
      evidenceStatus,
    };
  });

  const seenHypothesisIds = new Set();
  const hypotheses = (classification.hypotheses || []).map((hypothesis, index) => {
    const supportingEvidenceIds = (hypothesis.supportingEvidenceIds || []).filter((id) => validEvidenceIds.has(id));
    const contradictingEvidenceIds = (hypothesis.contradictingEvidenceIds || []).filter((id) => validEvidenceIds.has(id));

    // Re-derive state from the evidence that actually survived validation —
    // never leave a hypothesis labeled "contradicted"/"weakened" once the
    // evidence backing that label was stripped as invalid, and never leave
    // it labeled with no evidence on either side.
    let state = hypothesis.state;
    if (supportingEvidenceIds.length === 0 && contradictingEvidenceIds.length === 0) {
      state = "unresolved";
    } else if (supportingEvidenceIds.length === 0 && contradictingEvidenceIds.length > 0) {
      state = "contradicted";
    } else if (contradictingEvidenceIds.length === 0 && (state === "contradicted" || state === "weakened")) {
      state = "supported";
    }

    let id = hypothesis.id || `H${index + 1}`;
    if (seenHypothesisIds.has(id)) id = `${id}-${index + 1}`;
    seenHypothesisIds.add(id);

    return {
      ...hypothesis,
      id,
      supportingEvidenceIds,
      contradictingEvidenceIds,
      state,
    };
  });

  const disciplineFactors = (classification.disciplineFactors || []).map((factor) => ({
    ...factor,
    evidenceIds: (factor.evidenceIds || []).filter((id) => validEvidenceIds.has(id)),
  }));

  const hydrated = { ...classification, evidenceItems, findings, hypotheses, disciplineFactors };
  return { ...hydrated, closureAssessment: deriveClosureAssessment(hydrated) };
}