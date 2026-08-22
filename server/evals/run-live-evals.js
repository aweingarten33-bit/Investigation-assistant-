import { spawn } from "node:child_process";
import process from "node:process";
import { INVESTIGATION_EVAL_CASES } from "./investigation-cases.js";
import { scoreInvestigationResult, summarizeEvalResults } from "./scoring.js";

const args = process.argv.slice(2);
const argumentValue = (name) => {
  const item = args.find((arg) => arg.startsWith(`--${name}=`));
  return item ? item.slice(name.length + 3) : null;
};

const requestedCase = argumentValue("case");
const providedBaseUrl = argumentValue("base-url") || process.env.EVAL_BASE_URL || null;
const port = Number(process.env.EVAL_PORT || 3187);
const baseUrl = providedBaseUrl || `http://127.0.0.1:${port}`;
const selectedCases = requestedCase
  ? INVESTIGATION_EVAL_CASES.filter((item) => item.id === requestedCase)
  : INVESTIGATION_EVAL_CASES;

if (requestedCase && selectedCases.length === 0) {
  console.error(`Unknown eval case: ${requestedCase}`);
  console.error(`Available: ${INVESTIGATION_EVAL_CASES.map((item) => item.id).join(", ")}`);
  process.exit(2);
}

let serverProcess = null;

function hasProviderConfiguration() {
  return Boolean(
    process.env.ANTHROPIC_API_KEY
    || process.env.OPENAI_API_KEY
    || process.env.GEMINI_API_KEY,
  );
}

async function waitForServer(url, timeoutMs = 15_000) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Eval server did not become healthy at ${url}${lastError ? `: ${lastError.message}` : ""}`);
}

async function startLocalServerIfNeeded() {
  if (providedBaseUrl) return;
  if (!hasProviderConfiguration()) {
    throw new Error("Live AI evals require ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY, or pass --base-url to an already configured deployment.");
  }

  serverProcess = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProcess.stdout.on("data", (chunk) => process.stdout.write(`[eval-server] ${chunk}`));
  serverProcess.stderr.on("data", (chunk) => process.stderr.write(`[eval-server] ${chunk}`));
  await waitForServer(baseUrl);
}

async function classify(evalCase) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(`${baseUrl}/api/analyze-report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        step: "classify",
        reportText: evalCase.notes,
        organizationContext: evalCase.organizationContext || "",
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${payload.error || JSON.stringify(payload)}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function printResult(result) {
  const icon = result.passed ? "PASS" : "FAIL";
  console.log(`\n[${icon}] ${result.id} — ${result.percent}%`);
  for (const check of result.checks) {
    console.log(`  ${check.passed ? "✓" : "✗"} ${check.name} (${check.points}/${check.possible}) — ${check.detail}`);
  }
  if (result.criticalFailures.length) {
    console.log("  Critical failures:");
    result.criticalFailures.forEach((failure) => console.log(`    - ${failure}`));
  }
}

async function main() {
  await startLocalServerIfNeeded();
  console.log(`Running ${selectedCases.length} live investigation AI eval case(s) against ${baseUrl}`);
  console.log("These are synthetic/de-identified scenarios. Live evals are intentionally not part of normal CI because they call the configured AI provider and may use web grounding.");

  const results = [];
  for (const evalCase of selectedCases) {
    console.log(`\n--- ${evalCase.id}: ${evalCase.title} ---`);
    try {
      const response = await classify(evalCase);
      const result = scoreInvestigationResult(evalCase, response);
      results.push(result);
      printResult(result);
    } catch (error) {
      const failed = {
        id: evalCase.id,
        title: evalCase.title,
        score: 0,
        possible: 100,
        percent: 0,
        passed: false,
        criticalFailures: [`Request failed: ${error.message}`],
        checks: [],
      };
      results.push(failed);
      printResult(failed);
    }
  }

  const summary = summarizeEvalResults(results);
  console.log("\n=== Investigation AI Evaluation Summary ===");
  console.log(`Cases: ${summary.total}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Average score: ${summary.average}%`);
  console.log(`Suite status: ${summary.passedSuite ? "PASS" : "FAIL"}`);

  process.exitCode = summary.passedSuite ? 0 : 1;
}

try {
  await main();
} finally {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
  }
}
