import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MARKETING_ROOT = path.resolve(__dirname, '../../marketing');

function readMarketing(relativePath: string): string {
  return fs.readFileSync(path.join(MARKETING_ROOT, relativePath), 'utf8');
}

describe('marketing public flow copy and NPI routing', () => {
  it('routes marketing NPI submissions into the web app', () => {
    // The marketing origin targets /onboarding directly: the /passport stub
    // (#1096) 307s without forwarding ?npi=, so routing through it dropped
    // the NPI the visitor typed. /onboarding accepts ?npi= as the
    // cross-origin carrier (lib/onboarding/npiHandoff.ts).
    expect(readMarketing('components/marketing/NpiInput.tsx')).toContain("buildWebAppUrl('/onboarding'");
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
