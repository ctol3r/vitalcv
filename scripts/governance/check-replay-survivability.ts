#!/usr/bin/env tsx
/**
 * check-replay-survivability.ts — W2-PR33A CI gate.
 *
 * Loads governance-ledger.json (W2-PR30A format) and runs
 * `buildReplaySurvivabilityReport`. Fails CI on:
 *   - any IMPOSSIBLE-JUMP edge
 *   - UNRECONSTRUCTABLE confidence on a non-empty window
 *   - ambiguity-erasure suspicion
 *
 * Idempotent adoption: missing ledger → exit 0.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  appendEpoch,
  buildReplaySurvivabilityReport,
  emptyLedger,
  type GovernanceEpoch,
  type GovernanceLedger,
} from "../../packages/governance-runtime/src/registry.js";

interface Args {
  readonly inputPath: string;
  readonly jsonOutput: boolean;
  readonly nowIso: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let inputPath = resolve(process.cwd(), "scripts/governance/governance-ledger.json");
  let nowIso = new Date().toISOString();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && i + 1 < argv.length) inputPath = resolve(process.cwd(), argv[++i]);
    else if (argv[i] === "--now" && i + 1 < argv.length) nowIso = argv[++i];
  }
  return { inputPath, jsonOutput: argv.includes("--json"), nowIso };
}

function loadLedger(path: string): GovernanceLedger | null {
  if (!existsSync(path)) return null;
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`expected array of GovernanceEpoch at ${path}`);
  let l = emptyLedger();
  for (const e of parsed as readonly GovernanceEpoch[]) l = appendEpoch(l, e);
  return l;
}

function main(): void {
  const args = parseArgs();
  let ledger: GovernanceLedger;
  try {
    ledger = loadLedger(args.inputPath) ?? emptyLedger();
  } catch (err) {
    console.error(`[check-replay-survivability] ${(err as Error).message}`);
    process.exit(2);
  }

  if (!existsSync(args.inputPath)) {
    if (args.jsonOutput) {
      process.stdout.write(JSON.stringify({ note: "no ledger; empty.", hasCiGatingCondition: false }, null, 2) + "\n");
    } else {
      console.log("[check-replay-survivability] No ledger; empty, exit 0.");
    }
    process.exit(0);
  }

  const report = buildReplaySurvivabilityReport(ledger, args.nowIso);

  if (args.jsonOutput) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    console.log(`[check-replay-survivability] Window epochs:           ${report.score.windowEpochs}`);
    console.log(`[check-replay-survivability] Evidence-bearing epochs: ${report.score.evidenceBearingEpochs}`);
    console.log(`[check-replay-survivability] Survivability score:     ${report.score.survivabilityScore}`);
    console.log(`[check-replay-survivability] Confidence:              ${report.score.confidence}`);
    console.log(`[check-replay-survivability] Findings:                ${report.findings.length}`);
    for (const f of report.findings) {
      console.log(`  ${JSON.stringify(f)}`);
    }
    if (report.hasCiGatingCondition) {
      console.log("");
      console.log("=== REPLAY-SURVIVABILITY GATING ===");
      console.log("Per W2-PR33A: impossible jumps and unreconstructable windows fail CI.");
    } else {
      console.log("[check-replay-survivability] No gating conditions.");
    }
  }

  process.exit(report.hasCiGatingCondition ? 1 : 0);
}

main();
