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
    'apps/web/app/interview/page.tsx',
    'apps/web/components/employer/VerifierPortal.tsx',
    'apps/web/components/employer/TrustStatePanel.tsx',
    'apps/web/components/review/ReviewClient.tsx',
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

describe('public surface truth guards — post-release drift prevention', () => {
  const publicSurfaces = [
    'apps/web/app/interview/page.tsx',
    'apps/web/components/layout/Navbar.tsx',
    'apps/web/components/marketing/Navbar.tsx',
    'apps/web/components/marketing/HomeSections.tsx',
    'apps/web/components/hero/ReadinessPreview.tsx',
    'apps/web/app/explore/page.tsx',
    'apps/web/app/labs/page.tsx',
  ];

  function readPublic(): string {
    return publicSurfaces.map((f) => readFile(f)).join('\n');
  }

  it('does not contain verified-overclaiming strings on public surfaces', () => {
    const combined = readPublic().toLowerCase();

    expect(combined).not.toContain('real verified readiness');
    expect(combined).not.toContain('verified readiness');
    expect(combined).not.toContain('primary sources verify you');
  });

  it('does not use "Get Verified" as a nav or CTA label on public surfaces', () => {
    const combined = readPublic();

    // "Get Verified" is an overclaim — nav should say "Get Ready" or "Get Started"
    expect(combined).not.toContain('>Get Verified<');
    expect(combined).not.toContain('"Get Verified"');
    expect(combined).not.toContain("'Get Verified'");
    expect(combined).not.toContain('label="Get Verified"');
  });

  it('does not use "Ready in this run" framing in readiness surfaces', () => {
    const readinessSrc = readFile('apps/web/components/hero/ReadinessPreview.tsx');

    expect(readinessSrc).not.toContain('Ready in this run');
  });

  it('interview blocked state does not imply verified readiness', () => {
    const interviewSrc = readFile('apps/web/app/interview/page.tsx').toLowerCase();

    expect(interviewSrc).not.toContain('real verified readiness');
    expect(interviewSrc).not.toContain('verified readiness');
  });
});
