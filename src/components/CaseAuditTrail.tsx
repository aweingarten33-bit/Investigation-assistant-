import { Clock3, Fingerprint, History, ShieldCheck } from "lucide-react";
import type { AnalysisResult } from "@/lib/types";

export function CaseAuditTrail({ result }: { result: AnalysisResult }) {
  const metadata = result.analysisMetadata;
  const review = result.humanReview;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/20">
        <div className="flex items-start gap-2.5">
          <History className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Case Provenance & Review Trail</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Shows provenance for the current analysis/export. This demo does not persist an immutable enterprise audit log; production should store versioned events server-side with authenticated users and timestamps.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3 text-xs">
        {metadata ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Analysis version</p>
              <p className="font-medium text-foreground mt-1">{metadata.analysisVersion}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Generated</p>
              <p className="font-medium text-foreground mt-1">{new Date(metadata.generatedAt).toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-border p-3 sm:col-span-2">
              <div className="flex items-center gap-1.5"><Fingerprint className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Source fingerprint</p></div>
              <p className="font-mono text-[10px] break-all text-foreground mt-1">{metadata.sourceFingerprint}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Changes to the submitted notes or organization context produce a different fingerprint and force re-classification.</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Evidence / findings</p>
              <p className="font-medium text-foreground mt-1">{metadata.evidenceCount} evidence item{metadata.evidenceCount === 1 ? "" : "s"} · {metadata.findingCount} finding{metadata.findingCount === 1 ? "" : "s"}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Decision context</p>
              <p className="font-medium text-foreground mt-1">Organization matrix: {metadata.organizationContextApplied ? "Applied" : "Not provided"}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Regulatory research topic: {metadata.researchTopic || "None / unavailable"}</p>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">No analysis provenance metadata is available for this result.</p>
        )}

        <div className={`rounded-lg border p-3 ${review ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            {review ? <ShieldCheck className="h-3.5 w-3.5 text-success" /> : <Clock3 className="h-3.5 w-3.5 text-warning" />}
            <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Human review event</p>
          </div>
          {review ? (
            <div className="space-y-1">
              <p className="font-medium text-foreground">{review.status.replace(/_/g, " ")} — {review.reviewerName} ({review.reviewerRole})</p>
              <p className="text-[11px] text-muted-foreground">Final finding: {review.finalFinding}</p>
              <p className="text-[11px] text-muted-foreground">Final action: {review.finalAction}</p>
              <p className="text-[10px] text-muted-foreground">Recorded {new Date(review.reviewedAt).toLocaleString()}</p>
            </div>
          ) : (
            <p className="text-[11px] text-foreground">No final human review has been recorded. The AI output remains decision support only.</p>
          )}
        </div>
      </div>
    </div>
  );
}
