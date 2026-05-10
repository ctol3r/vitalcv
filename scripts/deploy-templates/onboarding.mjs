#!/usr/bin/env node
/**
 * W2-PR80A — Onboarding kit generator (CLI).
 *
 * Usage:
 *   node scripts/deploy-templates/onboarding.mjs --template <id> --institution <id> --env <pilot|staging|prod|dev>
 *
 * Prints the generated kit as JSON to stdout. Exits 1 on validation failure.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const distEntry = path.resolve(here, '..', '..', 'packages', 'deployment-templates', 'dist', 'index.js');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val === undefined || val.startsWith('--')) {
        out[key] = 'true';
      } else {
        out[key] = val;
        i++;
      }
    }
  }
  return out;
}

const args = parseArgs(process.argv);
if (!args.template || !args.institution || !args.env) {
  console.error('[deploy-templates] usage: --template <id> --institution <id> --env <env>');
  process.exit(1);
}

let api;
try {
  api = await import(pathToFileURL(distEntry).href);
} catch (err) {
  console.error(`[deploy-templates] cannot load ${distEntry}: ${err.message}`);
  console.error('[deploy-templates] hint: run pnpm --filter @vitalcv/deployment-templates build');
  process.exit(1);
}

const { generateOnboardingKit, verifyOnboardingKit } = api;

let kit;
try {
  kit = generateOnboardingKit({
    templateId: args.template,
    institutionId: args.institution,
    env: args.env,
  });
} catch (err) {
  console.error(`[deploy-templates] generateOnboardingKit failed: ${err.message}`);
  process.exit(1);
}

if (!verifyOnboardingKit(kit)) {
  console.error('[deploy-templates] generated kit failed self-verification');
  process.exit(1);
}

process.stdout.write(JSON.stringify(kit, null, 2) + '\n');
