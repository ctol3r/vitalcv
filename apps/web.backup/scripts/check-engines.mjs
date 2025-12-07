#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

const engines = pkg.engines ?? {};

const clean = (value) => value?.replace?.(/^v/i, '') ?? value;

const expectMatch = (label, expected, actual) => {
  if (!expected) {
    return;
  }

  if (expected !== actual) {
    console.error(
      `❌ ${label} version mismatch. Expected ${expected}, found ${actual}.`
    );
    process.exit(1);
  }
};

const nodeVersion = clean(process.version);
let pnpmVersion;

try {
  pnpmVersion = execSync('pnpm --version', { stdio: 'pipe' })
    .toString()
    .trim();
} catch (error) {
  console.error('Failed to read pnpm version:', error);
  process.exit(1);
}

expectMatch('Node', clean(engines.node), nodeVersion);
expectMatch('pnpm', clean(engines.pnpm), pnpmVersion);

console.log(
  `✅ Toolchain locked: node@${nodeVersion}, pnpm@${pnpmVersion} (matches package.json)`
);

