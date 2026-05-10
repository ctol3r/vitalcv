#!/usr/bin/env tsx
/**
 * check-replay-load.ts — W2-PR113A CI gate.
 * Hermetic check: simulates a 3-org healthy load + a 3-org saturated load
 * and asserts gate semantics on each.
 */
import {
  buildReplayLoadReport,
  type OrgWorkload,
  type SystemCapacity,
} from "../../packages/governance-runtime/src/registry.js";

const cap: SystemCapacity = { cpuUnitsPerSecond: 1500, maxConcurrentInFlight: 500, baseLatencyMs: 20 };
const NOW = "2026-05-10T00:00:00Z";

function main(): void {
  const json = process.argv.includes("--json");
  const healthy: OrgWorkload[] = [
    { orgId: "org-a", requestsPerSecond: 200, ambiguityRatio: 0.1, cpuCostPerRequest: 1 },
    { orgId: "org-b", requestsPerSecond: 200, ambiguityRatio: 0.2, cpuCostPerRequest: 1 },
    { orgId: "org-c", requestsPerSecond: 100, ambiguityRatio: 0.3, cpuCostPerRequest: 1 },
  ];
  const r1 = buildReplayLoadReport(healthy, cap, NOW);

  const saturated: OrgWorkload[] = [
    { orgId: "org-a", requestsPerSecond: 1000, ambiguityRatio: 0.1, cpuCostPerRequest: 1 },
    { orgId: "org-b", requestsPerSecond: 1000, ambiguityRatio: 0.2, cpuCostPerRequest: 1 },
  ];
  const r2 = buildReplayLoadReport(saturated, cap, NOW);

  const ok = !r1.hasCiGatingCondition && r2.hasCiGatingCondition;
  if (json) process.stdout.write(JSON.stringify({ healthy: r1, saturated: r2, ok }, null, 2) + "\n");
  else {
    console.log(`[check-replay-load] healthy: tier=${r1.simulation.saturationLevel} findings=${r1.findings.length}`);
    console.log(`[check-replay-load] saturated: tier=${r2.simulation.saturationLevel} findings=${r2.findings.length}`);
    console.log(`[check-replay-load] ok=${ok}`);
  }
  process.exit(ok ? 0 : 1);
}
main();
