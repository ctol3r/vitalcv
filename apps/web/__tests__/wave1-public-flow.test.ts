import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MARKETING_ROOT = path.resolve(__dirname, '../../marketing');

function readMarketing(relativePath: string): string {
  return fs.readFileSync(path.join(MARKETING_ROOT, relativePath), 'utf8');
}

describe('marketing public flow copy and NPI routing', () => {
  it('routes marketing NPI submissions into the web app', () => {
    // /passport is a permanent 307 stub since 2026-08-07 (#1096): bare
    // /passport lands on /onboarding. The marketing link keeps working via
    // that hop; retargeting NpiInput straight at /onboarding is a
    // marketing-side change and stays out of web cleanup waves.
    expect(readMarketing('components/marketing/NpiInput.tsx')).toContain("buildWebAppUrl('/passport'");
  });

  it('keeps marketing hero and NPI form copy free of banned overclaims', () => {
    const source = [
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
