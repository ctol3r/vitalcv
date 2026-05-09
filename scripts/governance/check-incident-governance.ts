#!/usr/bin/env tsx
/**
 * check-incident-governance.ts — W2-PR35A CI gate.
 *
 * Loads scripts/governance/incidents.json (array of GovernanceIncident)
 * and runs buildIncidentGovernanceReport. Fails CI on validation errors,
 * open SEV-1, REPLAY-RESOLVED-without-postmortem, CRITICAL blast.
 *
 * Idempotent adoption: missing file → exit 0.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildIncidentGovernanceReport,
  type GovernanceIncident,
} from "../../packages/governance-runtime/src/registry.js";

function main(): void {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  let inputPath = resolve(process.cwd(), "scripts/governance/incidents.json");
  let nowIso = new Date().toISOString();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && i + 1 < argv.length) inputPath = resolve(process.cwd(), argv[++i]);
    else if (argv[i] === "--now" && i + 1 < argv.length) nowIso = argv[++i];
  }

  if (!existsSync(inputPath)) {
    if (json) {
      process.stdout.write(JSON.stringify({ note: `no incidents at ${inputPath}`, hasCiGatingCondition: false }, null, 2) + "\n");
    } else {
      console.log(`[check-incident-governance] No incidents at ${inputPath} — empty, exit 0.`);
    }
    process.exit(0);
  }

  let incidents: readonly GovernanceIncident[];
  try {
    const parsed: unknown = JSON.parse(readFileSync(inputPath, "utf8"));
    if (!Array.isArray(parsed)) throw new Error("expected JSON array");
    incidents = parsed as readonly GovernanceIncident[];
  } catch (err) {
    console.error(`[check-incident-governance] ${(err as Error).message}`);
    process.exit(2);
  }

  const report = buildIncidentGovernanceReport(incidents, nowIso);
  if (json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    console.log(`[check-incident-governance] Incidents evaluated: ${report.incidentsEvaluated}`);
    console.log(`[check-incident-governance] Findings: ${report.findings.length}`);
    for (const f of report.findings) console.log(`  ${JSON.stringify(f)}`);
    if (report.hasCiGatingCondition) {
      console.log("=== INCIDENT GOVERNANCE GATING ===");
      console.log("Per W2-PR35A: incidents must follow lifecycle discipline; replay incidents require postmortem trail.");
    } else {
      console.log("[check-incident-governance] No gating conditions.");
    }
  }
  process.exit(report.hasCiGatingCondition ? 1 : 0);
}

main();
