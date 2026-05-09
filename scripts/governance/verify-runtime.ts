#!/usr/bin/env tsx
/**
 * verify-runtime.ts — runtime invariant verification CLI.
 *
 * Wave: W2-PR26A — Governance Runtime Verification + Adversarial Integrity Testing.
 *
 * Runs all governance-runtime invariant checks (fail-closed, ambiguity
 * preservation, contradiction detection, chaos scenarios, registry
 * consistency) and emits a verification report. Exit code 1 on any
 * invariant violation.
 *
 * Usage:
 *   pnpm tsx scripts/governance/verify-runtime.ts
 *   pnpm tsx scripts/governance/verify-runtime.ts --json > verification-report.json
 */

import { runAllInvariants } from "../../packages/governance-runtime/src/registry.js";

function parseArgs(): { jsonOutput: boolean } {
  return { jsonOutput: process.argv.slice(2).includes("--json") };
}

function main(): void {
  const args = parseArgs();
  const report = runAllInvariants();

  if (args.jsonOutput) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    console.log(`[verify-runtime] Executed at: ${report.executedAt}`);
    console.log(`[verify-runtime] Invariants checked: ${report.invariantsChecked}`);
    console.log(`[verify-runtime] Aggregate status: ${report.summary.aggregateStatus}`);
    console.log("");
    console.log("Per-category sample counts:");
    console.log(`  fail-closed (4 axes × adversarial inputs): ${report.summary.failClosedSamples}`);
    console.log(`  ambiguity preservation samples:            ${report.summary.ambiguitySamples}`);
    console.log(`  contradiction-detection samples:           ${report.summary.contradictionSamples}`);
    console.log(`  chaos scenario samples:                    ${report.summary.chaosSamples}`);
    console.log("");
    console.log(`Violations: ${report.violations.length}`);
    if (report.violations.length > 0) {
      console.log("");
      console.log("=== INVARIANT VIOLATIONS ===");
      for (const v of report.violations) {
        console.log(`  [${v.tag}] ${JSON.stringify(v)}`);
      }
      console.log("");
      console.log("Per W2-PR26A non-negotiable rules: governance-runtime itself MUST remain verifiable.");
      console.log("Investigate: which invariant fired? Is it a regression or a new attack vector?");
    }
  }

  if (report.summary.aggregateStatus !== "VERIFIED") {
    process.exit(1);
  }
}

main();
