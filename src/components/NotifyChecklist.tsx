import { CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { NOTIFICATION_CHECKLIST } from "@/lib/notify-checklist";
import { Decision } from "@/lib/types";

const LETTER_TYPE_LABEL: Record<string, string> = {
  hr_referral: "HR Referral Memo",
  reporter_update: "Reporter Update",
};

// Who to tell, in order, for a given finding. Substantiated shows the full
// checklist (HR first); anything else only shows the two people you always
// tell — nobody else needs to be looped in.
export function NotifyChecklist({ decision }: { decision: Decision }) {
  const items = NOTIFICATION_CHECKLIST.filter((item) => item.always || decision === "substantiated");
  const isSubstantiated = decision === "substantiated";

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        Who to tell{isSubstantiated ? " — in this order" : ""}
      </p>
      {items.map((item, i) => (
        <div key={i} className={cn(
          "rounded-lg border p-3.5",
          item.always ? "border-primary/30 bg-primary/5" : "border-border"
        )}>
          <div className="flex items-start gap-2.5">
            <div className={cn(
              "w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5",
              item.always ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {item.always ? <CheckCircle2 className="w-3 h-3" /> : <span className="text-[9px] font-bold">IF</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground">{item.who}</p>
                {isSubstantiated && i === 0 && !item.always && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-semibold uppercase tracking-wide">Do this first</span>
                )}
              </div>
              {!item.always && item.onlyIf && (
                <p className="text-[10px] text-warning font-medium mt-0.5">Only if: {item.onlyIf}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{item.what}</p>
              {item.letterType && LETTER_TYPE_LABEL[item.letterType] && (
                <p className="text-[10px] text-primary mt-1 flex items-center gap-1">
                  <ArrowRight className="w-2.5 h-2.5" />
                  Use the {LETTER_TYPE_LABEL[item.letterType]} template below
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
      <div className="flex items-start gap-2 px-4 py-3 bg-warning/10 rounded-lg border border-warning/30">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/90">
          <strong>Never tell the complainant</strong> what disciplinary action was taken against someone else. Just say: "The matter was investigated and appropriate action was taken."
        </p>
      </div>
    </div>
  );
}
