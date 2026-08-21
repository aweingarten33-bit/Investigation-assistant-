import { useState } from "react";
import {
  Scale, ArrowRight, CheckCircle2, XCircle, AlertTriangle, MinusCircle,
  HelpCircle, ChevronDown, ChevronRight, Copy, Check, FileText, Users,
  Gavel, Lightbulb, Mail, Send, RotateCcw, ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DISCIPLINE_LEVELS } from "@/lib/discipline-levels";

type WizardStep = "start" | "determination" | "determination-detail" | "compliance-check" | "intent" | "discipline" | "discipline-detail" | "notifications" | "letters" | "done";

type Determination = "substantiated" | "not_substantiated" | "inconclusive" | "unfounded";
type Intent = "mistake" | "negligent" | "reckless" | "intentional";
type DisciplineLevel = 1 | 2 | 3 | 4;

const DETERMINATION_OPTIONS = [
  {
    id: "substantiated" as const,
    label: "Substantiated",
    icon: CheckCircle2,
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    plain: "The evidence supports the allegation — it more likely than not happened.",
    examples: [
      "Witnesses back it up",
      "Documents/logs confirm it",
      "The person admitted it",
      "Their explanation doesn't hold up",
    ],
    nextStep: "You'll now figure out what rule was broken and what to do about it.",
  },
  {
    id: "not_substantiated" as const,
    label: "Not Substantiated",
    icon: XCircle,
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
    plain: "You can't prove it happened. Not enough evidence. This doesn't mean they lied — it just means you can't prove it.",
    examples: [
      "Evidence doesn't back the claim",
      "Their explanation checks out",
      "Witnesses contradict the complaint",
    ],
    nextStep: "Document your finding, close the case, and consider if any process improvements are still needed.",
  },
  {
    id: "inconclusive" as const,
    label: "Inconclusive",
    icon: HelpCircle,
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    plain: "It's a coin flip. Evidence on both sides, can't call it either way. This should be rare — really push yourself to make a call.",
    examples: [
      "He said / she said, no other evidence",
      "Key evidence was destroyed or missing",
      "Critical witnesses won't talk",
    ],
    nextStep: "Document the limitations, set up monitoring, and improve processes so this doesn't happen again.",
  },
  {
    id: "unfounded" as const,
    label: "Unfounded",
    icon: MinusCircle,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
    plain: "The evidence PROVES it didn't happen. Different from 'not substantiated' — here you have proof the allegation is false.",
    examples: [
      "They weren't even there when it allegedly happened",
      "Records prove it's physically impossible",
      "It was clearly a misunderstanding",
    ],
    nextStep: "Document your finding, close the case, and consider whether the complaint was made in bad faith (separate issue).",
  },
];

const INTENT_OPTIONS = [
  { id: "mistake" as const, label: "Honest Mistake", description: "They didn't know. Wasn't trained. Genuinely didn't realize.", suggestedLevel: 1 as DisciplineLevel },
  { id: "negligent" as const, label: "Negligent", description: "They should have known. They were trained but didn't follow through. Careless.", suggestedLevel: 2 as DisciplineLevel },
  { id: "reckless" as const, label: "Reckless", description: "They knew the risk and did it anyway. Didn't care about the consequences.", suggestedLevel: 3 as DisciplineLevel },
  { id: "intentional" as const, label: "Intentional", description: "They did it on purpose. Deliberate violation. Knew exactly what they were doing.", suggestedLevel: 4 as DisciplineLevel },
];

const NOTIFICATION_CHECKLIST = [
  { who: "The person who was investigated (the subject)", always: true, what: "Tell them the finding. If substantiated, their supervisor + HR handle the discipline separately." },
  { who: "The person who reported it (the complainant)", always: true, what: "Tell them it was investigated and 'appropriate action was taken.' NEVER tell them what happened to the other person." },
  { who: "HR", always: false, onlyIf: "Substantiated finding", what: "Send them the findings + your discipline recommendation. They handle the personnel side." },
  { who: "The subject's supervisor", always: false, onlyIf: "Substantiated finding", what: "Summary of findings + corrective action plan. NOT the full investigation file." },
  { who: "Compliance Committee", always: false, onlyIf: "Substantiated or significant", what: "Summary at next meeting. Trends and patterns. Significant cases in detail." },
  { who: "Board / Audit Committee", always: false, onlyIf: "Large breach, termination, self-disclosure, government program issues", what: "Summary only. No operational details." },
  { who: "OCR / State AG", always: false, onlyIf: "Required by law — ALWAYS check with Legal first", what: "Only when legally required. See the Regulatory Deadlines tab." },
];

export default function DecisionFramework() {
  const [step, setStep] = useState<WizardStep>("start");
  const [determination, setDetermination] = useState<Determination | null>(null);
  const [violatesRule, setViolatesRule] = useState<boolean | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [priorHistory, setPriorHistory] = useState<boolean | null>(null);
  const [disciplineLevel, setDisciplineLevel] = useState<DisciplineLevel | null>(null);

  const reset = () => {
    setStep("start");
    setDetermination(null);
    setViolatesRule(null);
    setIntent(null);
    setPriorHistory(null);
    setDisciplineLevel(null);
  };

  const selectedDetermination = DETERMINATION_OPTIONS.find(d => d.id === determination);
  const selectedIntent = INTENT_OPTIONS.find(i => i.id === intent);
  const selectedDiscipline = DISCIPLINE_LEVELS.find(d => d.level === disciplineLevel);

  const getSuggestedLevel = (): DisciplineLevel => {
    let base = selectedIntent?.suggestedLevel || 2;
    if (priorHistory) base = Math.min(base + 1, 4) as DisciplineLevel;
    return base as DisciplineLevel;
  };

  const stepLabels: Partial<Record<WizardStep, string>> = {
    start: "Start",
    determination: "What Happened?",
    "determination-detail": "Finding Details",
    "compliance-check": "Rule Broken?",
    intent: "How Bad?",
    discipline: "Consequences",
    "discipline-detail": "Action Plan",
    notifications: "Who to Tell",
    done: "Done",
  };

  const stepOrder: WizardStep[] = determination === "substantiated"
    ? ["start", "determination", "determination-detail", "compliance-check", "intent", "discipline", "discipline-detail", "notifications", "done"]
    : ["start", "determination", "determination-detail", "done"];

  const currentStepIndex = stepOrder.indexOf(step);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Scale className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Decision Framework</h2>
          </div>
          <p className="text-xs text-muted-foreground">Step-by-step: what happened → what to do → who to tell</p>
        </div>
        {step !== "start" && (
          <button onClick={reset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border border-border hover:bg-muted/30">
            <RotateCcw className="w-3 h-3" />
            Start Over
          </button>
        )}
      </div>

      {step !== "start" && (
        <div className="flex items-center gap-1 flex-wrap">
          {stepOrder.map((s, i) => {
            const isActive = s === step;
            const isPast = i < currentStepIndex;
            return (
              <div key={s} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
                <span className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full transition-colors",
                  isActive ? "bg-primary text-primary-foreground font-semibold" :
                  isPast ? "bg-primary/10 text-primary font-medium" :
                  "bg-muted text-muted-foreground"
                )}>
                  {stepLabels[s]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {step === "start" && (
        <div className="bg-card rounded-xl border border-border p-6 sm:p-8 text-center space-y-5">
          <Scale className="w-12 h-12 text-primary mx-auto" />
          <div>
            <h3 className="text-xl font-bold text-foreground">Investigation Done?</h3>
            <h3 className="text-xl font-bold text-foreground">Let's Figure Out What to Do.</h3>
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            This will walk you through the entire decision process step by step:
          </p>
          <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">1</span> What's your finding?</div>
            <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">2</span> Was a rule actually broken?</div>
            <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">3</span> How bad was it?</div>
            <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">4</span> What's the consequence?</div>
            <div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">5</span> Who needs to know?</div>
          </div>
          <button
            onClick={() => setStep("determination")}
            className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center gap-2 mx-auto"
          >
            Let's Go <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[11px] text-muted-foreground">
            Rather have AI do this from your case facts? Use AI Recommendation, right above this section.
          </p>
        </div>
      )}

      {step === "determination" && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-base font-bold text-foreground mb-1">Step 1: What's Your Finding?</h3>
            <p className="text-xs text-muted-foreground mb-4">Based on everything you found in your investigation, which one fits?</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DETERMINATION_OPTIONS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => { setDetermination(d.id); setStep("determination-detail"); }}
                  className={cn(
                    "text-left rounded-lg border p-4 transition-all hover:shadow-sm",
                    d.border, "hover:bg-muted/20"
                  )}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", d.bg)}>
                      <d.icon className={cn("w-4 h-4", d.color)} />
                    </div>
                    <span className={cn("text-sm font-bold", d.color)}>{d.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{d.plain}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === "determination-detail" && selectedDetermination && (
        <div className="space-y-4">
          <div className={cn("bg-card rounded-xl border p-5", selectedDetermination.border)}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", selectedDetermination.bg)}>
                <selectedDetermination.icon className={cn("w-5 h-5", selectedDetermination.color)} />
              </div>
              <div>
                <h3 className={cn("text-base font-bold", selectedDetermination.color)}>Your Finding: {selectedDetermination.label}</h3>
                <p className="text-xs text-muted-foreground">{selectedDetermination.plain}</p>
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-4 mb-4">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">When This Is the Right Call</p>
              <ul className="space-y-1.5">
                {selectedDetermination.examples.map((ex, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                    <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                    {ex}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-start gap-2 px-4 py-3 bg-primary/5 rounded-lg border border-primary/20">
              <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground"><strong>What's next:</strong> {selectedDetermination.nextStep}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setStep("determination")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-md border border-border hover:bg-muted/30">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>

            {determination === "substantiated" ? (
              <button onClick={() => setStep("compliance-check")} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                Next: Was a Rule Broken? <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={() => setStep("done")} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                Finish & See Checklist <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {step === "compliance-check" && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-base font-bold text-foreground mb-1">Step 2: Did They Break a Rule?</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Just because something happened doesn't mean it broke a law or policy. Which is it?
            </p>

            <div className="space-y-3">
              <button
                onClick={() => { setViolatesRule(true); setStep("intent"); }}
                className="w-full text-left rounded-lg border border-destructive/30 p-4 hover:bg-destructive/5 transition-colors"
              >
                <p className="text-sm font-bold text-destructive mb-1">Yes — a specific law, regulation, or policy was violated</p>
                <p className="text-xs text-muted-foreground">You can point to a specific rule (45 CFR section, state law, internal policy) that was broken.</p>
              </button>
              <button
                onClick={() => { setViolatesRule(false); setStep("done"); }}
                className="w-full text-left rounded-lg border border-success/30 p-4 hover:bg-success/5 transition-colors"
              >
                <p className="text-sm font-bold text-success mb-1">No — the conduct happened but it wasn't actually against any rule</p>
                <p className="text-xs text-muted-foreground">It might be inappropriate or not ideal, but there's no specific requirement it violated. Consider process improvements instead.</p>
              </button>
            </div>

            <div className="mt-4 flex items-start gap-2 px-4 py-3 bg-warning/10 rounded-lg border border-warning/30">
              <Lightbulb className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/90">
                <strong>Check for exceptions:</strong> Some conduct that looks like a violation has a valid defense — like "Treatment, Payment, or Operations" for HIPAA access. If there's a valid exception, the conduct may be compliant even though it happened.
              </p>
            </div>
          </div>

          <button onClick={() => setStep("determination-detail")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-md border border-border hover:bg-muted/30">
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
        </div>
      )}

      {step === "intent" && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-base font-bold text-foreground mb-1">Step 3: How Bad Was It?</h3>
            <p className="text-xs text-muted-foreground mb-4">
              This determines how severe the consequence should be. Pick the one that best describes what happened:
            </p>

            <div className="space-y-2">
              {INTENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setIntent(opt.id)}
                  className={cn(
                    "w-full text-left rounded-lg border p-4 transition-all",
                    intent === opt.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:bg-muted/20"
                  )}
                >
                  <p className="text-sm font-bold text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </button>
              ))}
            </div>

            {intent && (
              <div className="mt-4 space-y-3">
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-xs font-semibold text-foreground mb-2">One more thing — do they have prior compliance issues?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPriorHistory(true)}
                      className={cn(
                        "flex-1 px-4 py-2.5 rounded-md border text-sm font-medium transition-colors",
                        priorHistory === true ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/30"
                      )}
                    >
                      Yes, prior issues
                    </button>
                    <button
                      onClick={() => setPriorHistory(false)}
                      className={cn(
                        "flex-1 px-4 py-2.5 rounded-md border text-sm font-medium transition-colors",
                        priorHistory === false ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/30"
                      )}
                    >
                      No, clean record
                    </button>
                  </div>
                </div>

                {priorHistory !== null && (
                  <button
                    onClick={() => {
                      const suggested = getSuggestedLevel();
                      setDisciplineLevel(suggested);
                      setStep("discipline");
                    }}
                    className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    Next: What's the Consequence? <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          <button onClick={() => setStep("compliance-check")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-md border border-border hover:bg-muted/30">
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
        </div>
      )}

      {step === "discipline" && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-base font-bold text-foreground mb-1">Step 4: What's the Consequence?</h3>
            <p className="text-xs text-muted-foreground mb-2">
              Based on what you told me, here's what I'd recommend. But you can pick a different level if you think it fits better.
            </p>

            {disciplineLevel && (
              <div className="flex items-start gap-2 px-4 py-3 bg-primary/5 rounded-lg border border-primary/20 mb-4">
                <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-foreground">
                  <strong>My recommendation: Level {getSuggestedLevel()}</strong> — based on {selectedIntent?.label.toLowerCase()} intent{priorHistory ? " with prior history" : " and no prior history"}.
                  {priorHistory && " Prior history bumps it up one level."}
                </p>
              </div>
            )}

            <div className="space-y-2">
              {DISCIPLINE_LEVELS.map((d) => (
                <button
                  key={d.level}
                  onClick={() => { setDisciplineLevel(d.level); setStep("discipline-detail"); }}
                  className={cn(
                    "w-full text-left rounded-lg border p-4 transition-all",
                    d.level === getSuggestedLevel() ? cn(d.border, "ring-1 ring-primary/20 bg-primary/5") : "border-border hover:bg-muted/20",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold", d.bg, d.color)}>{d.level}</div>
                    <div>
                      <p className={cn("text-sm font-bold", d.color)}>{d.title}</p>
                      <p className="text-[11px] text-muted-foreground">{d.when}</p>
                    </div>
                    {d.level === getSuggestedLevel() && (
                      <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-semibold">Recommended</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => setStep("intent")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-md border border-border hover:bg-muted/30">
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
        </div>
      )}

      {step === "discipline-detail" && selectedDiscipline && (
        <div className="space-y-4">
          <div className={cn("bg-card rounded-xl border p-5", selectedDiscipline.border)}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold", selectedDiscipline.bg, selectedDiscipline.color)}>
                {selectedDiscipline.level}
              </div>
              <div>
                <h3 className={cn("text-base font-bold", selectedDiscipline.color)}>{selectedDiscipline.title}</h3>
                <p className="text-xs text-muted-foreground">{selectedDiscipline.subtitle}</p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Here's Exactly What to Do</p>
              <ul className="space-y-2">
                {selectedDiscipline.whatToDo.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <Users className="w-3 h-3" /> Who Does What
              </p>
              <div className="space-y-2">
                {selectedDiscipline.whoDoesWhat.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="font-bold text-foreground shrink-0 w-32">{item.who}:</span>
                    <span className="text-muted-foreground">{item.does}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setStep("discipline")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-md border border-border hover:bg-muted/30">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
            <button onClick={() => setStep("notifications")} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              Next: Who Needs to Know? <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === "notifications" && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-base font-bold text-foreground mb-1">Step 5: Who Needs to Know?</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Not everyone gets the full report. Here's who to tell and what to tell them:
            </p>

            <div className="space-y-2">
              {NOTIFICATION_CHECKLIST.map((item, i) => (
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
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.who}</p>
                      {!item.always && item.onlyIf && (
                        <p className="text-[10px] text-warning font-medium mt-0.5">Only if: {item.onlyIf}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{item.what}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-start gap-2 px-4 py-3 bg-warning/10 rounded-lg border border-warning/30">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/90">
                <strong>NEVER tell the complainant</strong> what disciplinary action was taken against someone else. Just say: "The matter was investigated and appropriate action was taken."
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setStep("discipline-detail")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-md border border-border hover:bg-muted/30">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
            <button onClick={() => setStep("done")} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              Finish <CheckCircle2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-primary/30 p-6 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
            <h3 className="text-lg font-bold text-foreground">Here's Your Summary</h3>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Finding</p>
                <p className={cn("font-bold capitalize", selectedDetermination?.color || "text-foreground")}>
                  {selectedDetermination?.label || "—"}
                </p>
              </div>
              {determination === "substantiated" && (
                <>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Rule Violation</p>
                    <p className="font-bold text-foreground">{violatesRule ? "Yes" : "No"}</p>
                  </div>
                  {violatesRule && (
                    <>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Intent Level</p>
                        <p className="font-bold text-foreground">{selectedIntent?.label || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Consequence</p>
                        <p className={cn("font-bold", selectedDiscipline?.color || "text-foreground")}>
                          {selectedDiscipline?.title || "—"}
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">What to Do Now</p>
              <ul className="space-y-1.5 text-xs text-foreground">
                {determination === "substantiated" && violatesRule && selectedDiscipline ? (
                  <>
                    {selectedDiscipline.whatToDo.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                    <li className="flex items-start gap-2 mt-2 pt-2 border-t border-border">
                      <Mail className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                      Notify the subject, complainant, and relevant stakeholders — use the AI Letter Generator in this toolkit
                    </li>
                  </>
                ) : determination === "substantiated" && !violatesRule ? (
                  <>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />Document that the conduct occurred but was not a compliance violation</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />Consider process improvements to prevent similar situations</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />Close the investigation</li>
                  </>
                ) : determination === "not_substantiated" ? (
                  <>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />Document your finding and the evidence reviewed</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />Notify the subject they've been cleared</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />Notify the complainant the matter was investigated</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />Consider if any process improvements are still needed</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />Schedule anti-retaliation follow-up (30/60/90 days)</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />Close the investigation</li>
                  </>
                ) : determination === "inconclusive" ? (
                  <>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />Document the limitations that prevented a determination</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />Set up enhanced monitoring (30–90 days)</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />Implement process improvements to prevent future ambiguity</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />Notify both parties of the outcome</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />Schedule anti-retaliation follow-up</li>
                  </>
                ) : determination === "unfounded" ? (
                  <>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />Document the evidence that disproved the allegation</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />Send the subject an exoneration letter</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />Evaluate if the complaint was made in bad faith (separate issue)</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />Close the investigation</li>
                  </>
                ) : null}
              </ul>
            </div>
          </div>

          <div className="flex items-start gap-2.5 px-4 py-3 bg-warning/10 border border-warning/30 rounded-lg">
            <Lightbulb className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">Don't Forget</p>
              <ul className="text-[11px] text-foreground/80 space-y-0.5">
                <li>• <strong>Be consistent.</strong> If you fire one person for something, you can't just warn another for the same thing. That's a lawsuit.</li>
                <li>• <strong>HR must be involved</strong> for anything beyond verbal coaching.</li>
                <li>• <strong>Schedule anti-retaliation check-ins</strong> with the complainant at 30 and 60 days.</li>
                <li>• <strong>Use the AI Letter Generator</strong> in this toolkit to draft all the notification letters.</li>
              </ul>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={reset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-md border border-border hover:bg-muted/30">
              <RotateCcw className="w-3 h-3" /> Start Over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
