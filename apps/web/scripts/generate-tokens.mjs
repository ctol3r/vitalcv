#!/usr/bin/env node

/**
 * Token Generation Script
 *
 * Reads the design-system TS token source and outputs a deterministic CSS file.
 * Source of truth: design-system/styles/variables.ts → vdsCssVariables
 *
 * Usage: node --import tsx scripts/generate-tokens.mjs
 * Or:    npx tsx scripts/generate-tokens.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

async function main() {
  const { vdsCssVariables } = await import('../design-system/styles/variables.ts');

  const DEPTH_PATTERN = /shadow|blur|glass|glow|elevated/i;

  const entries = Object.entries(vdsCssVariables)
    .filter(([key]) => !DEPTH_PATTERN.test(key))
    .sort(([a], [b]) => a.localeCompare(b));

  const lines = [
    '/* ──────────────────────────────────────────────────────────────',
    '   GENERATED — do not edit manually.',
    `   Source: design-system/styles/variables.ts`,
    `   Generated: ${new Date().toISOString().slice(0, 10)}`,
    '   Regenerate: npx tsx scripts/generate-tokens.mjs',
    '   ────────────────────────────────────────────────────────────── */',
    '',
    ':root {',
  ];

  for (const [key, value] of entries) {
    lines.push(`  ${key}: ${value};`);
  }

  lines.push('}');
  lines.push('');

  const output = resolve(ROOT, 'styles/generated-tokens.css');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, lines.join('\n'), 'utf-8');

  console.log(`✓ Generated ${entries.length} tokens → styles/generated-tokens.css`);
  console.log(`  (${Object.keys(vdsCssVariables).length - entries.length} depth tokens excluded)`);
}

main().catch((err) => {
  console.error('Token generation failed:', err);
  process.exit(1);
});
