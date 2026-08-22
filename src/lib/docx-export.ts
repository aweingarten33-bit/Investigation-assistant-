import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  BorderStyle,
  SectionType,
} from "docx";
import { saveAs } from "file-saver";
import { AnalysisResult } from "./types";

export async function exportToDocx(result: AnalysisResult) {
  const decisionLabel = result.decision === "needs_more_info" ? "NEEDS MORE INFO" : result.decision.toUpperCase();
  const decisionColor = result.decision === "substantiated" ? "DC2626" : result.decision === "unsubstantiated" ? "16A34A" : "D97706";
  const children: Paragraph[] = [];

  children.push(new Paragraph({ children: [new TextRun({ text: "Compliance Investigation Report", bold: true, size: 36, color: "2563EB", font: "Arial" })], spacing: { after: 100 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Case: ${result.caseId}`, size: 22, color: "646464", font: "Arial" })], spacing: { after: 50 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Generated: ${result.analysisMetadata ? new Date(result.analysisMetadata.generatedAt).toLocaleString() : new Date().toLocaleString()}`, size: 22, color: "646464", font: "Arial" })], spacing: { after: 50 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: `AI decision support: ${decisionLabel}  |  Risk: ${result.riskLevel.toUpperCase()}  |  Confidence: ${result.confidenceScore}%`, size: 22, color: "646464", font: "Arial" })], spacing: { after: 200 } }));
  children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" } }, spacing: { after: 200 } }));

  if (result.analysisMetadata) {
    children.push(heading("CASE PROVENANCE / ANALYSIS VERSION"));
    children.push(paragraph(`Analysis version: ${result.analysisMetadata.analysisVersion}`));
    children.push(paragraph(`Source fingerprint: ${result.analysisMetadata.sourceFingerprint}`));
    children.push(paragraph(`Evidence items mapped: ${result.analysisMetadata.evidenceCount}; decision-support findings: ${result.analysisMetadata.findingCount}`));
    children.push(paragraph(`Organization-specific discipline matrix applied: ${result.analysisMetadata.organizationContextApplied ? "Yes" : "No"}`));
    children.push(paragraph(`Regulatory research topic: ${result.analysisMetadata.researchTopic || "None / unavailable"}`));
    children.push(paragraph("This provenance record belongs to the current analysis/export. The demo does not persist an immutable authenticated audit log across sessions."));
    children.push(spacer());
  }

  if (result.humanReview) {
    children.push(heading("HUMAN REVIEW — FINAL RECORDED DISPOSITION"));
    children.push(paragraph(`Reviewer: ${result.humanReview.reviewerName} (${result.humanReview.reviewerRole})`));
    children.push(paragraph(`Review status: ${result.humanReview.status.replace(/_/g, " ")}`));
    children.push(paragraph(`Final human finding: ${result.humanReview.finalFinding}`));
    children.push(paragraph(`Final action / disposition: ${result.humanReview.finalAction}`));
    children.push(paragraph(`Human rationale: ${result.humanReview.rationale}`));
    children.push(paragraph(`Reviewed at: ${new Date(result.humanReview.reviewedAt).toLocaleString()}`));
    children.push(spacer());
  } else {
    children.push(heading("HUMAN REVIEW STATUS"));
    children.push(paragraph("No final human review record was saved before export. The AI analysis and corrective-action range below are decision support only and must not be treated as an authorized employment decision."));
    children.push(spacer());
  }

  children.push(heading("AI DECISION SUPPORT"));
  children.push(new Paragraph({ children: [new TextRun({ text: decisionLabel, bold: true, size: 32, color: decisionColor, font: "Arial" })], spacing: { after: 100 } }));
  children.push(paragraph(`Corrective-action range: ${result.disciplineRange.minimum} to ${result.disciplineRange.maximum}`));
  children.push(paragraph(`Recommended for human review: ${result.disciplineRange.recommended}`));
  children.push(paragraph(result.disciplineRange.rationale));
  if (result.disciplineRange.policyDependent) children.push(paragraph("Final action is policy-dependent and requires review of organization-specific policy, precedent, prior history, and/or CBA/union requirements."));

  if (result.policyQuestions.length > 0) {
    children.push(heading("ORGANIZATION-SPECIFIC QUESTIONS BEFORE FINAL ACTION"));
    result.policyQuestions.forEach((item) => children.push(bullet(item)));
    children.push(spacer());
  }

  if (result.missingInfo && result.missingInfo.length > 0) {
    children.push(heading("MISSING INFORMATION"));
    result.missingInfo.forEach((item) => children.push(bullet(item)));
    children.push(spacer());
  }

  children.push(heading("I. INTRODUCTION"));
  children.push(paragraph(result.introduction));
  children.push(heading("II. INCIDENT OVERVIEW"));
  children.push(paragraph(result.incidentOverview));
  children.push(heading("III. INCIDENT DETAILS"));
  children.push(paragraph(result.incidentDetails));
  children.push(heading("IV. INVESTIGATION FINDINGS"));
  result.investigationFindings.forEach((finding) => children.push(bullet(finding)));
  children.push(spacer());

  if (result.findings.length > 0) {
    children.push(heading("EVIDENCE TRACEABILITY APPENDIX"));
    children.push(paragraph("The following decision-support findings are linked to exact source lines reconstructed by the application from the submitted investigation notes. Contradictory evidence is retained rather than omitted."));
    const evidenceById = new Map(result.evidenceItems.map((item) => [item.id, item]));

    result.findings.forEach((finding) => {
      children.push(subheading(`${finding.id} — ${finding.statement}`));
      children.push(paragraph(`Evidence status: ${finding.evidenceStatus.replace(/_/g, " ")}`));
      if (finding.inference) children.push(paragraph(`AI inference: ${finding.inference}`));

      if (finding.supportingEvidenceIds.length > 0) {
        children.push(paragraph("Supporting evidence:"));
        finding.supportingEvidenceIds.forEach((id) => {
          const evidence = evidenceById.get(id);
          if (evidence) {
            children.push(bullet(`${evidence.id} — ${evidence.reference}: ${evidence.summary}`));
            if (evidence.excerpt) children.push(quoteParagraph(evidence.excerpt));
          }
        });
      }

      if (finding.contradictingEvidenceIds.length > 0) {
        children.push(paragraph("Contradicting evidence:"));
        finding.contradictingEvidenceIds.forEach((id) => {
          const evidence = evidenceById.get(id);
          if (evidence) {
            children.push(bullet(`${evidence.id} — ${evidence.reference}: ${evidence.summary}`));
            if (evidence.excerpt) children.push(quoteParagraph(evidence.excerpt));
          }
        });
      }
      children.push(spacer());
    });

    const evidenceIdsInFindings = new Set(
      result.findings.flatMap((finding) => [...finding.supportingEvidenceIds, ...finding.contradictingEvidenceIds]),
    );
    const unlinkedEvidence = result.evidenceItems.filter((item) => !evidenceIdsInFindings.has(item.id));
    if (unlinkedEvidence.length > 0) {
      children.push(subheading("Other cited evidence (not tied to a specific finding)"));
      children.push(paragraph("Context or policy excerpts weighed only in the corrective-action factors below."));
      unlinkedEvidence.forEach((evidence) => {
        children.push(bullet(`${evidence.id} — ${evidence.reference}: ${evidence.summary}`));
        if (evidence.excerpt) children.push(quoteParagraph(evidence.excerpt));
      });
      children.push(spacer());
    }
  }

  if (result.disciplineFactors.length > 0) {
    children.push(heading("FACTORS WEIGHED FOR CORRECTIVE-ACTION RANGE"));
    result.disciplineFactors.forEach((factor) => children.push(bullet(`${factor.factor.replace(/_/g, " ")} [${factor.impact}]: ${factor.assessment}`)));
    children.push(spacer());
  }

  children.push(heading("V. RECOMMENDATIONS / DECISION SUPPORT"));
  children.push(paragraph(result.recommendations));

  if (result.regulationsCited.length > 0) {
    children.push(heading("REGULATIONS CITED"));
    result.regulationsCited.forEach((reg) => children.push(bullet(reg)));
    children.push(paragraph("Verify cited provisions and their applicability before official use."));
    children.push(spacer());
  }

  children.push(heading("VI. CONCLUSION"));
  children.push(paragraph(result.conclusion));
  children.push(spacer());
  children.push(new Paragraph({ children: [new TextRun({ text: "Confidential – Internal Use Only", size: 16, color: "999999", font: "Arial", italics: true })], spacing: { after: 50 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: "Demo version – use anonymized data only. Production deployment requires appropriate privacy/security review, agreements, access controls, persistent authenticated audit logging, and secure hosting.", size: 16, color: "999999", font: "Arial", italics: true })] }));

  const doc = new Document({
    sections: [{ properties: { type: SectionType.CONTINUOUS, page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }],
  });

  const blob = await Packer.toBlob(doc);
  const dateStr = new Date().toISOString().split("T")[0];
  saveAs(blob, `Compliance_Report_${result.caseId}_${dateStr}.docx`);
}

function heading(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, bold: true, size: 26, color: "1E1E1E", font: "Arial" })], spacing: { before: 200, after: 100 } });
}

function subheading(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, bold: true, size: 22, color: "323232", font: "Arial" })], spacing: { before: 120, after: 60 } });
}

function paragraph(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, size: 20, color: "323232", font: "Arial" })], spacing: { after: 150 } });
}

function bullet(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: `•  ${text}`, size: 20, color: "323232", font: "Arial" })], indent: { left: 360 }, spacing: { after: 80 } });
}

function quoteParagraph(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, size: 18, color: "555555", font: "Arial", italics: true })], indent: { left: 720 }, spacing: { after: 100 } });
}

function spacer(): Paragraph {
  return new Paragraph({ spacing: { after: 100 } });
}
