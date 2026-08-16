import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Glass gate — EC-20 "Glass treatment", **as amended A-1 (2026-08-09)**.
 *
 * WHAT THIS FILE GOT WRONG THE FIRST TIME. Its original version enforced a
 * blanket ban and cited EC-20 *"Glass treatment: None"*. **A-1 superseded that
 * row the day before it was written.** Read from `origin/main`:
 *
 *   Frost is permitted on chrome and scene overlays only — `--vt-frost-bg` /
 *   `--vt-frost-border`, both `color-mix` over scene surfaces, so the effect
 *   degrades to a solid panel wherever `backdrop-filter` is unsupported.
 *   Evidence surfaces stay solid: no frost on a proof row, artifact, receipt,
 *   or any surface a decision is read from.
 *
 * That version was not merely stale, it was **costly**: it failed lawful A-1
 * frost in `styles/band-system-components.css` (148 against a baseline of 147),
 * and the author of that work correctly declined to widen someone else's
 * baseline, withholding the blur instead. A guard enforcing repealed doctrine
 * silently converts permitted work into blocked work.
 *
 * The gate now encodes the amended clause in three parts:
 *
 *   1. EVIDENCE SURFACES STAY SOLID — glass on a proof/receipt/artifact/verify
 *      surface that is not already frozen below FAILS. This is A-1's surviving
 *      limit and the part that protects a decision being read from a screen.
 *   2. CHROME AND SCENE OVERLAYS may frost — listed explicitly in
 *      `glass-frost-allowlist.json`, each required to carry a degradation path
 *      (`color-mix` or `@supports`), which is A-1's own condition.
 *   3. THE UNREVIEWED TAIL is ratcheted — everything else cannot grow, so the
 *      sequenced retirement is not undone while it runs. (An earlier revision
 *      cited docs/design/glass-retirement-scope-2026-08-10.md here — that file
 *      never existed on main; the authorities are `glass-frost-allowlist.json`
 *      and the EC-20 glass row as amended A-1/E.)
 *
 * Regenerate the tail baseline after a genuine reduction:
 *   UPDATE_GLASS_BASELINE=1 pnpm exec vitest run __tests__/glass-ratchet.test.ts
 *
 * WHAT THIS DOES NOT DO
 *   It counts declarations, not painted pixels, and classifies surfaces by path
 *   — a heuristic. A frosted proof row in a file whose name suggests chrome
 *   would pass. It stops the bleed and protects the evidence class; it is not
 *   evidence of compliance. Measure the rendered surface before claiming that.
 *
 * UNCHANGED BY A-2: EC-10 lists `backdrop-blur-navbar-with-thin-line` under
 * "Banned forms (unchanged)" and EC-10 is Class A. Frosting the chrome is
 * lawful; rebuilding the blurred-bar-with-a-rule composite is not.
 */

const APP_ROOT = path.join(__dirname, '..');
const BASELINE_PATH = path.join(__dirname, 'glass-ratchet.baseline.json');
const ALLOWLIST_PATH = path.join(__dirname, 'glass-frost-allowlist.json');

const SCAN_ROOTS = ['app', 'components', 'styles', 'design-system', 'stories'];
const SKIP = /node_modules|[\\/]\.next|[\\/]\.turbo/;
const EXTENSIONS = new Set(['.tsx', '.ts', '.css']);

const UTILITY = /\b(?:backdrop-)?blur-(?:xs|sm|md|lg|xl|2xl|3xl)\b/g;
const RAW = /(?:backdrop-filter\s*:[^;}]*blur\(|filter\s*:[^;}]*blur\()/g;

/** Surfaces a decision is read from. A-1 is explicit that these stay solid. */
const EVIDENCE = /(proof|receipt|artifact|verif|passport|dossier|credential|evidence)/i;

const allowlist: {
  frostPermitted: Record<string, string>;
  evidenceUnreviewed: Record<string, string>;
} = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));

const FROST_OK = new Set(Object.keys(allowlist.frostPermitted));
const EVIDENCE_KNOWN = new Set(Object.keys(allowlist.evidenceUnreviewed));

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (SKIP.test(full)) continue;
    if (entry.isDirectory()) walk(full, acc);
    else if (EXTENSIONS.has(path.extname(entry.name))) acc.push(full);
  }
  return acc;
}

type Scan = { counts: Record<string, number>; evidenceHits: string[] };

function scan(): Scan {
  const counts: Record<string, number> = {};
  const evidenceHits: string[] = [];

  for (const root of SCAN_ROOTS) {
    const abs = path.join(APP_ROOT, root);
    if (!fs.existsSync(abs)) continue;
    for (const file of walk(abs)) {
      const rel = path.relative(APP_ROOT, file).split(path.sep).join('/');
      const src = fs.readFileSync(file, 'utf8');
      const n = (src.match(UTILITY)?.length ?? 0) + (src.match(RAW)?.length ?? 0);
      if (n === 0) continue;

      if (EVIDENCE.test(rel)) {
        evidenceHits.push(rel);
        continue;
      }
      if (FROST_OK.has(rel)) continue; // A-1: chrome / scene overlay
      counts[rel] = n;
    }
  }
  return { counts, evidenceHits };
}

const sum = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);

describe('glass gate — EC-20 "Glass treatment" as amended A-1', () => {
  const { counts: current, evidenceHits } = scan();

  if (process.env.UPDATE_GLASS_BASELINE === '1') {
    const sorted = Object.fromEntries(Object.keys(current).sort().map((k) => [k, current[k]]));
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
  }

  const baseline: Record<string, number> = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));

  it('adds no glass to an evidence surface (A-1)', () => {
    const fresh = evidenceHits.filter((rel) => !EVIDENCE_KNOWN.has(rel));
    expect(
      fresh,
      'A-1: "Evidence surfaces stay solid: no frost on a proof row, artifact, receipt, ' +
        `or any surface a decision is read from."\n  ${fresh.join('\n  ')}\n` +
        'If this surface is genuinely chrome or a scene overlay, move it to frostPermitted ' +
        'with a reason. Do not add it to evidenceUnreviewed — that list exists to shrink.',
    ).toEqual([]);
  });

  it('does not grow the frozen evidence backlog', () => {
    // A queue, not an allowance. It may shrink; it may never grow.
    expect(EVIDENCE_KNOWN.size).toBeLessThanOrEqual(7);
  });

  it('keeps the evidence backlog honest — every entry still carries glass', () => {
    // A stale entry would let a genuinely new violation hide behind an old name.
    const stale = [...EVIDENCE_KNOWN].filter((rel) => !evidenceHits.includes(rel));
    expect(
      stale,
      `Listed as unreviewed evidence glass but no longer matching — remove from the list:\n  ${stale.join('\n  ')}`,
    ).toEqual([]);
  });

  it('requires every frost-permitted file to degrade (A-1 condition)', () => {
    const undegraded = [...FROST_OK].filter((rel) => {
      const abs = path.join(APP_ROOT, rel);
      if (!fs.existsSync(abs)) return false;
      const src = fs.readFileSync(abs, 'utf8');
      return !/color-mix\(/.test(src) && !/@supports/.test(src);
    });
    expect(
      undegraded,
      'A-1 requires frost to degrade to a solid panel where backdrop-filter is ' +
        `unsupported (color-mix or @supports):\n  ${undegraded.join('\n  ')}`,
    ).toEqual([]);
  });

  it('lists only files that exist on the frost allowlist', () => {
    const missing = [...FROST_OK].filter((rel) => !fs.existsSync(path.join(APP_ROOT, rel)));
    expect(missing, `Allowlist names files that do not exist:\n  ${missing.join('\n  ')}`).toEqual([]);
  });

  it('introduces no glass in unreviewed files that had none', () => {
    const introduced = Object.keys(current).filter((f) => !(f in baseline));
    expect(
      introduced,
      `New glass in ${introduced.length} unreviewed file(s):\n  ${introduced.join('\n  ')}\n` +
        'If this surface is chrome or a scene overlay, A-1 permits frost — add it to ' +
        '__tests__/glass-frost-allowlist.json with a reason, built from color-mix so it ' +
        'degrades. If it is an evidence surface, it must stay solid.',
    ).toEqual([]);
  });

  it('increases glass in no existing unreviewed file', () => {
    const grown = Object.keys(current)
      .filter((f) => f in baseline && current[f] > baseline[f])
      .map((f) => `${f}: ${baseline[f]} → ${current[f]}`);
    expect(grown, `Glass count increased:\n  ${grown.join('\n  ')}`).toEqual([]);
  });

  it('does not increase the unreviewed total', () => {
    expect(sum(current)).toBeLessThanOrEqual(sum(baseline));
  });

  it('reports reductions so the baseline can be tightened', () => {
    const removed = Object.keys(baseline).filter((f) => !(f in current));
    const shrunk = Object.keys(current).filter((f) => f in baseline && current[f] < baseline[f]);
    if (removed.length || shrunk.length) {
      console.info(
        `[glass gate] reduced: ${removed.length} file(s) cleared, ${shrunk.length} lowered, ` +
          `total ${sum(baseline)} → ${sum(current)}. ` +
          'Re-baseline with UPDATE_GLASS_BASELINE=1 so the ratchet tightens.',
      );
    }
    expect(true).toBe(true);
  });
});
