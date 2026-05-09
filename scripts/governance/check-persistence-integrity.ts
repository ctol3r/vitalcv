#!/usr/bin/env tsx
/**
 * check-persistence-integrity.ts — W2-PR32A CI gate.
 *
 * Loads:
 *   - sealed governance ledger (default: scripts/governance/sealed-ledger.json)
 *   - optional snapshot (default: scripts/governance/governance-snapshot.json)
 *
 * Runs `buildPersistenceIntegrityReport`. Fails CI on:
 *   - any chain finding (hash mismatch, broken chain, reorder, etc.)
 *   - replay non-determinism
 *   - missing snapshot when ledger is non-empty (rule #7)
 *
 * Idempotent adoption: missing sealed-ledger file → empty ledger → exit 0.
 *
 * Usage:
 *   pnpm tsx scripts/governance/check-persistence-integrity.ts
 *     [--ledger <path>] [--snapshot <path>] [--json] [--now <iso>]
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildPersistenceIntegrityReport,
  emptySealedLedger,
  type GovernanceSnapshot,
  type SealedGovernanceEpoch,
  type SealedGovernanceLedger,
} from "../../packages/governance-runtime/src/registry.js";

interface Args {
  readonly ledgerPath: string;
  readonly snapshotPath: string;
  readonly jsonOutput: boolean;
  readonly nowIso: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let ledgerPath = resolve(process.cwd(), "scripts/governance/sealed-ledger.json");
  let snapshotPath = resolve(process.cwd(), "scripts/governance/governance-snapshot.json");
  let nowIso = new Date().toISOString();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--ledger" && i + 1 < argv.length) {
      ledgerPath = resolve(process.cwd(), argv[++i]);
    } else if (argv[i] === "--snapshot" && i + 1 < argv.length) {
      snapshotPath = resolve(process.cwd(), argv[++i]);
    } else if (argv[i] === "--now" && i + 1 < argv.length) {
      nowIso = argv[++i];
    }
  }
  return { ledgerPath, snapshotPath, jsonOutput: argv.includes("--json"), nowIso };
}

function loadLedger(path: string): SealedGovernanceLedger | null {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`expected JSON array of SealedGovernanceEpoch at ${path}`);
  }
  return Object.freeze({
    sealed: Object.freeze(parsed as readonly SealedGovernanceEpoch[]),
  });
}

function loadSnapshot(path: string): GovernanceSnapshot | null {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as GovernanceSnapshot;
}

function main(): void {
  const args = parseArgs();
  let ledger: SealedGovernanceLedger;
  let snapshot: GovernanceSnapshot | null = null;

  try {
    ledger = loadLedger(args.ledgerPath) ?? emptySealedLedger();
    snapshot = loadSnapshot(args.snapshotPath);
  } catch (err) {
    console.error(`[check-persistence-integrity] Failed to load input: ${(err as Error).message}`);
    process.exit(2);
  }

  const ledgerWasMissing = !existsSync(args.ledgerPath);
  if (ledgerWasMissing) {
    if (args.jsonOutput) {
      process.stdout.write(
        JSON.stringify(
          {
            executedAt: args.nowIso,
            ledgerLength: 0,
            hasSnapshot: snapshot !== null,
            chainFindings: [],
            replayResult: null,
            hasCiGatingCondition: false,
            note: `no sealed ledger at ${args.ledgerPath} — treating as empty`,
          },
          null,
          2,
        ) + "\n",
      );
    } else {
      console.log(`[check-persistence-integrity] No sealed ledger at ${args.ledgerPath} — empty, exit 0.`);
    }
    process.exit(0);
  }

  const report = buildPersistenceIntegrityReport(ledger, snapshot, args.nowIso);

  if (args.jsonOutput) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    console.log(`[check-persistence-integrity] Executed at: ${report.executedAt}`);
    console.log(`[check-persistence-integrity] Ledger length: ${report.ledgerLength}`);
    console.log(`[check-persistence-integrity] Snapshot present: ${report.hasSnapshot}`);
    console.log(`[check-persistence-integrity] Chain findings: ${report.chainFindings.length}`);
    if (report.chainFindings.length > 0) {
      for (const f of report.chainFindings) {
        console.log(`  [CHAIN] ${JSON.stringify(f)}`);
      }
    }
    if (report.replayResult) {
      console.log(`[check-persistence-integrity] Replay deterministic: ${report.replayResult.replayDeterministic}`);
      for (const f of report.replayResult.snapshotFindings) {
        console.log(`  [REPLAY] ${JSON.stringify(f)}`);
      }
    } else {
      console.log("[check-persistence-integrity] No snapshot supplied — replay verification not run.");
    }
    if (report.hasCiGatingCondition) {
      console.log("");
      console.log("=== PERSISTENCE INTEGRITY GATING ===");
      console.log("Per W2-PR32A: tampering must remain detectable. Investigate before merge.");
    } else {
      console.log("[check-persistence-integrity] No gating conditions present.");
    }
  }

  process.exit(report.hasCiGatingCondition ? 1 : 0);
}

main();
