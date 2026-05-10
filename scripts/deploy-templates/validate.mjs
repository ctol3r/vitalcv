#!/usr/bin/env node
/**
 * W2-PR80A — Template integrity validator.
 *
 * Validates that every registered template:
 *  - has frozen fields,
 *  - composes its bundles without throwing,
 *  - declares required env vars,
 *  - resolves a posture without error.
 *
 * Exits 1 on any failure. CI workflow gates on exit code.
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

const { listTemplates, listBundles, composeBundles, freezePreset } = api;

let failures = 0;

for (const t of listTemplates()) {
  if (!Object.isFrozen(t)) {
    console.error(`[FAIL] template ${t.templateId} is not frozen`);
    failures++;
  }
  try {
    const composition = composeBundles(t.policyBundleIds);
    if (!composition.posture) {
      console.error(`[FAIL] template ${t.templateId}: composition produced no posture`);
      failures++;
    }
  } catch (err) {
    console.error(`[FAIL] template ${t.templateId}: composeBundles threw — ${err.message}`);
    failures++;
  }
  const envNames = t.envVars.map((v) => v.name);
  if (!envNames.includes('TENANT_ID')) {
    console.error(`[FAIL] template ${t.templateId}: missing required TENANT_ID env var`);
    failures++;
  }
  try {
    const env = t.tenantScope === 'pilot-isolated' ? 'pilot' : 'staging';
    freezePreset({
      templateId: t.templateId,
      institutionId: 'inst_validate',
      env,
      frozenAt: '2026-05-09T00:00:00.000Z',
    });
  } catch (err) {
    console.error(`[FAIL] template ${t.templateId}: freezePreset threw — ${err.message}`);
    failures++;
  }
}

for (const b of listBundles()) {
  if (!Object.isFrozen(b)) {
    console.error(`[FAIL] bundle ${b.bundleId} is not frozen`);
    failures++;
  }
  if (!b.disclaimer || b.disclaimer.length < 10) {
    console.error(`[FAIL] bundle ${b.bundleId}: disclaimer too short or missing`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`[deploy-templates] ${failures} validation failure(s)`);
  process.exit(1);
}

console.log(
  `[deploy-templates] ${listTemplates().length} templates, ${listBundles().length} bundles validated CLEAN`,
);
