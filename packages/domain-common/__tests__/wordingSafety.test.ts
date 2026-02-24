import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

function readFile(relativePath: string): string {
  const absolutePath = path.resolve(__dirname, '../../..', relativePath);
  return fs.readFileSync(absolutePath, 'utf8');
}

describe('wording safety guards', () => {
  const uiFiles = [
    'apps/web/app/intake/page.tsx',
    'apps/web/app/intake/IntakeContent.tsx',
    'apps/web/app/verifier/page.tsx',
    'apps/web/components/employer/VerifierPortal.tsx',
    'apps/web/components/employer/TrustStatePanel.tsx',
    'apps/web/components/clinician/intake-types.ts',
  ];

  function readAll(): string {
    return uiFiles.map((f) => readFile(f)).join('\n');
  }

  it('does not include high-risk clearance language in intake/verifier UI copy', () => {
    const combined = readAll().toLowerCase();

    expect(combined).not.toContain('you are cleared to start');
    expect(combined).not.toContain('ready to start');
    expect(combined).not.toContain('good standing');
    expect(combined).not.toContain('trust score');
    expect(combined).not.toContain('clear to start');
  });

  it('includes explicit conditional start-ready clarification text', () => {
    const combined = readAll();

    const required =
      'PSV complete. Employer acceptance and start attestation still required.';

    expect(combined).toContain(required);
  });
});
