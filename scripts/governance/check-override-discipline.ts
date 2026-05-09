#!/usr/bin/env tsx
/**
 * check-override-discipline.ts — W2-PR29A CI gate.
 *
 * Loads a JSON file describing the current human-override fleet (an array of
 * HumanOverrideRecord) and runs `buildOverrideDisciplineReport`. Fails CI if
 * any gating condition is present:
 *
 *   - validation error
 *   - decay state STALE / EXPIRED / OVER-RENEWED
 *   - blast-radius tier CRITICAL
 *   - recursive override chain
 *
 * Usage:
 *   pnpm tsx scripts/governance/check-override-discipline.ts [--input <path>] [--json] [--now <iso>]
 *
 * Default input path: scripts/governance/override-fleet.json
 *
 * If the input file does not exist, the script treats the override fleet as
 * empty and exits 0 — there is no override fleet to gate. (This keeps the
 * gate idempotent in repos that have not yet adopted the override-fleet
 * artifact.)
 *
 * Exit codes:
 *   0 — no gating conditions present
 *   1 — at least one gating condition present
 *   2 — invalid input file (parse error, wrong shape)
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildOverrideDisciplineReport,
  type HumanOverrideRecord,
} from "../../packages/governance-runtime/src/registry.js";

interface Args {
  readonly inputPath: string;
  readonly jsonOutput: boolean;
  readonly nowIso: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let inputPath = resolve(process.cwd(), "scripts/governance/override-fleet.json");
  let nowIso = new Date().toISOString();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && i + 1 < argv.length) {
      inputPath = resolve(process.cwd(), argv[++i]);
    } else if (argv[i] === "--now" && i + 1 < argv.length) {
      nowIso = argv[++i];
    }
  }
  return {
    inputPath,
    jsonOutput: argv.includes("--json"),
    nowIso,
  };
}

function loadFleet(path: string): readonly HumanOverrideRecord[] | null {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`expected JSON array of HumanOverrideRecord at ${path}`);
  }
  return parsed as readonly HumanOverrideRecord[];
}

function main(): void {
  const args = parseArgs();
  let fleet: readonly HumanOverrideRecord[];
  try {
    const loaded = loadFleet(args.inputPath);
    if (loaded === null) {
      if (args.jsonOutput) {
        process.stdout.write(
          JSON.stringify(
            {
              executedAt: args.nowIso,
              recordsEvaluated: 0,
              findings: [],
              hasCiGatingCondition: false,
              note: `no override fleet at ${args.inputPath} — treating as empty`,
            },
            null,
            2,
          ) + "\n",
        );
      } else {
        console.log(`[check-override-discipline] No override fleet at ${args.inputPath} — empty fleet, exit 0.`);
      }
      process.exit(0);
    }
    fleet = loaded;
  } catch (err) {
    console.error(`[check-override-discipline] Failed to load input: ${(err as Error).message}`);
    process.exit(2);
  }

  const report = buildOverrideDisciplineReport(fleet, args.nowIso);

  if (args.jsonOutput) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    console.log(`[check-override-discipline] Executed at: ${report.executedAt}`);
    console.log(`[check-override-discipline] Records evaluated: ${report.recordsEvaluated}`);
    console.log(`[check-override-discipline] Findings: ${report.findings.length}`);
    if (report.hasCiGatingCondition) {
      console.log("");
      console.log("=== OVERRIDE DISCIPLINE GATING CONDITIONS ===");
      for (const f of report.findings) {
        if (f.tag === "validation-error") {
          console.log(`  [VALIDATION] ${f.overrideId}: ${JSON.stringify(f.error)}`);
        } else if (f.tag === "decay-state" && f.state !== "FRESH" && f.state !== "DECAYING") {
          console.log(`  [DECAY] ${f.overrideId}: ${f.state}`);
        } else if (f.tag === "blast-radius" && f.tier === "CRITICAL") {
          console.log(`  [BLAST] ${f.overrideId}: CRITICAL (score=${f.score})`);
        } else if (f.tag === "recursive-chain") {
          console.log(`  [RECURSION] cycle ids: ${f.overrideIds.join(", ")}`);
        }
      }
      console.log("");
      console.log("Per W2-PR29A: human overrides are integrity events. Resolve before merge.");
    } else {
      console.log("[check-override-discipline] No gating conditions present.");
    }
  }

  process.exit(report.hasCiGatingCondition ? 1 : 0);
}

main();
