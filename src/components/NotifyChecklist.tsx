import { AlertTriangle, ArrowRight, Route } from "lucide-react";
import { NOTIFICATION_CHECKLIST } from "@/lib/notify-checklist";
import { Decision } from "@/lib/types";

const LETTER_TYPE_LABEL: Record<string, string> = {
  hr_referral: "HR Referral Memo",
  reporter_update: "Reporter Update",
};

export function NotifyChecklist({ decision }: { decision: Decision }) {
  const items = decision === "substantiated"
    ? NOTIFICATION_CHECKLIST
    : NOTIFICATION_CHECKLIST.filter((item) => [
        "person_investigated",
        "reporter_complainant",
        "compliance_privacy_committee",
      ].includes(item.id));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Route className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Notification / escalation review</p>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        This is a conditional routing checklist, not a universal notification order. Apply your organization's policy, privilege strategy, labor requirements, need-to-know rules, and any verified reporting duty.
      </p>

      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-border p-3.5">
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded bg-muted text-muted-foreground flex items-center justify-center shrink-0 mt-0.5"><span className="text-[9px] font-bold">IF</span></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{item.who}</p>
              {item.onlyIf && <p className="text-[10px] text-warning font-medium mt-0.5">Consider when: {item.onlyIf}</p>}
              <p className="text-xs text-muted-foreground mt-1">{item.what}</p>
              {item.letterType && LETTER_TYPE_LABEL[item.letterType] && (
                <p className="text-[10px] text-primary mt-1 flex items-center gap-1"><ArrowRight className="w-2.5 h-2.5" />Template available: {LETTER_TYPE_LABEL[item.letterType]}</p>
              )}
            </div>
          </div>
        </div>
      ))}

      <div className="flex items-start gap-2 px-4 py-3 bg-warning/10 rounded-lg border border-warning/30">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/90">
          Personnel discipline is usually confidential. Reporter updates should disclose only what policy/law permits; do not use a canned sentence if it would reveal confidential action or overpromise what was done.
        </p>
      </div>
    </div>
  );
}
