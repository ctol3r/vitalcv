#!/usr/bin/env tsx
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildEnterpriseGovernanceReport,
  type OrgGovernancePolicy,
} from "../../packages/governance-runtime/src/registry.js";

function main(): void {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  let inputPath = resolve(process.cwd(), "scripts/governance/org-policies.json");
  let nowIso = new Date().toISOString();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && i + 1 < argv.length) inputPath = resolve(process.cwd(), argv[++i]);
    else if (argv[i] === "--now" && i + 1 < argv.length) nowIso = argv[++i];
  }
  if (!existsSync(inputPath)) {
    if (json) process.stdout.write(JSON.stringify({ note: `no org policies at ${inputPath}`, hasCiGatingCondition: false }, null, 2) + "\n");
    else console.log(`[check-enterprise-admin] No org policies at ${inputPath} — empty, exit 0.`);
    process.exit(0);
  }
  let policies: readonly OrgGovernancePolicy[];
  try {
    const parsed: unknown = JSON.parse(readFileSync(inputPath, "utf8"));
    if (!Array.isArray(parsed)) throw new Error("expected JSON array");
    policies = parsed as readonly OrgGovernancePolicy[];
  } catch (err) {
    console.error(`[check-enterprise-admin] ${(err as Error).message}`);
    process.exit(2);
  }
  const r = buildEnterpriseGovernanceReport(policies, nowIso);
  if (json) process.stdout.write(JSON.stringify(r, null, 2) + "\n");
  else {
    console.log(`[check-enterprise-admin] policies=${r.policiesEvaluated} findings=${r.findings.length}`);
    for (const f of r.findings) console.log(`  ${JSON.stringify(f)}`);
  }
  process.exit(r.hasCiGatingCondition ? 1 : 0);
}
main();
