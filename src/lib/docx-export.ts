import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  SectionType,
} from "docx";
import { saveAs } from "file-saver";
import { AnalysisResult } from "./types";

export async function exportToDocx(result: AnalysisResult) {
  const decisionLabel = result.decision === "needs_more_info"
    ? "NEEDS MORE INFO"
    : result.decision.toUpperCase();

  const decisionColor = result.decision === "substantiated"
    ? "DC2626"
    : result.decision === "unsubstantiated"
    ? "16A34A"
    : "D97706";

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Compliance Investigation Report",
          bold: true,
          size: 36,
          color: "2563EB",
          font: "Arial",
        }),
      ],
      spacing: { after: 100 },
    })
  );

  // Case & date
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `Case: ${result.caseId}`, size: 22, color: "646464", font: "Arial" }),
      ],
      spacing: { after: 50 },
    })
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, size: 22, color: "646464", font: "Arial" }),
      ],
      spacing: { after: 50 },
    })
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Decision: ${decisionLabel}  |  Risk: ${result.riskLevel.toUpperCase()}  |  Confidence: ${result.confidenceScore}%`,
          size: 22,
          color: "646464",
          font: "Arial",
        }),
      ],
      spacing: { after: 200 },
    })
  );

  // Divider
  children.push(
    new Paragraph({
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      },
      spacing: { after: 200 },
    })
  );

  // Decision
  children.push(heading("DECISION"));
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: decisionLabel, bold: true, size: 32, color: decisionColor, font: "Arial" }),
      ],
      spacing: { after: 200 },
    })
  );

  // Missing info
  if (result.missingInfo && result.missingInfo.length > 0) {
    children.push(heading("MISSING INFORMATION"));
    result.missingInfo.forEach((item) => {
      children.push(bullet(item));
    });
    children.push(spacer());
  }

  // Report sections
  children.push(heading("I. INTRODUCTION"));
  children.push(paragraph(result.introduction));

  children.push(heading("II. INCIDENT OVERVIEW"));
  children.push(paragraph(result.incidentOverview));

  children.push(heading("III. INCIDENT DETAILS"));
  children.push(paragraph(result.incidentDetails));

  children.push(heading("IV. INVESTIGATION FINDINGS"));
  result.investigationFindings.forEach((finding) => {
    children.push(bullet(finding));
  });
  children.push(spacer());

  children.push(heading("V. RECOMMENDATIONS"));
  children.push(paragraph(result.recommendations));

  if (result.regulationsCited.length > 0) {
    children.push(heading("REGULATIONS CITED"));
    result.regulationsCited.forEach((reg) => {
      children.push(bullet(reg));
    });
    children.push(spacer());
  }

  children.push(heading("VI. CONCLUSION"));
  children.push(paragraph(result.conclusion));

  // Footer
  children.push(spacer());
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Confidential – Internal Use Only", size: 16, color: "999999", font: "Arial", italics: true }),
      ],
      spacing: { after: 50 },
    })
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Demo version – use fake data only. Production deployment requires HIPAA-compliant hosting.",
          size: 16,
          color: "999999",
          font: "Arial",
          italics: true,
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          type: SectionType.CONTINUOUS,
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const dateStr = new Date().toISOString().split("T")[0];
  saveAs(blob, `Compliance_Report_${result.caseId}_${dateStr}.docx`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function heading(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text, bold: true, size: 26, color: "1E1E1E", font: "Arial" }),
    ],
    spacing: { before: 200, after: 100 },
  });
}

function paragraph(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text, size: 20, color: "323232", font: "Arial" }),
    ],
    spacing: { after: 150 },
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `•  ${text}`, size: 20, color: "323232", font: "Arial" }),
    ],
    indent: { left: 360 },
    spacing: { after: 80 },
  });
}

function spacer(): Paragraph {
  return new Paragraph({ spacing: { after: 100 } });
}
