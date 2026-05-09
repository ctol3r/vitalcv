#!/usr/bin/env tsx
/**
 * meta-verify.ts — meta-verification of the verification layer itself.
 *
 * Wave: W2-PR27A — Meta-Verification + Verification Blind Spot Detection.
 *
 * Builds + emits the meta-verification report. Per W2-PR27A non-negotiable
 * rule #6: completeness inflation is forbidden. The aggregate confidence
 * is the WORST per-domain confidence; "VERIFIED" requires zero blind spots
 * AND zero assumptions across all domains.
 *
 * Usage:
 *   pnpm tsx scripts/governance/meta-verify.ts
 *   pnpm tsx scripts/governance/meta-verify.ts --json > meta-verification-report.json
 *
 * Exit codes:
 *   0 — VERIFIED OR ASSUMED
 *   1 — PARTIALLY-VERIFIED (some blind spots present; expected baseline)
 *   2 — UNVERIFIED (some domain has zero invariants — CI failure)
 */

import {
  buildMetaVerificationReport,
  runAllInvariants,
} from "../../packages/governance-runtime/src/registry.js";

function parseArgs(): { jsonOutput: boolean; failOnPartial: boolean } {
  const argv = process.argv.slice(2);
  return {
    jsonOutput: argv.includes("--json"),
    failOnPartial: argv.includes("--fail-on-partial"),
  };
}

function main(): void {
  const args = parseArgs();
  const inv = runAllInvariants();
  const report = buildMetaVerificationReport(inv);

  if (args.jsonOutput) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    console.log(`[meta-verify] Executed at: ${report.executedAt}`);
    console.log(`[meta-verify] Domains:                  ${report.domainSummaries.length}`);
    console.log(`[meta-verify] Total invariants verified: ${report.totalInvariants}`);
    console.log(`[meta-verify] Total blind spots:         ${report.totalBlindSpots}`);
    console.log(`[meta-verify] Total assumptions:         ${report.totalAssumptions}`);
    console.log("");
    console.log("Per-domain confidence:");
    for (const s of report.domainSummaries) {
      console.log(
        `  ${s.domain.padEnd(28)} ${s.confidence.padEnd(20)} ` +
        `inv=${s.invariantCount} blindspot=${s.blindSpotCount} assume=${s.assumptionCount}`,
      );
    }
    console.log("");
    console.log(`[meta-verify] Aggregate confidence: ${report.aggregateConfidence}`);
    console.log(
      `[meta-verify] Underlying invariants execution status: ${
        inv.summary.aggregateStatus
      } (${inv.violations.length} violations of ${inv.invariantsChecked} checks)`,
    );

    if (report.aggregateConfidence === "PARTIALLY-VERIFIED") {
      console.log("");
      console.log("Note: PARTIALLY-VERIFIED is the EXPECTED baseline state.");
      console.log("Per W2-PR27A: completeness inflation is forbidden. Domains with");
      console.log("documented blind spots or assumptions are correctly classified.");
      console.log("Use --fail-on-partial to enforce stricter CI gating.");
    }
  }

  // Always fail on UNVERIFIED (a domain with zero invariants is a verification failure)
  if (report.aggregateConfidence === "UNVERIFIED") {
    process.exit(2);
  }
  if (args.failOnPartial && report.aggregateConfidence === "PARTIALLY-VERIFIED") {
    process.exit(1);
  }
  // If invariants execution itself failed, fail
  if (inv.summary.aggregateStatus !== "VERIFIED") {
    process.exit(1);
  }
}

main();
