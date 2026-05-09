#!/usr/bin/env tsx
/**
 * check-institutional-drift.ts — W2-PR30A CI gate.
 *
 * Loads a JSON file describing the governance memory ledger (an array of
 * GovernanceEpoch in chronological order) and runs
 * `buildInstitutionalDriftReport`.
 *
 * CI behaviour:
 *   - emits warnings (exit 0 + non-zero finding count) when drift severity
 *     ≥ 60 but < 80
 *   - fails CI (exit 1) when drift severity ≥ 80 OR fatigue == CRITICAL
 *   - fails (exit 2) on invalid input file
 *   - exits 0 + "no ledger" note when the file is missing (idempotent
 *     adoption — repos that have not yet started shipping epochs are not
 *     gated)
 *
 * Usage:
 *   pnpm tsx scripts/governance/check-institutional-drift.ts [--input <path>] [--json] [--now <iso>] [--window <n>]
 *
 * Default input path: scripts/governance/governance-ledger.json
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  appendEpoch,
  buildInstitutionalDriftReport,
  emptyLedger,
  type GovernanceEpoch,
  type GovernanceLedger,
} from "../../packages/governance-runtime/src/registry.js";

interface Args {
  readonly inputPath: string;
  readonly jsonOutput: boolean;
  readonly nowIso: string;
  readonly windowEpochs?: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let inputPath = resolve(process.cwd(), "scripts/governance/governance-ledger.json");
  let nowIso = new Date().toISOString();
  let windowEpochs: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && i + 1 < argv.length) {
      inputPath = resolve(process.cwd(), argv[++i]);
    } else if (argv[i] === "--now" && i + 1 < argv.length) {
      nowIso = argv[++i];
    } else if (argv[i] === "--window" && i + 1 < argv.length) {
      windowEpochs = Number.parseInt(argv[++i], 10);
    }
  }
  return { inputPath, jsonOutput: argv.includes("--json"), nowIso, windowEpochs };
}

function loadLedger(path: string): GovernanceLedger | null {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`expected JSON array of GovernanceEpoch at ${path}`);
  }
  let ledger = emptyLedger();
  for (const e of parsed as readonly GovernanceEpoch[]) {
    ledger = appendEpoch(ledger, e);
  }
  return ledger;
}

function main(): void {
  const args = parseArgs();
  let ledger: GovernanceLedger;
  try {
    const loaded = loadLedger(args.inputPath);
    if (loaded === null) {
      if (args.jsonOutput) {
        process.stdout.write(
          JSON.stringify(
            {
              executedAt: args.nowIso,
              epochsObserved: 0,
              note: `no governance ledger at ${args.inputPath} — treating as empty`,
              hasCiWarning: false,
              hasCiFailure: false,
            },
            null,
            2,
          ) + "\n",
        );
      } else {
        console.log(`[check-institutional-drift] No ledger at ${args.inputPath} — empty, exit 0.`);
      }
      process.exit(0);
    }
    ledger = loaded;
  } catch (err) {
    console.error(`[check-institutional-drift] Failed to load input: ${(err as Error).message}`);
    process.exit(2);
  }

  const report = buildInstitutionalDriftReport(ledger, args.nowIso, {
    windowEpochs: args.windowEpochs,
  });

  if (args.jsonOutput) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    console.log(`[check-institutional-drift] Executed at: ${report.executedAt}`);
    console.log(`[check-institutional-drift] Epochs observed: ${report.epochsObserved}`);
    console.log(`[check-institutional-drift] Window epochs:   ${report.windowEpochs}`);
    console.log("");
    console.log(`Fatigue: ${report.fatigue.severity} (score=${report.fatigue.score.toFixed(1)})`);
    if (report.fatigue.chronicallyUnstableDomains.length > 0) {
      console.log(
        `  chronically unstable domains: ${report.fatigue.chronicallyUnstableDomains.join(", ")}`,
      );
    }
    console.log("");
    console.log(`Historical trust modifier:`);
    console.log(`  recovery confidence multiplier: ${report.historicalTrustModifier.recoveryConfidenceMultiplier.toFixed(2)}`);
    console.log(`  override trust multiplier:      ${report.historicalTrustModifier.overrideTrustMultiplier.toFixed(2)}`);
    console.log(`  verification confidence penalty: -${report.historicalTrustModifier.verificationConfidencePenalty.toFixed(0)}`);
    console.log(`  forward instability score:      ${report.historicalTrustModifier.forwardInstabilityScore.toFixed(0)}`);
    console.log("");
    console.log(`Drift findings: ${report.driftFindings.length}`);
    for (const f of report.driftFindings) {
      console.log(`  [${f.severity.toFixed(0)}] ${f.tag} — ${f.description}`);
    }
    console.log("");
    if (report.hasCiFailure) {
      console.log("=== CI FAILURE — institutional drift exceeds threshold ===");
      console.log("Per W2-PR30A: chronic instability must remain visible. Investigate before merge.");
    } else if (report.hasCiWarning) {
      console.log("=== CI WARNING — drift trajectory rising ===");
      console.log("Per W2-PR30A: governance fatigue is an operational risk. Acknowledge and remediate.");
    } else {
      console.log("[check-institutional-drift] No CI gating conditions present.");
    }
  }

  process.exit(report.hasCiFailure ? 1 : 0);
}

main();
