import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * DESIGN.md is generated from the token CSS. This is the gate that keeps that
 * true.
 *
 * The whole argument for having a DESIGN.md at all was that a hand-written one
 * becomes the seventh place values live — the repo already has `--vt-*` spread
 * over six files, and a canonical DESIGN_SYSTEM.md describing a three-file
 * architecture that was never shipped. A generated document with no freshness
 * gate decays into exactly the same thing, just faster, because it LOOKS
 * authoritative.
 *
 * So: regenerate, diff, fail. Editing a token without regenerating turns the
 * suite red.
 */
const REPO = join(import.meta.dirname, '../../..');
const SCRIPT = join(REPO, 'scripts/generate-design-md.ts');
const DOC = join(REPO, 'DESIGN.md');

describe('DESIGN.md is generated, not written', () => {
  it('the generator and the document both exist', () => {
    expect(existsSync(SCRIPT), 'scripts/generate-design-md.ts').toBe(true);
    expect(existsSync(DOC), 'DESIGN.md').toBe(true);
  });

  it('is current with the token files', () => {
    // --check exits non-zero and prints the fix command when stale.
    let failed = false;
    let output = '';
    try {
      output = execFileSync(
        process.execPath,
        ['--experimental-strip-types', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', SCRIPT, '--check'],
        { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } catch (err) {
      failed = true;
      output = String((err as { stderr?: string; stdout?: string }).stderr ?? '') +
        String((err as { stdout?: string }).stdout ?? '');
    }
    expect(
      failed,
      `DESIGN.md is stale. Run:\n  node --experimental-strip-types scripts/generate-design-md.ts\n${output}`,
    ).toBe(false);
  });

  it('says it is generated, so nobody hand-edits it', () => {
    expect(readFileSync(DOC, 'utf8')).toContain('GENERATED — do not edit by hand');
  });

  it('points at the governing docs rather than restating their values', () => {
    const md = readFileSync(DOC, 'utf8');
    expect(md).toContain('VITALCV_EXPERIENCE_CONSTITUTION.md');
    expect(md).toContain('EC-20');
    // The failure this guards: a generated doc that starts asserting brand
    // decisions becomes a competing authority, which is the 1505-vs-EC-20
    // conflict all over again.
    expect(md).toContain('points, never restates');
  });
});
