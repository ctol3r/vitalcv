import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_ROOT = path.resolve(__dirname, '..');
const MARKETING_ROOT = path.resolve(__dirname, '../../marketing');

function readWeb(relativePath: string): string {
  return fs.readFileSync(path.join(WEB_ROOT, relativePath), 'utf8');
}

function readMarketing(relativePath: string): string {
  return fs.readFileSync(path.join(MARKETING_ROOT, relativePath), 'utf8');
}

describe('Wave 1 public pilot flow copy and NPI routing', () => {
  it('routes marketing NPI submissions to the canonical passport intake', () => {
    expect(readWeb('components/marketing/NpiLookupInput.tsx')).toContain('router.push(buildPassportLookupHref(trimmed))');
    expect(readWeb('components/marketing/Hero.tsx')).toContain('router.push(buildPassportLookupHref(normalizedNpi))');
    expect(readWeb('components/marketing/HeroSection.tsx')).toContain('router.push(buildPassportLookupHref(normalizedNpi))');
    expect(readMarketing('components/marketing/NpiInput.tsx')).toContain("buildWebAppUrl('/passport'");
  });

  it('keeps Hero and NPI form copy free of banned overclaims', () => {
    const source = [
      readWeb('components/hero/LiveTrustConsole.tsx'),
      readWeb('components/marketing/Hero.tsx'),
      readWeb('components/marketing/HeroSection.tsx'),
      readWeb('components/marketing/NpiLookupInput.tsx'),
      readMarketing('components/marketing/HeroSection.tsx'),
      readMarketing('components/marketing/NpiInput.tsx'),
    ].join('\n');

    for (const phrase of [
      'zero-trust ledger',
      'hire instantly',
      'SOC 2 certified',
      'NCQA certified',
      'SOC 2',
      'NCQA',
      'HIPAA certified',
      'blockchain-anchored',
      'zero-knowledge proof',
      'NPDB check cleared',
      'all 50 states',
      'permanent record',
      'Clearance State: PASS',
      'artifact chain validated',
      '99.97%',
      'Verify once.',
      'Keep forever.',
      '/clinician?npi=',
      '/readiness?npi=',
    ]) {
      expect(source).not.toContain(phrase);
    }
  });
});
