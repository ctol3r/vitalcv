import {
  SystemOutputPrecisionError,
  validateClaim,
} from '../systemOutputValidator';

describe('agent truth validation', () => {
  it('fails every blocked overclaim', () => {
    const blockedClaims = [
      'cryptographically verified',
      'trustless verification',
      'provably secure',
      'blockchain anchored proof',
      'securely cryptographically validated',
      'trust-less verification',
      'block-chain receipt',
    ] as const;

    for (const claim of blockedClaims) {
      try {
        validateClaim(claim);
        throw new Error(`Overclaim passed validation: ${claim}`);
      } catch (error) {
        expect(error).toBeInstanceOf(SystemOutputPrecisionError);
      }
    }
  });

  it('passes compliant source-backed phrasing', () => {
    const allowedClaims = [
      'verified against source',
      'source-confirmed',
      'checked in this run',
      'checked via NPPES',
    ] as const;

    for (const claim of allowedClaims) {
      expect(validateClaim(claim)).toBe(claim);
    }
  });

  it('passes explicit negations and embedded non-claims', () => {
    const allowedClaims = [
      'No cryptography is used in this summary.',
      'This packet is generated without cryptography.',
      'This surface is not cryptographically verified.',
      'This surface is not cryptographically validated.',
      'This workflow is not secure.',
      'This summary is not reliable yet.',
      'A postcrypto workflow description is included.',
      'The crypt team reviewed this source.',
    ] as const;

    for (const claim of allowedClaims) {
      expect(validateClaim(claim)).toBe(claim);
    }
  });

  it('fails contextual claims without evidence and passes them with evidence', () => {
    const contextualClaims = [
      'This is a secure workflow.',
      'This is a trusted handoff.',
      'This is a reliable result.',
    ] as const;

    for (const claim of contextualClaims) {
      expect(() => validateClaim(claim)).toThrow(SystemOutputPrecisionError);
      expect(validateClaim(claim, { supportingEvidence: true })).toBe(claim);
    }
  });
});
