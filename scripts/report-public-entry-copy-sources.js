#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(__dirname, 'public-entry-copy-sources.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const surfaces = Array.isArray(manifest.surfaces) ? manifest.surfaces : [];

let missingCount = 0;

console.log('Canonical public-entry copy sources');

for (const surface of surfaces) {
  const files = [surface.entryFile, ...(surface.copySources ?? [])];
  console.log(`- ${surface.label} (${surface.id})`);
  console.log(`  entry: ${surface.entryFile}`);

  for (const file of files) {
    const exists = fs.existsSync(path.join(repoRoot, file));
    if (!exists) {
      missingCount += 1;
    }
    console.log(`  source: ${file}${exists ? '' : ' [missing]'}`);
  }
}

if (missingCount > 0) {
  process.exitCode = 1;
}
