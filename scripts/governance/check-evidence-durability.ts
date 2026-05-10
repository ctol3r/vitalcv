#!/usr/bin/env tsx
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildEvidenceDurabilityReport,
  type ArchivedEpochEnvelope,
} from "../../packages/governance-runtime/src/registry.js";

function main(): void {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  let inputPath = resolve(process.cwd(), "scripts/governance/evidence-archive.json");
  let nowIso = new Date().toISOString();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && i + 1 < argv.length) inputPath = resolve(process.cwd(), argv[++i]);
    else if (argv[i] === "--now" && i + 1 < argv.length) nowIso = argv[++i];
  }
  if (!existsSync(inputPath)) {
    if (json) process.stdout.write(JSON.stringify({ note: `no archive at ${inputPath}`, hasCiGatingCondition: false }, null, 2) + "\n");
    else console.log(`[check-evidence-durability] No archive at ${inputPath} — empty, exit 0.`);
    process.exit(0);
  }
  let envelopes: readonly ArchivedEpochEnvelope[];
  try {
    const parsed: unknown = JSON.parse(readFileSync(inputPath, "utf8"));
    if (!Array.isArray(parsed)) throw new Error("expected JSON array");
    envelopes = parsed as readonly ArchivedEpochEnvelope[];
  } catch (err) {
    console.error(`[check-evidence-durability] ${(err as Error).message}`);
    process.exit(2);
  }
  const r = buildEvidenceDurabilityReport(envelopes, nowIso);
  if (json) process.stdout.write(JSON.stringify(r, null, 2) + "\n");
  else {
    console.log(`[check-evidence-durability] envelopes=${r.envelopesEvaluated} replayMatches=${r.replayMatchCount} mismatches=${r.replayMismatchCount}`);
    for (const f of r.findings) console.log(`  ${JSON.stringify(f)}`);
  }
  process.exit(r.hasCiGatingCondition ? 1 : 0);
}
main();
