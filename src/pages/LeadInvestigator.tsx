import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  getInvestigationCaseState,
  resumeInvestigationCase,
  startInvestigationCase,
  type HumanInputEntry,
  type InvestigationCaseState,
} from "@/lib/investigation-graph-api";
import { HomeToolkitMenuButton } from "@/components/ToolkitMenu";

const LAST_CASE_KEY = "investigation-assistant.leadInvestigator.lastCaseId";

const RESULT_TYPE_OPTIONS: { value: HumanInputEntry["resultType"]; label: string }[] = [
  { value: "interview_notes", label: "Interview notes" },
  { value: "document", label: "Document / record obtained" },
  { value: "response", label: "General response / new information" },
  { value: "unavailable", label: "Could not obtain it" },
  { value: "correction", label: "Correction to prior facts" },
];

function newCaseId() {
  return `case-${Date.now().toString(36)}`;
}

function StartCaseForm({ onStart, starting }: { onStart: (input: { caseId: string; caseObjective: string; allegations: string; caseNotes: string }) => void; starting: boolean }) {
  const [caseId, setCaseId] = useState(newCaseId());
  const [caseObjective, setCaseObjective] = useState("");
  const [allegations, setAllegations] = useState("");
  const [caseNotes, setCaseNotes] = useState("");

  return (
    <div className="rounded-2xl bg-background neu-raised overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-border">
        <div className="flex items-start gap-3">
          <HomeToolkitMenuButton />
          <h1 className="text-base sm:text-xl font-bold text-foreground mb-0.5">Lead Investigator</h1>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
          The AI leads the investigation: it tells you what to do next, and reassesses every time you add new evidence. You stay in control of every real-world action and every consequential decision.
        </p>
      </div>

      <div className="p-5 space-y-4">
        <div>
          <Label htmlFor="caseId" className="text-xs">Case ID</Label>
          <Input id="caseId" value={caseId} onChange={(e) => setCaseId(e.target.value)} className="mt-1" />
          <p className="text-[11px] text-muted-foreground mt-1">Used to find this case again later — save it, or bookmark this page after starting.</p>
        </div>
        <div>
          <Label htmlFor="caseObjective" className="text-xs">Case objective (optional)</Label>
          <Input id="caseObjective" placeholder="What are we trying to determine?" value={caseObjective} onChange={(e) => setCaseObjective(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="allegations" className="text-xs">Allegation / issue being investigated (optional)</Label>
          <Input id="allegations" placeholder="e.g. Possible controlled-medication diversion" value={allegations} onChange={(e) => setAllegations(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="caseNotes" className="text-xs">Current evidence / case notes</Label>
          <Textarea id="caseNotes" placeholder="Paste everything known so far: counts, logs, records, statements..." value={caseNotes} onChange={(e) => setCaseNotes(e.target.value)} className="mt-1 min-h-[220px]" />
        </div>
        <Button
          onClick={() => onStart({ caseId, caseObjective, allegations, caseNotes })}
          disabled={starting || !caseId.trim() || caseNotes.trim().length < 20}
          className="w-full h-11"
        >
          {starting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing evidence...</> : <><Sparkles className="mr-2 h-4 w-4" />Open case & analyze</>}
        </Button>
        {caseNotes.trim().length > 0 && caseNotes.trim().length < 20 && (
          <p className="text-xs text-destructive text-center">Add a bit more detail before analyzing.</p>
        )}
      </div>
    </div>
  );
}

function ActionTypeHelp({ action }: { action: NonNullable<InvestigationCaseState["currentNextBestAction"]> }) {
  const wantsQuestions = action.suggestedQuestions?.length > 0;
  const wantsDocument = Boolean(action.documentRequest);

  if (!wantsQuestions && !wantsDocument) {
    return <p className="text-sm text-muted-foreground">{action.evidenceOrPersonNeeded}</p>;
  }

  return (
    <div className="space-y-3">
      {wantsQuestions && (
        <div>
          <p className="text-xs font-semibold text-foreground mb-1">Focused interview questions</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
            {action.suggestedQuestions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}
      {wantsDocument && (
        <div>
          <p className="text-xs font-semibold text-foreground mb-1">What to obtain</p>
          <p className="text-sm text-foreground">{action.documentRequest}</p>
        </div>
      )}
    </div>
  );
}

function AddResultForm({ onSubmit, submitting }: { onSubmit: (input: { resultType: string; text: string }) => void; submitting: boolean }) {
  const [resultType, setResultType] = useState<HumanInputEntry["resultType"]>("interview_notes");
  const [text, setText] = useState("");

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">What kind of result is this?</Label>
        <select
          value={resultType}
          onChange={(e) => setResultType(e.target.value as HumanInputEntry["resultType"])}
          className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {RESULT_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>
      <div>
        <Label htmlFor="resultText" className="text-xs">Details</Label>
        <Textarea id="resultText" value={text} onChange={(e) => setText(e.target.value)} className="mt-1 min-h-[140px]" placeholder="What did you find out? Paste interview notes, document contents, or explain why it couldn't be obtained." />
      </div>
      <Button onClick={() => onSubmit({ resultType, text })} disabled={submitting || text.trim().length === 0} className="w-full h-10">
        {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reassessing case...</> : "Add result & continue investigation"}
      </Button>
    </div>
  );
}

function CaseView({ caseId, state, onSubmitResult, submitting, onReset }: {
  caseId: string;
  state: InvestigationCaseState;
  onSubmitResult: (input: { resultType: string; text: string }) => void;
  submitting: boolean;
  onReset: () => void;
}) {
  const action = state.currentNextBestAction;
  const isReviewReady = state.interrupt?.kind === "ready_for_human_review";
  const whatRemains = (state.investigativeGaps || []).map((g) => g.description);
  const leadingHypothesisId = state.achResult?.ranking?.[0]?.hypothesisId;
  const rec = state.finalRecommendation;

  return (
    <div className="rounded-2xl bg-background neu-raised overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-border flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <HomeToolkitMenuButton />
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-foreground mb-0.5">Lead Investigator</h1>
            <p className="text-[11px] text-muted-foreground truncate">Case {caseId}</p>
          </div>
        </div>
        <Button onClick={onReset} variant="outline" size="sm" className="shrink-0"><RotateCcw className="mr-1.5 h-3.5 w-3.5" />New case</Button>
      </div>

      <div className="p-5 space-y-5">
        {state.graphStatus === "error" && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            The AI's last analysis failed validation and was not accepted. Details: {state.errors?.at(-1)?.message}
          </div>
        )}

        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Case objective</h2>
          <p className="text-sm text-foreground">{state.caseObjective}</p>
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">What we know</h2>
          {state.findings?.length ? (
            <ul className="space-y-2">
              {state.findings.map((f) => (
                <li key={f.id} className="text-sm text-foreground">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground mr-1.5">[{f.evidenceStatus}]</span>
                  {f.statement}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">No evidence-grounded findings yet.</p>}
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">What remains unresolved</h2>
          {whatRemains.length ? (
            <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
              {whatRemains.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Nothing material remains open.</p>}
        </section>

        {action && !isReviewReady && (
          <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-primary mb-1.5">What you should do next</h2>
            <p className="text-sm font-semibold text-foreground mb-1">{action.action}</p>
            <p className="text-xs text-muted-foreground mb-3"><span className="font-semibold">Why: </span>{action.whyThisIsNext}</p>
            <div className="border-t border-primary/10 pt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Help me do it</p>
              <ActionTypeHelp action={action} />
            </div>
          </section>
        )}

        {isReviewReady && rec && (
          <section className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide text-foreground mb-1.5">Ready for human review — AI recommendation</h2>
              <p className="text-sm text-muted-foreground">
                {state.investigationStatus === "ready_for_review"
                  ? "No further reasonable investigative step was identified."
                  : "Material uncertainty remains and is not realistically resolvable further; the AI is flagging this as a limitation, not resolving it."}
                {" "}This is a recommendation, not a decision — a human makes the final call.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Recommended determination</p>
              <p className="text-sm text-foreground uppercase">{rec.recommendedDetermination.replace(/_/g, " ")}</p>
            </div>
            {rec.leadingHypothesis && (
              <div>
                <p className="text-xs font-semibold text-foreground">Leading explanation</p>
                <p className="text-sm text-foreground">{rec.leadingHypothesis.label}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-foreground">AI rationale</p>
              <p className="text-sm text-foreground">{rec.aiRationale}</p>
            </div>
            {rec.remainingLimitations?.length ? (
              <div>
                <p className="text-xs font-semibold text-foreground mb-1">Remaining limitations / uncertainties</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
                  {rec.remainingLimitations.map((g) => <li key={g.id}>{g.description}</li>)}
                </ul>
              </div>
            ) : null}
            <div>
              <p className="text-xs font-semibold text-foreground">What could change this</p>
              <p className="text-sm text-foreground">{rec.whatCouldChangeThis}</p>
            </div>
            <div className="border-t border-border pt-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Human final determination</p>
              <p className="text-sm text-foreground">Pending</p>
            </div>
          </section>
        )}

        {state.hypotheses?.length ? (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Competing explanations (ACH ranking — fewest inconsistencies first)</h2>
            <ul className="space-y-1.5">
              {(state.achResult?.ranking || []).map((r) => {
                const h = state.hypotheses?.find((item) => item.id === r.hypothesisId);
                if (!h) return null;
                return (
                  <li key={h.id} className="text-sm text-foreground">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground mr-1.5">
                      {h.id === leadingHypothesisId ? "[leading]" : `[weighted-I ${r.weightedInconsistency.toFixed(2)}]`}
                    </span>
                    {h.label}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {!isReviewReady && state.graphStatus !== "error" && (
          <section className="border-t border-border pt-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Add result / evidence</h2>
            <AddResultForm onSubmit={onSubmitResult} submitting={submitting} />
          </section>
        )}
      </div>
    </div>
  );
}

const LeadInvestigator = () => {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [state, setState] = useState<InvestigationCaseState | null>(null);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("case");
    const stored = window.localStorage.getItem(LAST_CASE_KEY);
    const idToLoad = fromUrl || stored;
    if (!idToLoad) return;

    setLoadingExisting(true);
    getInvestigationCaseState(idToLoad).then(({ data, error }) => {
      setLoadingExisting(false);
      if (error || !data) {
        window.localStorage.removeItem(LAST_CASE_KEY);
        return;
      }
      setCaseId(idToLoad);
      setState(data);
    });
  }, []);

  const handleStart = useCallback(async (input: { caseId: string; caseObjective: string; allegations: string; caseNotes: string }) => {
    setStarting(true);
    const { data, error } = await startInvestigationCase(input.caseId, {
      caseObjective: input.caseObjective,
      allegations: input.allegations,
      caseNotes: input.caseNotes,
    });
    setStarting(false);
    if (error || !data) {
      toast.error(error?.message || "Failed to open the case.");
      return;
    }
    window.localStorage.setItem(LAST_CASE_KEY, input.caseId);
    window.history.replaceState(null, "", `?case=${encodeURIComponent(input.caseId)}`);
    setCaseId(input.caseId);
    setState(data);
    toast.success("Evidence analyzed.");
  }, []);

  const handleSubmitResult = useCallback(async (input: { resultType: string; text: string }) => {
    if (!caseId) return;
    setSubmitting(true);
    const { data, error } = await resumeInvestigationCase(caseId, input);
    setSubmitting(false);
    if (error || !data) {
      toast.error(error?.message || "Failed to submit this result.");
      return;
    }
    setState(data);
    toast.success("Case reassessed with the new evidence.");
  }, [caseId]);

  const handleReset = useCallback(() => {
    window.localStorage.removeItem(LAST_CASE_KEY);
    window.history.replaceState(null, "", window.location.pathname);
    setCaseId(null);
    setState(null);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[720px] lg:max-w-[880px] xl:max-w-[1040px] px-4 py-3 sm:py-10">
        {loadingExisting ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading case...
          </div>
        ) : caseId && state ? (
          <CaseView caseId={caseId} state={state} onSubmitResult={handleSubmitResult} submitting={submitting} onReset={handleReset} />
        ) : (
          <StartCaseForm onStart={handleStart} starting={starting} />
        )}
        <p className="mt-4 text-center text-[11px] text-muted-foreground">Personal-use demo — use anonymized data only. Reports are not saved by this app.</p>
      </div>
    </div>
  );
};

export default LeadInvestigator;
