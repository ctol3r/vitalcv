#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const registryPath = path.join(
  root,
  'apps/api/backend/src/services/identity/canonicalSourceAdapters.ts',
);
const registryText = fs.readFileSync(registryPath, 'utf8');

const deprecated = [...registryText.matchAll(
  /'((?:apps|packages)\/[^']+)'/g,
)].map((match) => match[1].replace(/\.(?:[cm]?[jt]sx?)$/, ''));

const scanRoots = [
  'apps/api/backend/src/routes',
  'apps/api/backend/src/modules',
  'apps/web/app',
  'apps/web/components',
  'apps/marketing',
];

const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const importPattern =
  /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

function walk(relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return extensions.has(path.extname(absolute)) ? [relative] : [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) =>
    walk(path.join(relative, entry.name))
  );
}

function stripExtension(value) {
  return value
    .replaceAll('\\', '/')
    .replace(/\.(?:[cm]?[jt]sx?)$/, '')
    .replace(/\/index$/, '');
}

function resolvedImport(importer, specifier) {
  if (specifier.startsWith('.')) {
    return stripExtension(
      path.relative(root, path.resolve(root, path.dirname(importer), specifier)),
    );
  }
  return stripExtension(specifier);
}

function packageAlias(deprecatedPath) {
  const match = deprecatedPath.match(/^packages\/([^/]+)\/(.+)$/);
  return match ? `@vitalcv/${match[1]}/${match[2]}` : null;
}

const violations = [];
for (const importer of scanRoots.flatMap(walk)) {
  const text = fs.readFileSync(path.join(root, importer), 'utf8');
  for (const match of text.matchAll(importPattern)) {
    const specifier = match[1];
    const resolved = resolvedImport(importer, specifier);
    for (const forbidden of deprecated) {
      const alias = packageAlias(forbidden);
      if (
        resolved === forbidden
        || resolved.startsWith(`${forbidden}/`)
        || (alias && (resolved === alias || resolved.startsWith(`${alias}/`)))
      ) {
        violations.push({ importer, specifier, forbidden });
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Canonical Source Adapter Gate failed.');
  for (const violation of violations) {
    console.error(
      `- ${violation.importer} imports ${violation.specifier} ` +
      `(deprecated alternate: ${violation.forbidden})`,
    );
  }
  process.exit(1);
}

console.log(
  `Canonical Source Adapter Gate passed: ${deprecated.length} deprecated ` +
  `alternate modules are blocked from route and UI imports.`,
);
