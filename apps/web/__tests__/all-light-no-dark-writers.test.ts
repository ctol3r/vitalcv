import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * VitalCV is light-only (Chris, 2026-07-15). `providers.tsx` pins next-themes
 * with `forcedTheme="light"`, but that only governs themes set *through*
 * next-themes — it cannot stop code that writes the `dark` class straight onto
 * `document.documentElement`. Two components did exactly that (the marketing
 * Hero toggle and the sandbox theme effect), so a dark page was still
 * reachable despite the forced theme.
 *
 * This asserts the OUTCOME — no shipped source can put the app in dark mode —
 * rather than naming the two components that used to. A future component that
 * reintroduces the behavior fails here even though it is not mentioned by name.
 */

const WEB_ROOT = join(__dirname, '..');
const SCAN_ROOTS = ['app', 'components', 'lib', 'hooks'];
const SCANNABLE = new Set(['.ts', '.tsx', '.js', '.jsx']);

// Writes the dark class onto the document/root element, in any quoting style.
const DARK_WRITER =
  /(?:document\.documentElement|document\.body|documentElement)\s*\.classList\s*\.\s*(?:add|toggle)\s*\(\s*['"`]dark['"`]/;

// `setTheme('dark')` / `defaultTheme="dark"` — asking next-themes for dark.
const DARK_THEME_REQUEST = /(?:setTheme\s*\(\s*['"`]dark['"`]|defaultTheme\s*=\s*['"`]dark['"`])/;

function walk(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(abs, out);
      continue;
    }
    if (!statSync(abs).isFile()) continue;
    const dot = entry.name.lastIndexOf('.');
    if (dot < 0 || !SCANNABLE.has(entry.name.slice(dot))) continue;
    if (/\.(test|spec|stories)\.[cm]?[tj]sx?$/.test(entry.name)) continue;
    out.push(abs);
  }
  return out;
}

const FILES = SCAN_ROOTS.flatMap((root) => walk(join(WEB_ROOT, root)));

describe('all-light: nothing shipped may force dark mode', () => {
  it('scans a non-trivial number of source files', () => {
    // Guards the guard: a broken walk would make every assertion below vacuous.
    expect(FILES.length).toBeGreaterThan(100);
  });

  it('no source writes the dark class onto the document element', () => {
    const offenders = FILES.filter((file) =>
      DARK_WRITER.test(readFileSync(file, 'utf8')),
    ).map((file) => relative(WEB_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it('no source asks next-themes for the dark theme', () => {
    const offenders = FILES.filter((file) =>
      DARK_THEME_REQUEST.test(readFileSync(file, 'utf8')),
    ).map((file) => relative(WEB_ROOT, file));

    expect(offenders).toEqual([]);
  });
});
