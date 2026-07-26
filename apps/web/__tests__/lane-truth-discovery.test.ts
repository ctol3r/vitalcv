/**
 * Lane-truth discovery guard.
 *
 * `lib/trust/sourceLanes.ts` (NUM-1.5) is the designated single definition of
 * source-lane truth, and its header says: "Do not re-introduce a hand-written
 * lane list somewhere else."
 *
 * `source-lane-registry.test.ts` enforces that — but only against a FIXED LIST
 * of the four files NUM-1.5 replaced. That is the hole this file closes. Two
 * hand-written lane lists predated NUM-1.5 and were invisible to it, and they
 * drifted into publishing something false: `/trust/attribution` and
 * `/status/technical` both said OIG / LEIE and CMS PECOS were
 * `connector-not-live` while `/api/status` published both as operational. The
 * adapters were live the whole time (see #862). A fifth copy added tomorrow
 * would be equally invisible.
 *
 * So this guard DISCOVERS lane lists instead of naming them: any file that
 * pairs two or more canonical federal sources with a truth-state literal is a
 * lane list, and must either consume the registry or be an acknowledged
 * exception carrying a reason.
 *
 * It deliberately does not assert WHICH state each lane is in — that is
 * `source-lane-registry.test.ts`'s job for registry-bound surfaces, and a
 * design decision (a `scope` field on `SourceLaneOps`) for the exceptions. The
 * job here is narrower and durable: make a new copy of lane truth impossible
 * to add silently.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const WEB_ROOT = path.join(__dirname, '..');
const SCAN_DIRS = ['app', 'components'];

/** Truth-state literals that express a lane's availability. */
const STATE_LITERAL =
  /'(connector-not-live|auth-required|access-required|source-backed|temporarily-unavailable)'/;

/** Canonical federal source names, as they appear in human-facing copy. */
const SOURCE_NAME = /NPPES|OIG|LEIE|PECOS|FSMB|Nursys/g;

/** A file mentioning at least this many source names is describing a set. */
const SOURCE_THRESHOLD = 2;

/**
 * Hand-written lane lists that exist today, each with the reason it is not yet
 * registry-bound. Shrinking this list is the goal; growing it requires stating
 * why in review. Anything NOT on it must consume the registry.
 */
const ACKNOWLEDGED: ReadonlyArray<{ file: string; why: string }> = [
  {
    file: 'components/trust/TrustAttributionRegister.tsx',
    why: 'Per-field public attribution register. Corrected in #862 (OIG/PECOS were falsely connector-not-live). Binding it to the registry needs a scope field on SourceLaneOps — connector liveness and session-gating are different axes — which is a founder design decision.',
  },
  {
    file: 'components/status/ConnectorMatrix.tsx',
    why: 'Per-connector build-state matrix on /status/technical. Same #862 correction and the same scope blocker.',
  },
  {
    file: 'components/home/evidence-field/graph.ts',
    why: 'Decorative hero geometry: node positions plus labels. Its states have stayed accurate (monthly/quarterly snapshot), but it is still a fourth copy and should read the registry once a public-facing shape exists.',
  },
];

function walk(dir: string): string[] {
  const abs = path.join(WEB_ROOT, dir);
  const out: string[] = [];
  const visit = (d: string) => {
    for (const entry of readdirSync(d)) {
      if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
      const full = path.join(d, entry);
      if (statSync(full).isDirectory()) visit(full);
      else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
    }
  };
  visit(abs);
  return out;
}

function findLaneLists() {
  const found: string[] = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(dir)) {
      const src = readFileSync(file, 'utf8');
      if (!STATE_LITERAL.test(src)) continue;
      if ((src.match(SOURCE_NAME) ?? []).length < SOURCE_THRESHOLD) continue;
      found.push(path.relative(WEB_ROOT, file));
    }
  }
  return found.sort();
}

describe('lane truth has one home (discovery, not a fixed list)', () => {
  it('finds no unacknowledged hand-written lane list', () => {
    const acknowledged = new Set(ACKNOWLEDGED.map((a) => a.file));
    const offenders = findLaneLists().filter((f) => {
      if (acknowledged.has(f)) return false;
      // Consuming the registry is the correct outcome, not an exception.
      return !readFileSync(path.join(WEB_ROOT, f), 'utf8').includes('sourceLanes');
    });

    expect(
      offenders,
      'New hand-written source-lane list(s) found. Lane truth lives in ' +
        'lib/trust/sourceLanes.ts — import it. If a surface genuinely cannot ' +
        '(e.g. it needs a state the registry does not model yet), add it to ' +
        'ACKNOWLEDGED in this file with the reason.\n\n' +
        offenders.join('\n'),
    ).toEqual([]);
  });

  it('every acknowledged exception still exists and still carries a reason', () => {
    // Stops the list rotting into stale entries that silently permit nothing.
    for (const { file, why } of ACKNOWLEDGED) {
      expect(() => readFileSync(path.join(WEB_ROOT, file), 'utf8'), `${file} is listed but missing`).not.toThrow();
      expect(why.length, `${file} needs a real reason`).toBeGreaterThan(40);
    }
  });

  it('no acknowledged exception claims a live connector is not live', () => {
    // The exact #862 regression, pinned at the class level rather than per row:
    // OIG and PECOS adapters both reach live upstream sources, so no surface
    // may pair either with `connector-not-live` again.
    for (const { file } of ACKNOWLEDGED) {
      const src = readFileSync(path.join(WEB_ROOT, file), 'utf8');
      for (const lane of ['OIG', 'PECOS']) {
        const rows = src.split(/\n\s*\{/).filter((block) => block.includes(lane));
        for (const row of rows) {
          expect(
            /'connector-not-live'/.test(row),
            `${file}: a ${lane} row claims connector-not-live. Both adapters ` +
              'reach live upstream sources (OigLeieAdapter reads the HHS LEIE ' +
              'CSV unless OIG_LEIE_ENABLED=false; fetchPecos has no gate). ' +
              'The real boundary is the session — use auth-required.',
          ).toBe(false);
        }
      }
    }
  });
});
