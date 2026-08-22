import { useMemo, useState } from "react";
import {
  Scale, CheckCircle2, XCircle, HelpCircle, MinusCircle,
  RotateCcw, AlertTriangle, ShieldQuestion,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DISCIPLINE_LEVELS } from "@/lib/discipline-levels";
import { NotifyChecklist } from "@/components/NotifyChecklist";

type Determination = "substantiated" | "not_substantiated" | "inconclusive" | "unfounded";
type FactorRating = "mitigating" | "neutral" | "aggravating" | "unknown";
type DisciplineLevel = 1 | 2 | 3 | 4;

type FactorId =
  | "intent" | "role" | "sensitivity" | "actual_harm" | "potential_harm" | "concealment"
  | "cooperation" | "prior_discipline" | "prior_training" | "policy" | "precedent" | "cba"
  | "leadership" | "retaliation" | "personal_benefit" | "fraud" | "patient_safety" | "reporting";

const DETERMINATIONS = [
  { id: "substantiated" as const, label: "Substantiated", icon: CheckCircle2, plain: "The evidence supports the allegation under the organization's applicable standard of proof." },
  { id: "not_substantiated" as const, label: "Not Substantiated", icon: XCircle, plain: "The evidence does not establish the allegation. This does not mean the report was false." },
  { id: "inconclusive" as const, label: "Inconclusive", icon: HelpCircle, plain: "Material evidence points both ways or key evidence is unavailable, preventing a defensible determination." },
  { id: "unfounded" as const, label: "Unfounded", icon: MinusCircle, plain: "Available evidence affirmatively shows the alleged conduct did not occur or the allegation is factually incorrect." },
];

const FACTORS: { id: FactorId; label: string; prompt: string }[] = [
  { id: "intent", label: "Intent", prompt: "Accidental, negligent, reckless, deliberate, or genuinely unknown?" },
  { id: "role", label: "Role / access expectations", prompt: "Was the conduct inconsistent with the person's job duties or authorized access?" },
  { id: "sensitivity", label: "Sensitivity", prompt: "How sensitive was the information, patient population, transaction, or conduct involved?" },
  { id: "actual_harm", label: "Actual harm", prompt: "What harm actually occurred, if any?" },
  { id: "potential_harm", label: "Potential harm", prompt: "What reasonably foreseeable harm could have resulted?" },
  { id: "concealment", label: "Concealment", prompt: "Was there deception, concealment, deletion, falsification, or an attempt to evade review?" },
  { id: "cooperation", label: "Cooperation", prompt: "Did the subject cooperate, self-report, remediate, or obstruct?" },
  { id: "prior_discipline", label: "Prior discipline", prompt: "Is there relevant documented prior discipline or a repeated pattern?" },
  { id: "prior_training", label: "Prior training", prompt: "Was the person trained on the requirement and was that training adequate/recent?" },
  { id: "policy", label: "Policy language", prompt: "What does the actual policy say about this conduct and available consequences?" },
  { id: "precedent", label: "Precedent", prompt: "How has materially similar conduct been handled before?" },
  { id: "cba", label: "Union / CBA", prompt: "Are progressive-discipline, just-cause, notice, grievance, or other labor requirements implicated?" },
  { id: "leadership", label: "Leadership role", prompt: "Did the person's authority, fiduciary role, or supervisory responsibilities heighten expectations?" },
  { id: "retaliation", label: "Retaliation", prompt: "Is retaliation, interference, intimidation, or whistleblower activity implicated?" },
  { id: "personal_benefit", label: "Personal benefit", prompt: "Was the conduct for personal, financial, relational, or other non-business benefit?" },
  { id: "fraud", label: "Fraud", prompt: "Is there evidence of falsification, billing fraud, theft, kickback, diversion, or deliberate deception?" },
  { id: "patient_safety", label: "Patient safety", prompt: "Did the conduct affect or risk patient/resident safety or continuity of care?" },
  { id: "reporting", label: "Regulatory reporting", prompt: "Does the matter trigger breach, licensure, survey, law-enforcement, payer, or other reporting review?" },
];

const RATINGS: { value: FactorRating; label: string }[] = [
  { value: "mitigating", label: "Mitigating" },
  { value: "neutral", label: "Neutral" },
  { value: "aggravating", label: "Aggravating" },
  { value: "unknown", label: "Unknown" },
];

export default function DecisionFramework() {
  const [determination, setDetermination] = useState<Determination | null>(null);
  const [ruleStatus, setRuleStatus] = useState<"yes" | "no" | "unknown">("unknown");
  const [ratings, setRatings] = useState<Record<FactorId, FactorRating>>(() => Object.fromEntries(FACTORS.map((factor) => [factor.id, "unknown"])) as Record<FactorId, FactorRating>);
  const [selectedBand, setSelectedBand] = useState<DisciplineLevel | null>(null);

  const counts = useMemo(() => {
    const values = Object.values(ratings);
    return {
      aggravating: values.filter((value) => value === "aggravating").length,
      mitigating: values.filter((value) => value === "mitigating").length,
      unknown: values.filter((value) => value === "unknown").length,
    };
  }, [ratings]);

  const reset = () => {
    setDetermination(null);
    setRuleStatus("unknown");
    setRatings(Object.fromEntries(FACTORS.map((factor) => [factor.id, "unknown"])) as Record<FactorId, FactorRating>);
    setSelectedBand(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1"><Scale className="w-5 h-5 text-primary" /><h2 className="text-lg font-bold text-foreground">Manual Decision Framework</h2></div>
          <p className="text-xs text-muted-foreground">Evidence first → independent factors → organization policy → human-selected action range</p>
        </div>
        <button onClick={reset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border border-border hover:bg-muted/30"><RotateCcw className="w-3 h-3" />Reset</button>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground leading-relaxed">
        <strong>This framework deliberately does not calculate discipline from a score.</strong> A single deliberate, high-sensitivity event can be more serious than several low-risk mistakes. Use the factors below to expose what matters, then apply your actual policy, precedent, HR rules and any CBA/union requirements.
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-bold text-foreground mb-1">1. What does the evidence support?</h3>
        <p className="text-xs text-muted-foreground mb-4">Choose the determination that fits the evidence and your organization's standard of proof.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DETERMINATIONS.map((item) => {
            const selected = determination === item.id;
            return (
              <button key={item.id} onClick={() => { setDetermination(item.id); if (item.id !== "substantiated") setSelectedBand(null); }} className={cn("rounded-lg border p-4 text-left transition-colors", selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/20")}>
                <div className="flex items-center gap-2 mb-1.5"><item.icon className={cn("w-4 h-4", selected ? "text-primary" : "text-muted-foreground")} /><span className="text-sm font-semibold">{item.label}</span></div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{item.plain}</p>
              </button>
            );
          })}
        </div>
      </section>

      {determination === "substantiated" && (
        <>
          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-1">2. Does the proven conduct actually violate a rule or expectation?</h3>
            <p className="text-xs text-muted-foreground mb-3">A bad-looking fact is not automatically a policy violation. Confirm the policy, regulation, contract term, job expectation, or control involved.</p>
            <div className="flex flex-wrap gap-2">
              {(["yes", "no", "unknown"] as const).map((value) => (
                <button key={value} onClick={() => setRuleStatus(value)} className={cn("px-3 py-2 rounded-lg border text-xs font-medium", ruleStatus === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/20")}>{value === "yes" ? "Yes — rule identified" : value === "no" ? "No — conduct not prohibited" : "Unknown — verify first"}</button>
              ))}
            </div>
            {ruleStatus !== "yes" && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3"><ShieldQuestion className="h-4 w-4 text-warning mt-0.5" /><p className="text-xs text-foreground">Do not jump to discipline until the actual policy/requirement and its applicability are verified.</p></div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div><h3 className="text-sm font-bold text-foreground">3. Weigh the factors independently</h3><p className="text-xs text-muted-foreground mt-1">Unknown is a valid answer. It tells you what must be investigated or checked before final action.</p></div>
              <div className="text-[10px] text-muted-foreground text-right">{counts.aggravating} aggravating<br />{counts.mitigating} mitigating<br />{counts.unknown} unknown</div>
            </div>
            <div className="space-y-3">
              {FACTORS.map((factor) => (
                <div key={factor.id} className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold text-foreground">{factor.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">{factor.prompt}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {RATINGS.map((rating) => (
                      <button key={rating.value} onClick={() => setRatings((current) => ({ ...current, [factor.id]: rating.value }))} className={cn("px-2 py-1 rounded border text-[10px] font-medium", ratings[factor.id] === rating.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/30")}>{rating.label}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-1">4. Choose an organization-appropriate action band</h3>
            <p className="text-xs text-muted-foreground mb-4">The app does not choose this from factor counts. Review the evidence, policy, precedent, prior history, CBA obligations and HR/Legal input, then select the band your organization can defend.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DISCIPLINE_LEVELS.map((band) => (
                <button key={band.level} onClick={() => setSelectedBand(band.level)} className={cn("rounded-lg border p-4 text-left transition-colors", selectedBand === band.level ? "border-primary bg-primary/5" : "border-border hover:bg-muted/20")}>
                  <p className="text-sm font-semibold text-foreground">{band.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{band.when}</p>
                </button>
              ))}
            </div>

            {selectedBand && (() => {
              const band = DISCIPLINE_LEVELS.find((item) => item.level === selectedBand)!;
              return (
                <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-semibold text-primary mb-2">Selected for human review: {band.title}</p>
                  <ul className="space-y-1.5">{band.whatToDo.map((item, index) => <li key={index} className="text-xs text-foreground flex gap-2"><span>•</span><span>{item}</span></li>)}</ul>
                </div>
              );
            })()}

            {counts.unknown > 0 && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3"><AlertTriangle className="h-4 w-4 text-warning mt-0.5" /><p className="text-xs text-foreground">{counts.unknown} factor{counts.unknown === 1 ? " remains" : "s remain"} unknown. Resolve the material ones before final action, especially policy, precedent, prior discipline/training, and CBA/union requirements.</p></div>
            )}
          </section>

          {selectedBand && ruleStatus === "yes" && (
            <section className="rounded-xl border border-border bg-card p-5"><NotifyChecklist decision="substantiated" /></section>
          )}
        </>
      )}

      {determination && determination !== "substantiated" && (
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">No disciplinary band should be selected from this determination alone.</p>
          <p className="text-xs text-muted-foreground">Document the evidence and limitations, close or continue the investigation as appropriate, preserve anti-retaliation protections, and consider non-disciplinary process improvements separately.</p>
          <NotifyChecklist decision="unsubstantiated" />
        </section>
      )}
    </div>
  );
}
