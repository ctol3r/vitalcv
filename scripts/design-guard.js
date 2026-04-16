#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { assertContrast } = require('./contrast-guard');

const ROOT = path.resolve(__dirname, '..');
const SCAN_ROOTS = ['apps', 'packages', 'services', 'scripts'];
const SKIP_DIRS = new Set([
  '.git',
  '.next',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'storybook-static',
]);
const SCAN_FILE_PATTERN = /\.(cjs|css|html|js|jsx|md|mdx|mjs|sass|scss|ts|tsx)$/i;
const RULES = [
  {
    id: 'backdrop-filter',
    message: '`backdrop-filter` is disallowed',
    pattern: /\b(?:-webkit-)?backdrop-filter\b/gi,
  },
  {
    id: 'backdropFilter',
    message: '`backdropFilter` is disallowed',
    pattern: /\bbackdropFilter\b/g,
  },
  {
    id: 'backdrop-blur',
    message: 'Tailwind `backdrop-blur*` utilities are disallowed',
    pattern: /\bbackdrop-blur(?:[-:/.[\]\w()%]+)?\b/gi,
  },
  {
    id: 'blur()',
    message: '`blur()` is disallowed',
    pattern: /\bblur\s*\(/g,
  },
  {
    id: 'shadow-[inset]',
    message: '`shadow-[inset...]` is disallowed',
    pattern: /\bshadow-\[inset[^\]]*\]/g,
  },
  {
    id: 'glassmorphism',
    message: 'Glassmorphism patterns are disallowed',
    pattern: /\bglassmorphism\b/gi,
  },
  {
    id: 'glass-* helpers',
    message: 'Glassmorphism helper names are disallowed',
    pattern: /\bglass-(?:blur|card|modal|panel|surface)\b/gi,
  },
  {
    id: 'shadow-utility',
    message: 'Tailwind shadow utilities are disallowed — use flat surfaces with borders',
    pattern: /\bshadow-(?:sm|md|lg|xl|2xl)\b/g,
  },
  {
    id: 'shadow-elevated',
    message: '`shadow-elevated` is disallowed',
    pattern: /\bshadow-elevated\b/g,
  },
  {
    id: 'drop-shadow',
    message: '`drop-shadow` utilities are disallowed',
    pattern: /\bdrop-shadow(?:[-\w]*)\b/g,
  },
  {
    id: 'hover:shadow',
    message: 'Hover shadow utilities are disallowed',
    pattern: /\bhover:shadow-\w+/g,
  },
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (shouldSkipDir(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
      continue;
    }

    if (SCAN_FILE_PATTERN.test(fullPath)) {
      out.push(fullPath);
    }
  }

  return out;
}

function shouldSkipDir(name) {
  return SKIP_DIRS.has(name) || name.startsWith('.next');
}

function toRelative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function collectViolations(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const lines = source.split(/\r?\n/);
  const violations = [];

  lines.forEach((line, index) => {
    for (const rule of RULES) {
      if (!rule.pattern.test(line)) {
        rule.pattern.lastIndex = 0;
        continue;
      }

      rule.pattern.lastIndex = 0;
      violations.push({
        file: toRelative(filePath),
        line: index + 1,
        rule: rule.id,
        message: rule.message,
        snippet: line.trim(),
      });
    }
  });

  return violations;
}

function main() {
  const files = SCAN_ROOTS.flatMap((scanRoot) => walk(path.join(ROOT, scanRoot)));
  const violations = files.flatMap(collectViolations);
  let contrastViolationError = null;

  try {
    assertContrast(ROOT);
  } catch (error) {
    if (error instanceof Error && error.message === 'Contrast violation') {
      contrastViolationError = error;
    } else {
      throw error;
    }
  }

  if (violations.length > 0 || contrastViolationError) {
    console.error('Design guard failed.');
    for (const violation of violations.slice(0, 200)) {
      console.error(
        `- ${violation.file}:${violation.line} [${violation.rule}] ${violation.message}\n  ${formatSnippet(violation.snippet)}`,
      );
    }

    if (violations.length > 200) {
      console.error(`- ... ${violations.length - 200} more violation(s) omitted`);
    }

    if (contrastViolationError) {
      const contrastViolations = Array.isArray(contrastViolationError.violations)
        ? contrastViolationError.violations
        : [];

      for (const violation of contrastViolations.slice(0, 200)) {
        console.error(
          `- ${violation.file} [contrast:${violation.theme}] ${violation.detail}`,
        );
      }

      if (contrastViolations.length > 200) {
        console.error(`- ... ${contrastViolations.length - 200} more contrast violation(s) omitted`);
      }
    }

    const totalViolations = violations.length + (
      contrastViolationError && Array.isArray(contrastViolationError.violations)
        ? contrastViolationError.violations.length
        : 0
    );
    console.error(`Found ${totalViolations} design-guard violation(s).`);
    process.exit(1);
  }

  process.stdout.write(`${JSON.stringify({ design_guard_active: true }, null, 2)}\n`);
}

function formatSnippet(snippet) {
  if (snippet.length <= 180) return snippet;
  return `${snippet.slice(0, 177)}...`;
}

main();
