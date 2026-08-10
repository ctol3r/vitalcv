/**
 * apply-disclosure-contract.test.ts — A4 (Apply with VitalCV).
 *
 * The consent surface (ApplyModal) previews a section list; the seal builds
 * the packet from the backend's APPLICATION_DISCLOSURE_SECTIONS. Before A4
 * these were two independent literals that merely happened to agree — the
 * modal could claim "exactly these sections" while drifting freely from what
 * a submission actually sealed. This contract pins them together, and pins
 * the surrounding truth: identity stays required, the default selection is
 * the backend's full-disclosure default, and no clinician role surface
 * renders a bare magic number.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DISCLOSURE_SECTIONS } from '../components/explore/ApplyModal';

const WEB_ROOT = resolve(__dirname, '..');
const BACKEND_DISCLOSURE = resolve(
  WEB_ROOT,
  '../../apps/api/backend/src/services/opportunities/applicationDisclosure.ts',
);

/** Extract the backend's section ids from source — the sealing vocabulary of record. */
function backendSectionIds(): string[] {
  const source = readFileSync(BACKEND_DISCLOSURE, 'utf-8');
  const match = source.match(
    /APPLICATION_DISCLOSURE_SECTIONS\s*=\s*\[([^\]]+)\]/,
  );
  if (!match) throw new Error('APPLICATION_DISCLOSURE_SECTIONS not found in backend source');
  return [...match[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

describe('the consent preview and the sealer share one section vocabulary', () => {
  it('ApplyModal presents exactly the sections the backend seals', () => {
    const backend = backendSectionIds();
    expect(backend.length).toBeGreaterThan(0);
    expect(new Set(DISCLOSURE_SECTIONS.map((s) => s.id))).toEqual(new Set(backend));
  });

  it('identity remains the one required section', () => {
    const required = DISCLOSURE_SECTIONS.filter((s) => s.required).map((s) => s.id);
    expect(required).toEqual(['identity']);
  });

  it('every presented section carries a plain-language consequence', () => {
    for (const section of DISCLOSURE_SECTIONS) {
      expect(section.label.length).toBeGreaterThan(0);
      expect(section.detail.length).toBeGreaterThan(10);
    }
  });
});

/** Clinician role-discovery and apply surfaces: no bare magic numbers. */
const NO_SCORE_SURFACES = [
  'app/holder/opportunities',
  'components/mobile/ClinicianPanels.tsx',
  'components/explore/ApplyModal.tsx',
  'components/matcha-deck',
];

function sourceFilesUnder(path: string): string[] {
  const stats = statSync(path, { throwIfNoEntry: false });
  if (!stats) return [];
  if (stats.isFile()) return [path];
  const out: string[] = [];
  for (const entry of readdirSync(path)) {
    out.push(...sourceFilesUnder(join(path, entry)));
  }
  return out.filter((f) => /\.(ts|tsx)$/.test(f) && !/\.(test|spec)\./.test(f));
}

describe('clinician role surfaces explain fit — never a magic number', () => {
  it.each(NO_SCORE_SURFACES)('%s renders no bare score', (surface) => {
    const offenders = sourceFilesUnder(join(WEB_ROOT, surface)).filter((file) => {
      const source = readFileSync(file, 'utf-8');
      return /\}\s*\/\s*100|\/100|Score:\s*\{/.test(source.replace(/\/\/[^\n]*/g, ''));
    });
    expect(
      offenders,
      `bare score render found in:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });
});
