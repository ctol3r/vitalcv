#!/usr/bin/env tsx
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildDistributedResilienceReport,
  type NodeObservation,
  type QuorumConfig,
} from "../../packages/governance-runtime/src/registry.js";

interface FleetFile { readonly observations: readonly NodeObservation[]; readonly config: QuorumConfig; }

function main(): void {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  let inputPath = resolve(process.cwd(), "scripts/governance/distributed-fleet.json");
  let nowIso = new Date().toISOString();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && i + 1 < argv.length) inputPath = resolve(process.cwd(), argv[++i]);
    else if (argv[i] === "--now" && i + 1 < argv.length) nowIso = argv[++i];
  }
  if (!existsSync(inputPath)) {
    if (json) process.stdout.write(JSON.stringify({ note: `no fleet at ${inputPath}`, hasCiGatingCondition: false }, null, 2) + "\n");
    else console.log(`[check-distributed-resilience] No fleet at ${inputPath} — empty, exit 0.`);
    process.exit(0);
  }
  let fleet: FleetFile;
  try {
    fleet = JSON.parse(readFileSync(inputPath, "utf8")) as FleetFile;
  } catch (err) {
    console.error(`[check-distributed-resilience] ${(err as Error).message}`);
    process.exit(2);
  }
  const r = buildDistributedResilienceReport(fleet.observations, fleet.config, nowIso);
  if (json) process.stdout.write(JSON.stringify(r, null, 2) + "\n");
  else {
    console.log(`[check-distributed-resilience] tier=${r.score.tier} score=${r.score.score} quorum=${r.score.meetsQuorum}`);
    for (const f of r.findings) console.log(`  ${JSON.stringify(f)}`);
  }
  process.exit(r.hasCiGatingCondition ? 1 : 0);
}
main();
