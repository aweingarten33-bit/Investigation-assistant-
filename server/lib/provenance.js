// Provenance honesty: distinguish original evidence from the investigator's
// own summary of a record that was never supplied.
//
// The model is told to label provenance (see the classification prompt), but
// the server does not rely on that. When the notes themselves say a record
// was not supplied ("original roster not supplied, investigator summary
// only"), any evidence about that record is forced to investigator_summary,
// and text that claims the record was reviewed, confirmed something, or gave
// documentary corroboration is rewritten to say "per investigator summary".

export const PROVENANCE_TYPES = ["original_record", "investigator_summary", "statement", "other"];

const NOT_SUPPLIED_RE = /\b(?:not|never|wasn't|weren't|hasn't|haven't)\s+(?:been\s+)?(?:supplied|provided|produced|attached|included|obtained|available|reviewed|received)\b|\bunavailable\b|\bsummar(?:y|ized)\s+only\b|\bonly\s+(?:an?\s+|the\s+)?(?:investigator'?s?\s+)?summary\b|\bper\s+(?:the\s+)?investigator'?s?\s+summary\b/i;

// Words that never identify a specific record on their own.
const GENERIC_WORDS = new Set([
  "original", "originals", "copy", "copies", "record", "records", "document", "documents", "documentation",
  "file", "files", "data", "evidence", "information", "summary", "summarized", "investigator", "investigators",
  "only", "supplied", "provided", "produced", "attached", "included", "obtained", "available", "unavailable",
  "reviewed", "received", "been", "never", "were", "was", "wasn", "weren", "hasn", "haven", "have", "has", "the",
  "this", "that", "these", "those", "with", "from", "into", "for", "and", "not", "but", "per", "any", "all",
  "note", "notes", "actual", "full", "complete", "underlying", "source", "sources",
]);

export const SUMMARY_PHRASE = "per investigator summary";

function singular(word) {
  return word.length > 4 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

export function statesNotSupplied(text) {
  return NOT_SUPPLIED_RE.test(String(text || ""));
}

// Terms naming records the notes say were NOT supplied, e.g. "roster" from
// "Original roster not supplied, investigator summary only."
export function extractUnsuppliedTerms(lines) {
  const terms = new Set();
  for (const raw of lines) {
    const line = String(raw || "");
    if (!statesNotSupplied(line)) continue;
    // Only the clause that carries the "not supplied" statement.
    const clause = line.split(/[.;:]/).find((part) => statesNotSupplied(part)) || line;
    for (const word of clause.toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []) {
      const cleaned = word.replace(/'s$|'$/g, "");
      if (!GENERIC_WORDS.has(cleaned)) terms.add(singular(cleaned));
    }
  }
  return terms;
}

export function mentionsTerm(text, terms) {
  const lower = String(text || "").toLowerCase();
  for (const term of terms) {
    if (new RegExp(`\\b${term}s?\\b`).test(lower)) return term;
  }
  return null;
}

const DOCUMENTARY_TYPES = new Set(["document", "system_record", "audit"]);

// Decide an evidence item's provenance. Model labels are kept unless the notes
// contradict them; a missing/invalid label defaults to "other".
export function resolveProvenance(item, excerpt, terms) {
  const claimed = PROVENANCE_TYPES.includes(item.provenance) ? item.provenance : "other";
  const term = mentionsTerm(`${excerpt}\n${item.summary || ""}`, terms);
  const describesRecord = DOCUMENTARY_TYPES.has(item.evidenceType) || claimed === "original_record";
  if (statesNotSupplied(excerpt) || (term && describesRecord)) {
    const subject = term ? `original ${term}` : "underlying record";
    return { provenance: "investigator_summary", provenanceNote: `The ${subject} was not supplied; this is ${SUMMARY_PHRASE}.` };
  }
  return { provenance: claimed, provenanceNote: claimed === "investigator_summary" ? `This is ${SUMMARY_PHRASE}; the underlying record was not supplied.` : "" };
}

const CLAIM_VERBS = "confirm(?:ed|s)?|corroborat(?:ed|es|e)|verif(?:ied|ies|y)|substantiat(?:ed|es|e)|establish(?:ed|es)?|document(?:ed|s)?|show(?:n|s|ed)?|reflect(?:ed|s)?|prov(?:ed|es|e)";
const RECORD_NOUNS = "records?|documents?|documentation|logs?|files?|data|entr(?:y|ies)|sheets?|reports?";

// Replacement that keeps a sentence-initial capital letter.
function keepCase(replacement) {
  return (match) => (/^[A-Z]/.test(match) ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Rewrites claims that a record was reviewed or provided documentary
// corroboration. `terms` are unsupplied records; `noOriginalRecords` means no
// supporting evidence is an original record, so generic "documentary
// evidence" claims are unsupported too.
export function qualifyDocumentaryClaims(text, { terms = new Set(), noOriginalRecords = false } = {}) {
  if (typeof text !== "string" || !text) return text;
  let out = text;

  for (const term of terms) {
    const t = `${escapeRegExp(term)}s?`;
    const replacement = `the investigator's summary of the ${term} (original not supplied)`;
    out = out
      // "confirmed by (the) roster (records)" / "verified against the roster"
      .replace(new RegExp(`\\b(?:${CLAIM_VERBS})\\s+(?:by|in|against|through|from)\\s+(?:the\\s+)?(?:original\\s+)?(?:[a-z'-]+\\s+){0,2}?${t}(?:\\s+(?:${RECORD_NOUNS}))?\\b`, "gi"), keepCase(`reported in ${replacement}`))
      // "(the) roster (records) confirm/show ..."
      .replace(new RegExp(`\\b(?:the\\s+)?(?:original\\s+)?${t}(?:\\s+(?:${RECORD_NOUNS}))?\\s+(?:${CLAIM_VERBS})\\b`, "gi"), keepCase(`${replacement} states`))
      // "review(ed) of the roster" / "reviewed the roster"
      .replace(new RegExp(`\\breview(?:ed|ing)?\\s+(?:of\\s+)?(?:the\\s+)?(?:original\\s+)?${t}(?:\\s+(?:${RECORD_NOUNS}))?\\b`, "gi"), keepCase(`relied on ${replacement}`))
      // "(roster) records/documentation" used as a source
      .replace(new RegExp(`\\b${t}\\s+(?:${RECORD_NOUNS})\\b`, "gi"), keepCase(replacement));
  }

  if (noOriginalRecords) {
    out = out
      .replace(/\b(?:corroborated|confirmed|verified|supported|substantiated|established)\s+by\s+(?:the\s+)?(?:available\s+)?(?:documentary|documented)\s+(?:evidence|records?|proof)\b/gi, keepCase(SUMMARY_PHRASE))
      .replace(/\bdocumentary\s+(?:evidence|corroboration|records?|proof)\b/gi, keepCase("the investigator's summary"));
  }
  // A summary only reports; it never corroborates, confirms, or verifies.
  return out.replace(
    /\b(investigator'?s?\s+summar(?:y|ies)(?:\s+of\s+the\s+[a-z'-]+(?:\s+\(original not supplied\))?)?)\s+(?:corroborat(?:es|ed|e)|confirm(?:s|ed)?|verif(?:ies|ied|y)|substantiat(?:es|ed|e)|establish(?:es|ed)?|prov(?:es|ed|e))\b/gi,
    "$1 states",
  );
}

export function appendSummaryQualifier(statement) {
  const text = String(statement || "").trim();
  if (!text || text.toLowerCase().includes(SUMMARY_PHRASE)) return text;
  return `${text.replace(/[.\s]+$/, "")} (${SUMMARY_PHRASE}; the underlying record was not supplied).`;
}

// Which findings rest on investigator summaries, and whether any of their
// support is an original record. Used by hydration and report enforcement.
export function findingProvenance(finding, evidenceById) {
  const supporting = (finding.supportingEvidenceIds || []).map((id) => evidenceById.get(id)).filter(Boolean);
  return {
    reliesOnSummary: supporting.some((item) => item.provenance === "investigator_summary"),
    hasOriginalRecord: supporting.some((item) => item.provenance === "original_record"),
  };
}

const REPORT_TEXT_FIELDS = ["introduction", "incidentOverview", "incidentDetails", "recommendations", "conclusion"];

// Applies the same provenance rules to the written report: no claim that an
// unsupplied record was reviewed or corroborated anything, and findings that
// rest on investigator summaries say so. Runs before groundReportFindings,
// while each report finding still carries its supportingFindingIds.
export function enforceReportProvenance(report, classification, reportText) {
  const lines = String(reportText || "").replace(/\r\n?/g, "\n").split("\n");
  const terms = extractUnsuppliedTerms(lines);
  const evidenceById = new Map((classification.evidenceItems || []).map((item) => [item.id, item]));
  const findingById = new Map((classification.findings || []).map((finding) => [finding.id, finding]));
  const caseHasOriginalRecord = (classification.evidenceItems || []).some((item) => item.provenance === "original_record");
  const caseOptions = { terms, noOriginalRecords: !caseHasOriginalRecord };

  const out = { ...report };
  for (const field of REPORT_TEXT_FIELDS) out[field] = qualifyDocumentaryClaims(report[field], caseOptions);
  if (Array.isArray(report.missingInfo)) out.missingInfo = report.missingInfo.map((item) => qualifyDocumentaryClaims(item, caseOptions));

  out.investigationFindings = (report.investigationFindings || []).map((item) => {
    const referenced = (item.supportingFindingIds || []).map((id) => findingById.get(id)).filter(Boolean);
    const provenance = referenced.map((finding) => findingProvenance(finding, evidenceById));
    const reliesOnSummary = provenance.some((p) => p.reliesOnSummary);
    const hasOriginalRecord = provenance.some((p) => p.hasOriginalRecord);
    let statement = qualifyDocumentaryClaims(item.statement, { terms, noOriginalRecords: !hasOriginalRecord });
    if (reliesOnSummary && !hasOriginalRecord) statement = appendSummaryQualifier(statement);
    return { ...item, statement };
  });
  return out;
}
