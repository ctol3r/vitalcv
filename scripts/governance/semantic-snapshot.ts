#!/usr/bin/env tsx
/**
 * semantic-snapshot.ts — capture or compare governance semantic snapshots.
 *
 * Wave: W2-PR25A — Governance Evolution Safety + Semantic Mutation Detection.
 *
 * Modes:
 *   - capture: emit current semantic snapshot as JSON to stdout (or --out file).
 *   - diff: compare current state of governance-runtime against a baseline snapshot file.
 *
 * Usage:
 *   pnpm tsx scripts/governance/semantic-snapshot.ts capture --out snapshot.json
 *   pnpm tsx scripts/governance/semantic-snapshot.ts diff --baseline snapshot.json
 *
 * Exit codes (diff mode):
 *   0 — SAFE / no mutations
 *   2 — CAUTION
 *   3 — HIGH-RISK
 *   4 — CRITICAL
 *   5 — BREAKING
 */

import { writeFileSync, readFileSync } from "node:fs";
import {
  buildSemanticSnapshot,
  diffSemanticSnapshots,
  maxEvolutionSeverity,
  type SemanticSnapshot,
  type EvolutionSeverity,
} from "../../packages/governance-runtime/src/registry.js";

function parseArgs(): {
  mode: "capture" | "diff";
  outPath: string | null;
  baselinePath: string | null;
} {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error("usage: semantic-snapshot.ts <capture|diff> [--out PATH] [--baseline PATH]");
    process.exit(64);
  }
  const mode = argv[0];
  if (mode !== "capture" && mode !== "diff") {
    console.error(`usage: semantic-snapshot.ts <capture|diff>; got '${mode}'`);
    process.exit(64);
  }
  let outPath: string | null = null;
  let baselinePath: string | null = null;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--out" && typeof argv[i + 1] === "string") {
      outPath = argv[i + 1]!;
      i += 1;
    } else if (a === "--baseline" && typeof argv[i + 1] === "string") {
      baselinePath = argv[i + 1]!;
      i += 1;
    }
  }
  return { mode, outPath, baselinePath };
}

const SEVERITY_EXIT: Readonly<Record<EvolutionSeverity, number>> = Object.freeze({
  SAFE: 0,
  CAUTION: 2,
  "HIGH-RISK": 3,
  CRITICAL: 4,
  BREAKING: 5,
});

function main(): void {
  const args = parseArgs();
  const now = new Date().toISOString();

  if (args.mode === "capture") {
    const snapshot = buildSemanticSnapshot(now);
    const json = JSON.stringify(snapshot, null, 2) + "\n";
    if (args.outPath !== null) {
      writeFileSync(args.outPath, json);
      console.error(`[semantic-snapshot] wrote ${args.outPath}`);
    } else {
      process.stdout.write(json);
    }
    return;
  }

  // diff mode
  if (args.baselinePath === null) {
    console.error("--baseline PATH required in diff mode");
    process.exit(64);
  }
  const baselineRaw = readFileSync(args.baselinePath, "utf8");
  const baseline = JSON.parse(baselineRaw) as SemanticSnapshot;
  const current = buildSemanticSnapshot(now);
  const mutations = diffSemanticSnapshots(baseline, current);
  const severity = maxEvolutionSeverity(mutations);

  console.log(`[semantic-snapshot] baseline: ${args.baselinePath}`);
  console.log(`[semantic-snapshot] mutations: ${mutations.length}`);
  console.log(`[semantic-snapshot] worst severity: ${severity}`);
  if (mutations.length > 0) {
    console.log("");
    console.log("=== SEMANTIC MUTATIONS ===");
    for (const m of mutations) {
      console.log(`  [${m.severity}] ${m.tag}: ${JSON.stringify(m)}`);
    }
    console.log("");
    console.log("Per W2-PR25A: governance evolution must remain observable.");
    console.log("If these changes are intended, update the baseline + obtain founder approval per");
    console.log("docs/ops/TRUST_GUARANTEE_LEXICON.md §6 update protocol.");
  }
  process.exit(SEVERITY_EXIT[severity]);
}

main();
