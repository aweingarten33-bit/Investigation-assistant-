import jsPDF from "jspdf";
import { AnalysisResult } from "./types";

export function exportToPdf(result: AnalysisResult) {
  const doc = new jsPDF();
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPage = (needed: number) => {
    if (y + needed > pageHeight - 25) {
      doc.addPage();
      y = margin;
    }
  };

  const addSectionHeader = (title: string) => {
    checkPage(15);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(title, margin, y);
    y += 8;
  };

  const addParagraph = (text: string) => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      checkPage(6);
      doc.text(line, margin, y);
      y += 5;
    }
    y += 4;
  };

  const addBulletList = (items: string[]) => {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    items.forEach((item) => {
      const lines = doc.splitTextToSize(`•  ${item}`, contentWidth - 5);
      for (const line of lines) {
        checkPage(6);
        doc.text(line, margin + 3, y);
        y += 5;
      }
      y += 2;
    });
    y += 3;
  };

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(37, 99, 235);
  doc.text("Compliance Investigation Report", margin, y);
  y += 8;
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Case: ${result.caseId}`, margin, y);
  y += 6;
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
  y += 6;

  // Classification line
  const decisionLabel = result.decision === "needs_more_info" ? "NEEDS MORE INFO" : result.decision.toUpperCase();
  doc.text(`Decision: ${decisionLabel}  |  Risk: ${result.riskLevel.toUpperCase()}  |  Confidence: ${result.confidenceScore}%`, margin, y);
  y += 10;

  // Divider
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Decision badge
  addSectionHeader("DECISION");
  doc.setFontSize(16);
  const decisionColor = result.decision === "substantiated" ? [220, 38, 38] :
    result.decision === "unsubstantiated" ? [22, 163, 74] : [217, 119, 6];
  doc.setTextColor(decisionColor[0], decisionColor[1], decisionColor[2]);
  doc.text(decisionLabel, margin, y);
  y += 12;

  // Missing info
  if (result.missingInfo && result.missingInfo.length > 0) {
    addSectionHeader("MISSING INFORMATION");
    addBulletList(result.missingInfo);
  }

  // Report sections
  addSectionHeader("I. INTRODUCTION");
  addParagraph(result.introduction);

  addSectionHeader("II. INCIDENT OVERVIEW");
  addParagraph(result.incidentOverview);

  addSectionHeader("III. INCIDENT DETAILS");
  addParagraph(result.incidentDetails);

  addSectionHeader("IV. INVESTIGATION FINDINGS");
  addBulletList(result.investigationFindings);

  addSectionHeader("V. RECOMMENDATIONS");
  addParagraph(result.recommendations);

  if (result.regulationsCited.length > 0) {
    addSectionHeader("REGULATIONS CITED");
    addBulletList(result.regulationsCited);
  }

  addSectionHeader("VI. CONCLUSION");
  addParagraph(result.conclusion);

  // Footer on last page
  const footerY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Confidential – Internal Use Only", margin, footerY);
  doc.text("Demo version – use fake data only. Production deployment requires HIPAA-compliant hosting.", margin, footerY + 4);

  const dateStr = new Date().toISOString().split("T")[0];
  doc.save(`Compliance_Report_${result.caseId}_${dateStr}.pdf`);
}
