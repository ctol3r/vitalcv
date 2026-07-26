/**
 * verification-transcript.test.tsx — W5.
 *
 * Guards the parser (verified / failed / pending from the backend string[])
 * and the component (located fail-closed mismatch, no generic "verification
 * failed", no bare "Verified").
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { parseVerificationSteps } from '@/lib/audit/verificationTranscript';
import { VerificationTranscript } from '@/design-system/components';

const VERIFIED = [
  'Start: leaf = a1b9f2c4',
  'Level 1: H(a1b9f2c4… || 7f3c8d21…) = 5e2a91c4…',
  'Root matches: 4d2e91f0 ✓',
];
const FAILED = [
  'Start: leaf = 8f2ac41b',
  'Level 1: H(8f2ac41b… || 7f3c8d21…) = 1a2b3c4d…',
  'Root MISMATCH — expected 4d2e91f0',
];
const PENDING = ['Start: leaf = a1b9f2c4', 'Level 1: H(…) = …'];

describe('parseVerificationSteps', () => {
  it('parses a matching root as verified', () => {
    const p = parseVerificationSteps(VERIFIED);
    expect(p.result).toBe('verified');
    expect(p.steps[0].kind).toBe('start');
    expect(p.steps[1].kind).toBe('level');
    expect(p.steps[2].kind).toBe('root');
    expect(p.steps[2].status).toBe('ok');
  });

  it('parses a MISMATCH as failed, with the root step marked fail', () => {
    const p = parseVerificationSteps(FAILED);
    expect(p.result).toBe('failed');
    expect(p.steps.find((s) => s.kind === 'root')?.status).toBe('fail');
  });

  it('is pending when there is no root comparison', () => {
    expect(parseVerificationSteps(PENDING).result).toBe('pending');
  });
});

describe('VerificationTranscript — render', () => {
  it('renders a verified inclusion proof', () => {
    const html = renderToStaticMarkup(<VerificationTranscript steps={VERIFIED} root="4d2e…" />);
    expect(html).toContain('data-transcript-result="verified"');
    expect(html).toContain('Inclusion verified');
    expect(html).toContain('Root matches');
  });

  it('fails closed and locates the mismatch — never generic', () => {
    const html = renderToStaticMarkup(<VerificationTranscript steps={FAILED} />);
    expect(html).toContain('data-transcript-result="failed"');
    expect(html).toContain('integrity failure located');
    expect(html).toContain('Root MISMATCH');
    expect(html).toContain('data-transcript-step="fail"');
    // Not a generic message.
    expect(html.toLowerCase()).not.toContain('verification failed');
  });

  it('accepts a pre-parsed transcript', () => {
    const html = renderToStaticMarkup(<VerificationTranscript steps={parseVerificationSteps(VERIFIED)} />);
    expect(html).toContain('data-transcript-result="verified"');
  });

  it('never renders the bare status word "Verified"', () => {
    const html = renderToStaticMarkup(<VerificationTranscript steps={VERIFIED} />);
    expect(/>\s*Verified\s*</.test(html)).toBe(false);
  });
});
