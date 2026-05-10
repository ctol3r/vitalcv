#!/usr/bin/env node
/**
 * W2-PR80A — Deployment-template chaos runner.
 *
 * Runs every chaos mode and prints verdicts. Exits 1 if any mode is UNSAFE.
 * Always prints a fingerprint suitable for inclusion in rollout manifests.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const distEntry = path.resolve(here, '..', '..', 'packages', 'deployment-templates', 'dist', 'index.js');

let api;
try {
  api = await import(pathToFileURL(distEntry).href);
} catch (err) {
  console.error(`[deploy-templates] cannot load ${distEntry}: ${err.message}`);
  console.error('[deploy-templates] hint: run pnpm --filter @vitalcv/deployment-templates build');
  process.exit(1);
}

const { runDeploymentChaos } = api;

const result = runDeploymentChaos();
const lines = [];
lines.push(`[deploy-templates] chaos fingerprint: ${result.fingerprint}`);
for (const v of result.verdicts) {
  lines.push(`  ${v.verdict.padEnd(6)} ${v.mode} — ${v.rationale}`);
}
console.log(lines.join('\n'));

if (!result.allSafe) {
  console.error('[deploy-templates] one or more chaos modes UNSAFE; refusing to proceed');
  process.exit(1);
}
