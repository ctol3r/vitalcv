/**
 * semantic-token-bridge.test.ts — D′-01 (2026-08-09).
 *
 * The bridge's contract, held as executable fact rather than doc prose:
 *
 *  1. The 2026 semantic namespaces are declared in styles/tokens/semantic.css,
 *     once each, and NOWHERE else in apps/web (the --vt-bg lesson: three
 *     declaration sites, three values, import-order roulette).
 *  2. Ruling 1 is in force: the primary action is paper-inverse and the
 *     evidence green is a different color from the action — green reports,
 *     paper acts.
 *  3. The four unruled knobs (chip silhouette, frost, atmosphere, radius
 *     scale) hold their EC-20 locked values until D′-09 flips them with the
 *     EC-22 amendment. A wave that flips one here without the amendment is
 *     the exact failure this test exists to catch.
 *  4. Bridge values map to the SHIPPED warm family — parsed live from
 *     styles/easy-home.css, so if the island's ground ever shifts, the bridge
 *     is forced to follow rather than silently fork.
 *  5. The third-party reference palette (Dimension extraction) does not
 *     appear in the bridge, and the bridge import is the TERMINAL @import in
 *     globals.css — de-islanding deletes above it, never appends after it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const WEB_ROOT = resolve(__dirname, '..');
const SEMANTIC_PATH = join(WEB_ROOT, 'styles', 'tokens', 'semantic.css');
const SEMANTIC_REL = 'styles/tokens/semantic.css';
const semantic = readFileSync(SEMANTIC_PATH, 'utf8');
const easyHome = readFileSync(join(WEB_ROOT, 'styles', 'easy-home.css'), 'utf8');
const globalsCss = readFileSync(join(WEB_ROOT, 'app', 'globals.css'), 'utf8');

/** Value of a custom property declared in a stylesheet, or null. */
function declared(source: string, name: string): string | null {
  const m = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(source);
  return m ? m[1].trim() : null;
}

const NAMESPACE =
  /--vt-(?:action|evidence|frost|atmos|scene|paper|space|radius-(?:control|card|chip))(?:-[a-z0-9-]+)?(?=\s*['"]?\s*:)/g;

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');

describe('D′-01 semantic token bridge', () => {
  it('declares every namespace token exactly once in semantic.css', () => {
    const names = [...stripComments(semantic).matchAll(NAMESPACE)].map((m) => m[0]);
    expect(names.length).toBeGreaterThan(0);
    const seen = new Map<string, number>();
    for (const n of names) seen.set(n, (seen.get(n) ?? 0) + 1);
    const dupes = [...seen].filter(([, count]) => count > 1);
    expect(dupes, `duplicated declarations: ${dupes.map(([n]) => n).join(', ')}`).toEqual([]);
  });

  it('declares the namespaces nowhere else in apps/web', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const abs = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (['node_modules', '.next', '.turbo', 'dist', '__tests__'].includes(entry.name)) continue;
          walk(abs);
          continue;
        }
        if (!/\.(css|ts|tsx|js|jsx)$/.test(entry.name)) continue;
        const rel = relative(WEB_ROOT, abs).split('\\').join('/');
        if (rel === SEMANTIC_REL) continue;
        if (statSync(abs).size > 2_000_000) continue;
        const src = stripComments(readFileSync(abs, 'utf8'));
        if (NAMESPACE.test(src)) offenders.push(rel);
        NAMESPACE.lastIndex = 0;
      }
    };
    for (const root of ['styles', 'app', 'components']) walk(join(WEB_ROOT, root));
    expect(offenders, 'semantic namespaces re-declared outside the bridge').toEqual([]);
  });

  it('holds ruling 1: paper acts, green reports', () => {
    expect(declared(semantic, '--vt-evidence')).toBe('#4ade97');
    expect(declared(semantic, '--vt-evidence-deep')).toBe('#2e9e6b');
    const actionBg = declared(semantic, '--vt-action-primary-bg');
    expect(actionBg).toBe('#f6f5f1');
    expect(declared(semantic, '--vt-action-primary-fg')).toBe('#151412');
    expect(actionBg).not.toBe(declared(semantic, '--vt-evidence'));
  });

  it('holds the unruled knobs at their EC-20 locked values until D′-09', () => {
    expect(declared(semantic, '--vt-radius-control')).toBe('2px');
    expect(declared(semantic, '--vt-radius-card')).toBe('3px');
    expect(declared(semantic, '--vt-radius-chip')).toBe('2px');
    expect(declared(semantic, '--vt-frost-filter')).toBe('none');
    expect(declared(semantic, '--vt-atmos-display')).toBe('none');
  });

  it('maps to the shipped warm family in easy-home.css', () => {
    expect(declared(semantic, '--vt-scene-canvas')).toBe(declared(easyHome, '--ezh-ground'));
    expect(declared(semantic, '--vt-scene-ink')).toBe(declared(easyHome, '--ezh-text'));
    expect(declared(semantic, '--vt-scene-paper')).toBe(declared(easyHome, '--ezh-light'));
    expect(declared(semantic, '--vt-paper-ground')).toBe(declared(easyHome, '--ezh-light'));
    expect(declared(semantic, '--vt-paper-ink')).toBe(declared(easyHome, '--ezh-light-text'));
    expect(declared(semantic, '--vt-evidence')).toBe(declared(easyHome, '--ezh-work'));
  });

  it('contains no third-party reference-palette hex', () => {
    expect(semantic).not.toMatch(/#(?:0a0a0a|161616|d4d4d4|ededed|c2c2c2|686868|b2b2b2|e5e5e5|6b62f2)\b/i);
  });

  it('is the terminal @import in globals.css', () => {
    const imports = [...globalsCss.matchAll(/^@import\s+'([^']+)';/gm)].map((m) => m[1]);
    expect(imports.filter((i) => i.includes('tokens/semantic.css'))).toHaveLength(1);
    expect(imports[imports.length - 1]).toBe('../styles/tokens/semantic.css');
  });
});
