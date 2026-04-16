import { describe, expect, it } from 'vitest';
import { assertValidUIText, validateUIText } from '@/lib/truth/ui-claim-validator';

describe('ui claim validator', () => {
  it('rejects cryptographic overclaims without exposed proof', () => {
    const result = validateUIText('This profile is cryptographically verified and ready to trust.');

    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.message).toContain('verified against [source]');
  });

  it('allows cryptographic wording only when the proof is externally verifiable', () => {
    expect(() => assertValidUIText(
      'The credential is cryptographically verified.',
      {
        signatureExposed: true,
        externallyVerifiable: true,
      },
    )).not.toThrow();
  });

  it('accepts compliant source-backed language', () => {
    expect(() => assertValidUIText('License verified against NPPES.')).not.toThrow();
    expect(() => assertValidUIText('Medical license checked via State Board.')).not.toThrow();
    expect(() => assertValidUIText('Enrollment is source-confirmed.')).not.toThrow();
  });
});
