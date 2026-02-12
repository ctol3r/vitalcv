import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

function readFile(relativePath: string): string {
  const absolutePath = path.resolve(__dirname, '../../..', relativePath);
  return fs.readFileSync(absolutePath, 'utf8');
}

describe('wording safety guards', () => {
  it('does not include high-risk clearance language in intake/verifier UI copy', () => {
    const intake = readFile('apps/web/app/intake/page.tsx').toLowerCase();
    const verifier = readFile('apps/web/app/verifier/page.tsx').toLowerCase();
    const combined = `${intake}\n${verifier}`;

    expect(combined).not.toContain('you are cleared to start');
    expect(combined).not.toContain('ready to start');
    expect(combined).not.toContain('good standing');
    expect(combined).not.toContain('trust score');
    expect(combined).not.toContain('clear to start');
  });

  it('includes explicit conditional start-ready clarification text', () => {
    const intake = readFile('apps/web/app/intake/page.tsx');
    const verifier = readFile('apps/web/app/verifier/page.tsx');

    const required =
      'PSV complete. Employer acceptance and start attestation still required.';

    expect(intake).toContain(required);
    expect(verifier).toContain(required);
  });
});
