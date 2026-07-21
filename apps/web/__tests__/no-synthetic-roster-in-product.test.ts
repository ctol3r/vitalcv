import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C2 — the synthetic roster may never be reachable from product code.
 *
 * `__tests__/fixtures/career-graph-roster.ts` holds 14 invented `Dr. …`
 * entries. They previously lived at `components/career-graph/data.ts`, one
 * import away from any surface — on a product whose entire claim is that it
 * does not overstate, fake clinicians importable from `components/` are a
 * standing hazard.
 *
 * Moving the file fixed today. This guard fixes tomorrow: it fails the build if
 * any non-test source file references the fixture, so the roster cannot walk
 * back into the product the way it walked in the first time.
 */

const WEB_ROOT = process.cwd();

/** Product source roots — everything that can ship to a user. */
const PRODUCT_DIRS = ['app', 'components', 'lib', 'hooks'] as const;

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

/** Any reference to the fixture, by module specifier or bare filename. */
const FIXTURE_REFERENCE = /career-graph-roster|career-graph\/data/;

/** A test living inside a product dir is still a test. */
const TEST_FILE = /\.(test|spec)\.[jt]sx?$|__tests__|__mocks__/;

function collectSourceFiles(dir: string): string[] {
  const absolute = path.join(WEB_ROOT, dir);
  if (!fs.existsSync(absolute)) return [];

  const found: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue;
        walk(full);
        continue;
      }
      if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
      const relative = path.relative(WEB_ROOT, full);
      if (TEST_FILE.test(relative)) continue;
      found.push(relative);
    }
  };
  walk(absolute);
  return found;
}

describe('C2 — synthetic roster stays quarantined', () => {
  const productFiles = PRODUCT_DIRS.flatMap(collectSourceFiles);

  it('scans a real set of product files (guard cannot silently pass on zero)', () => {
    // If a refactor moves these directories this number collapses and the
    // guard would "pass" while checking nothing. Fail loudly instead.
    expect(productFiles.length).toBeGreaterThan(100);
  });

  it('no product file imports or references the synthetic roster fixture', () => {
    const offenders = productFiles.filter((relative) =>
      FIXTURE_REFERENCE.test(fs.readFileSync(path.join(WEB_ROOT, relative), 'utf8')),
    );

    expect(
      offenders,
      `Synthetic clinician fixture referenced from product code:\n${offenders.join('\n')}\n\n` +
        'These are invented people. Use real data or an explicitly illustrative, ' +
        'labelled surface — never this fixture.',
    ).toEqual([]);
  });

  it('the fixture is where the guard thinks it is', () => {
    // Pins the path the sibling quarantine guard reads via fs.
    const fixture = path.join(WEB_ROOT, '__tests__/fixtures/career-graph-roster.ts');
    expect(fs.existsSync(fixture)).toBe(true);
    expect(fs.readFileSync(fixture, 'utf8')).toContain('SYNTHETIC DATA');
  });

  it('the deleted CareerGraph component has not returned', () => {
    expect(fs.existsSync(path.join(WEB_ROOT, 'components/career-graph'))).toBe(false);
  });
});
