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
      const sourceLabel = (item.sourceLabel || "Investigation Notes").trim().slice(0, 120) || "Investigation Notes";
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

  const disciplineFactors = (classification.disciplineFactors || []).map((factor) => ({
    ...factor,
    evidenceIds: (factor.evidenceIds || []).filter((id) => validEvidenceIds.has(id)),
  }));

  return { ...classification, evidenceItems, findings, disciplineFactors };
}
