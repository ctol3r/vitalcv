#!/usr/bin/env tsx
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildWorkflowAutomationReport, type WorkflowStepReceipt } from "../../packages/governance-runtime/src/registry.js";

function main(): void {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  let inputPath = resolve(process.cwd(), "scripts/governance/workflow-receipts.json");
  let nowIso = new Date().toISOString();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && i + 1 < argv.length) inputPath = resolve(process.cwd(), argv[++i]);
    else if (argv[i] === "--now" && i + 1 < argv.length) nowIso = argv[++i];
  }
  if (!existsSync(inputPath)) {
    if (json) process.stdout.write(JSON.stringify({ note: `no receipts at ${inputPath}`, hasCiGatingCondition: false }, null, 2) + "\n");
    else console.log(`[check-workflow-automation] No receipts at ${inputPath} — empty, exit 0.`);
    process.exit(0);
  }
  let receipts: readonly WorkflowStepReceipt[];
  try {
    const parsed: unknown = JSON.parse(readFileSync(inputPath, "utf8"));
    if (!Array.isArray(parsed)) throw new Error("expected JSON array");
    receipts = parsed as readonly WorkflowStepReceipt[];
  } catch (err) {
    console.error(`[check-workflow-automation] ${(err as Error).message}`);
    process.exit(2);
  }
  const r = buildWorkflowAutomationReport(receipts, nowIso);
  if (json) process.stdout.write(JSON.stringify(r, null, 2) + "\n");
  else {
    console.log(`[check-workflow-automation] receipts=${r.receiptsEvaluated} findings=${r.findings.length}`);
    for (const f of r.findings) console.log(`  ${JSON.stringify(f)}`);
  }
  process.exit(r.hasCiGatingCondition ? 1 : 0);
}
main();
