import { createHash } from "node:crypto";

// 20,000 was tight for a real pasted organization policy document (the
// investigation-process policy alone can run 15-16K characters) plus the
// other discipline-matrix fields (standard of proof, action matrix,
// precedent, CBA rules, etc.) sharing the same budget. This is the single
// canonical limit — the route's request-size validation must use this same
// constant rather than a second hardcoded number that can drift out of sync.
export const MAX_ORG_CONTEXT_LENGTH = 40_000;

export function normalizeOrganizationContext(value) {
  return typeof value === "string" ? value.trim().slice(0, MAX_ORG_CONTEXT_LENGTH) : "";
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
  const sourceLabelById = new Map(evidenceItems.map((item) => [item.id, item.sourceLabel]));
  const findings = (classification.findings || []).map((finding, index) => {
    const supportingEvidenceIds = (finding.supportingEvidenceIds || []).filter((id) => validEvidenceIds.has(id));
    const contradictingEvidenceIds = (finding.contradictingEvidenceIds || []).filter((id) => validEvidenceIds.has(id));

    // "Corroborated" requires two independent SOURCES, not merely two cited
    // evidence IDs. Two excerpts that both happen to carry the same
    // sourceLabel (e.g. two lines from the same person's own statement) are
    // still a single source and must not silently read as corroborated.
    const distinctSupportingSources = new Set(supportingEvidenceIds.map((id) => sourceLabelById.get(id)));

    let evidenceStatus;
    if (supportingEvidenceIds.length === 0 && contradictingEvidenceIds.length === 0) evidenceStatus = "insufficient";
    else if (contradictingEvidenceIds.length > 0) evidenceStatus = "contradicted";
    else if (distinctSupportingSources.size >= 2) evidenceStatus = "corroborated";
    else evidenceStatus = "single_source";

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

  // A sufficiency check's "satisfied" status is only as good as the evidence
  // it was based on. If hydration just invalidated every piece of evidence a
  // check cited, the check must not keep silently reading as satisfied — it
  // gets deterministically reopened as material/resolvable so the closure
  // gate (which reads only these checks) actually notices.
  const sufficiencyChecks = (classification.sufficiencyChecks || []).map((check) => {
    const citedIds = check.evidenceIds || [];
    const evidenceIds = citedIds.filter((id) => validEvidenceIds.has(id));
    const lostAllCitedEvidence = citedIds.length > 0 && evidenceIds.length === 0;

    if (check.status === "satisfied" && lostAllCitedEvidence) {
      return {
        ...check,
        evidenceIds,
        status: "unresolved",
        material: true,
        resolvable: true,
        rationale: `${check.rationale} (Reopened: the evidence this check relied on failed validation and no longer supports it.)`,
      };
    }
    return { ...check, evidenceIds };
  });

  const hydrated = { ...classification, evidenceItems, findings, hypotheses, disciplineFactors, sufficiencyChecks };
  return { ...hydrated, closureAssessment: deriveClosureAssessment(hydrated) };
}

// Report statements must stand on findings that actually survived
// validation. Strips any investigationFindings entry whose supportingFindingIds
// contains no id from the hydrated classification's findings — the same
// "strip, don't repair" posture as evidence citations above, applied one
// level up so an unsupported report sentence never reaches the reader.
export function groundReportFindings(investigationFindings, classification) {
  const validFindingIds = new Set((classification.findings || []).map((finding) => finding.id));
  return (investigationFindings || [])
    .filter((item) => item.statement && (item.supportingFindingIds || []).some((id) => validFindingIds.has(id)))
    .map((item) => item.statement);
}
