#!/usr/bin/env tsx
/**
 * check-kernel-freeze.ts — W2-PR41A CI gate.
 *
 * Optionally loads scripts/governance/kernel-baseline.json (a frozen
 * kernel snapshot) and scripts/governance/compatibility-contract.json
 * (a downstream consumer's required surface). Fails CI on any kernel
 * stability finding or contract violation.
 *
 * Idempotent adoption: missing baseline/contract → exit 0.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildKernelFreezeReport,
  type CompatibilityContract,
  type FrozenKernelSurface,
} from "../../packages/governance-runtime/src/registry.js";

function main(): void {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  let baselinePath = resolve(process.cwd(), "scripts/governance/kernel-baseline.json");
  let contractPath = resolve(process.cwd(), "scripts/governance/compatibility-contract.json");
  let nowIso = new Date().toISOString();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--baseline" && i + 1 < argv.length) baselinePath = resolve(process.cwd(), argv[++i]);
    else if (argv[i] === "--contract" && i + 1 < argv.length) contractPath = resolve(process.cwd(), argv[++i]);
    else if (argv[i] === "--now" && i + 1 < argv.length) nowIso = argv[++i];
  }

  let baseline: FrozenKernelSurface | null = null;
  let contract: CompatibilityContract | null = null;
  try {
    if (existsSync(baselinePath)) baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as FrozenKernelSurface;
    if (existsSync(contractPath)) contract = JSON.parse(readFileSync(contractPath, "utf8")) as CompatibilityContract;
  } catch (err) {
    console.error(`[check-kernel-freeze] ${(err as Error).message}`);
    process.exit(2);
  }

  const report = buildKernelFreezeReport(baseline, contract, nowIso);
  if (json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    console.log(`[check-kernel-freeze] live version: ${report.liveVersion}`);
    console.log(`[check-kernel-freeze] stability findings: ${report.stabilityFindings.length}`);
    for (const f of report.stabilityFindings) console.log(`  ${JSON.stringify(f)}`);
    console.log(`[check-kernel-freeze] contract violations: ${report.contractViolations.length}`);
    for (const v of report.contractViolations) console.log(`  ${JSON.stringify(v)}`);
    if (report.hasCiGatingCondition) {
      console.log("=== KERNEL FREEZE GATING ===");
      console.log("Per W2-PR41A: kernel additions require minor bump; removals/reorders require major bump.");
    } else {
      console.log("[check-kernel-freeze] kernel stable.");
    }
  }
  process.exit(report.hasCiGatingCondition ? 1 : 0);
}

main();
