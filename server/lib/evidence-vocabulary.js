// Shared evidence-type vocabulary. Extracted so the LangGraph ACH path
// (server/graph/schemas.js) does not depend on the legacy /api/analyze-report
// route module merely for a constant. This is a plain data enum, not
// reasoning logic — it carries no coupling to the old sufficiency-check
// brain either path uses.
export const EVIDENCE_TYPES = ["document", "interview", "audit", "system_record", "policy", "other"];
