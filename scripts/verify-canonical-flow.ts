#!/usr/bin/env node
/**
 * scripts/verify-canonical-flow.ts
 *
 * Verifies that the five canonical nav items are present (and
 * ONLY the five) in apps/web/components/layout/Navbar.tsx, and
 * that each canonical route resolves to a real page on disk.
 *
 * Read-only. Exits non-zero on FAIL.
 *
 *   pnpm verify:canonical-flow    full verification
 *   pnpm verify:nav-shape         Navbar items only
 *   pnpm verify:canonical-routes  route existence only
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Mode = 'full' | 'nav-shape' | 'canonical-routes';

const REPO_ROOT = (() => {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
})();

type Level = 'OK' | 'NOTE' | 'WARN' | 'FAIL';
interface Entry {
  level: Level;
  text: string;
}

const CANONICAL_NAV: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/', label: 'Home' },
  { href: '/get-ready', label: 'Get Ready' },
  { href: '/passport', label: 'Passport' },
  { href: '/review', label: 'Review' },
  { href: '/status', label: 'Status' },
];

const CANONICAL_ROUTE_PATHS: ReadonlyArray<string> = [
  'apps/web/app/page.tsx',
  'apps/web/app/get-ready/page.tsx',
  'apps/web/app/passport/page.tsx',
  'apps/web/app/review/page.tsx',
  'apps/web/app/status/page.tsx',
];

function readNavSource(): string {
  const path = resolve(REPO_ROOT, 'apps/web/components/layout/Navbar.tsx');
  if (!existsSync(path)) {
    throw new Error(`Navbar.tsx missing at ${path}`);
  }
  return readFileSync(path, 'utf8');
}

interface ParsedNavItem {
  href: string;
  label: string;
}

function parseNavItems(src: string): ParsedNavItem[] {
  // Match the NAV_ITEMS array block. We accept either form:
  //   const NAV_ITEMS = [ { href: '/x', label: 'X' }, ... ] as const;
  const m = src.match(/const\s+NAV_ITEMS\s*=\s*\[([\s\S]*?)\]\s*as\s+const/);
  if (!m) return [];
  const body = m[1];
  const items: ParsedNavItem[] = [];
  const itemRe = /\{\s*href:\s*['"]([^'"]+)['"]\s*,\s*label:\s*['"]([^'"]+)['"]\s*\}/g;
  for (const item of body.matchAll(itemRe)) {
    items.push({ href: item[1], label: item[2] });
  }
  return items;
}

function verifyNavShape(): Entry[] {
  const entries: Entry[] = [];
  let src: string;
  try {
    src = readNavSource();
  } catch (err) {
    return [{ level: 'FAIL', text: (err as Error).message }];
  }
  const parsed = parseNavItems(src);
  if (parsed.length === 0) {
    return [
      {
        level: 'FAIL',
        text: 'Navbar.tsx: NAV_ITEMS array not found or empty',
      },
    ];
  }
  if (parsed.length !== CANONICAL_NAV.length) {
    entries.push({
      level: 'FAIL',
      text: `Navbar.tsx: NAV_ITEMS length=${parsed.length}, expected=${CANONICAL_NAV.length}`,
    });
  }
  for (let i = 0; i < CANONICAL_NAV.length; i += 1) {
    const expected = CANONICAL_NAV[i]!;
    const actual = parsed[i];
    if (!actual) {
      entries.push({
        level: 'FAIL',
        text: `Navbar.tsx: NAV_ITEMS[${i}] missing; expected { href: '${expected.href}', label: '${expected.label}' }`,
      });
      continue;
    }
    if (actual.href !== expected.href || actual.label !== expected.label) {
      entries.push({
        level: 'FAIL',
        text: `Navbar.tsx: NAV_ITEMS[${i}] is { href: '${actual.href}', label: '${actual.label}' }; expected { href: '${expected.href}', label: '${expected.label}' }`,
      });
    } else {
      entries.push({
        level: 'OK',
        text: `Navbar.tsx: NAV_ITEMS[${i}] = ${expected.label} (${expected.href})`,
      });
    }
  }
  // Reject any extra items even if length matched somehow
  if (parsed.length > CANONICAL_NAV.length) {
    for (let i = CANONICAL_NAV.length; i < parsed.length; i += 1) {
      entries.push({
        level: 'FAIL',
        text: `Navbar.tsx: NAV_ITEMS[${i}] = ${parsed[i]!.label} (${parsed[i]!.href}) is not canonical`,
      });
    }
  }
  return entries;
}

function verifyCanonicalRoutes(): Entry[] {
  const entries: Entry[] = [];
  for (const rel of CANONICAL_ROUTE_PATHS) {
    if (existsSync(resolve(REPO_ROOT, rel))) {
      entries.push({ level: 'OK', text: `canonical route resolves: ${rel}` });
    } else {
      entries.push({ level: 'FAIL', text: `canonical route missing: ${rel}` });
    }
  }
  return entries;
}

function verifyAuditDoc(): Entry[] {
  const path = resolve(REPO_ROOT, 'docs/product/canonical-product-flow.md');
  if (!existsSync(path)) {
    return [{ level: 'FAIL', text: 'docs/product/canonical-product-flow.md missing' }];
  }
  return [{ level: 'OK', text: 'docs/product/canonical-product-flow.md present' }];
}

function main(): void {
  const mode = (process.argv[2] ?? 'full') as Mode;
  console.log(`# verify-canonical-flow (${mode}) · ${new Date().toISOString()}`);
  console.log('#'.padEnd(72, '#'));

  const entries: Entry[] = [];
  switch (mode) {
    case 'nav-shape':
      entries.push(...verifyNavShape());
      break;
    case 'canonical-routes':
      entries.push(...verifyCanonicalRoutes());
      break;
    case 'full':
    default:
      entries.push(...verifyAuditDoc());
      entries.push(...verifyNavShape());
      entries.push(...verifyCanonicalRoutes());
      break;
  }

  for (const e of entries) console.log(`[${e.level.padEnd(4, ' ')}] ${e.text}`);
  const failed = entries.filter((e) => e.level === 'FAIL');
  if (failed.length > 0) {
    console.log(
      `\n[FAIL] canonical flow: ${failed.length} drift entr${failed.length === 1 ? 'y' : 'ies'}`,
    );
    process.exit(1);
  }
  console.log('\n[OK  ] canonical flow: no drift detected');
}

main();
