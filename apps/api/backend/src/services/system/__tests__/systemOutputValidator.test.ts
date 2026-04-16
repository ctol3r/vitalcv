import {
  SystemOutputPrecisionError,
  assertOmegaDecisionObject,
  validateClaim,
  validateSystemOutput,
} from '../systemOutputValidator';

describe('systemOutputValidator', () => {
  it('fails when output uses blocked wording', () => {
    expect(() => validateSystemOutput({
      summary: 'This is an independent, real-time view of the inferred and verified provider score.',
    })).toThrow(SystemOutputPrecisionError);

    expect(() => validateSystemOutput({
      summary: 'This is an independent, real-time view of the inferred and verified provider score.',
    })).toThrow('Truth precision violation');
  });

  it('passes when wording stays factual and scoped', () => {
    const output = {
      summary: 'This report uses observed event timing from the selected pilot window.',
      details: [
        'Results are derived from recorded review and decision events.',
        'Coverage varies by source and freshness.',
        'Status checked in this run.',
        'License verified against source records.',
        'Enrollment is source-confirmed.',
      ],
    };

    expect(validateSystemOutput(output)).toBe(output);
  });

  it('reports the offending path and rule for recursive objects', () => {
    try {
      validateSystemOutput({
        sections: [
          { headline: 'Async queue with real-time updates.' },
        ],
      });
      throw new Error('expected validator to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(SystemOutputPrecisionError);
      expect((error as SystemOutputPrecisionError).violations).toEqual([
        expect.objectContaining({
          code: 'ambiguous_real_time_claim',
          path: 'output.sections[0].headline',
        }),
      ]);
    }
  });

  it('fails direct claim validation for cryptographic, security, and trustless overclaims', () => {
    expect(() => validateClaim('This credential is cryptographically verified.'))
      .toThrow(SystemOutputPrecisionError);
    expect(() => validateClaim('This credential is crypto-backed.'))
      .toThrow(SystemOutputPrecisionError);
    expect(() => validateClaim('This credential is block-chain backed.'))
      .toThrow(SystemOutputPrecisionError);
    expect(() => validateClaim('This workflow is provably secure.'))
      .toThrow(SystemOutputPrecisionError);
    expect(() => validateClaim('This handoff is trustless.'))
      .toThrow(SystemOutputPrecisionError);
  });

  it('passes direct claim validation for compliant phrasing and negated descriptions', () => {
    expect(validateClaim('The record was verified against source records.'))
      .toBe('The record was verified against source records.');
    expect(validateClaim('The source was checked via NPPES.'))
      .toBe('The source was checked via NPPES.');
    expect(validateClaim('The status is source-confirmed.'))
      .toBe('The status is source-confirmed.');
    expect(validateClaim('The source was checked in this run.'))
      .toBe('The source was checked in this run.');
    expect(validateClaim('No cryptography is used in this comparison copy.'))
      .toBe('No cryptography is used in this comparison copy.');
    expect(validateClaim('This workflow is not cryptographically verified.'))
      .toBe('This workflow is not cryptographically verified.');
    expect(validateClaim('This workflow is not cryptographically validated.'))
      .toBe('This workflow is not cryptographically validated.');
  });

  it('gates contextual claims on supporting evidence', () => {
    expect(() => validateClaim('This is a secure workflow.'))
      .toThrow(SystemOutputPrecisionError);
    expect(() => validateClaim('This is a trusted process.'))
      .toThrow(SystemOutputPrecisionError);
    expect(() => validateClaim('This is a reliable output.'))
      .toThrow(SystemOutputPrecisionError);

    expect(validateClaim('This is a secure workflow.', { supportingEvidence: true }))
      .toBe('This is a secure workflow.');
    expect(validateClaim('This is a trusted process.', { supportingEvidence: true }))
      .toBe('This is a trusted process.');
    expect(validateClaim('This is a reliable output.', { supportingEvidence: true }))
      .toBe('This is a reliable output.');
  });

  it('fails recursive output validation for tokenized overclaims', () => {
    expect(() => validateSystemOutput({
      sections: [
        { headline: 'This is securely cryptographically validated evidence.' },
        { detail: 'The chain is block-chain backed.' },
      ],
    })).toThrow(SystemOutputPrecisionError);
  });

  it('passes recursive output validation for negated descriptions', () => {
    const output = {
      sections: [
        { headline: 'This comparison uses no cryptography.' },
        { detail: 'The summary is not cryptographically validated.' },
      ],
    };

    expect(validateSystemOutput(output)).toBe(output);
  });

  it('fails recursive output validation for contextual claims without evidence', () => {
    expect(() => validateSystemOutput({
      sections: [
        { headline: 'This is a secure handoff.' },
        { detail: 'This is a trusted path.' },
      ],
    })).toThrow(SystemOutputPrecisionError);
  });

  it('accepts a single OmegaDecisionObject payload', () => {
    const omega = {
      status: 'ok',
      subject: { npi: '1234567890' },
      context: { orgId: '', role: 'viewer', persist: false },
      decision: { decision: 'PROCEED' },
      coverage: { checks: [] },
      claims: {},
      reuse_signal: null,
      recent_actions: [],
      acceptance: null,
      activation: null,
      drift: { state: 'STABLE' },
      nextBestAction: { action: 'REVIEW', reason: 'Test', confidence: 1, evidenceCount: 1 },
      generatedAt: '2026-04-15T00:00:00.000Z',
    } as const;

    expect(assertOmegaDecisionObject(omega)).toBe(omega);
  });

  it('throws when multiple system outputs are present', () => {
    expect(() => assertOmegaDecisionObject({
      outputs: [
        {
          status: 'ok',
          subject: { npi: '1234567890' },
          context: { orgId: '', role: 'viewer', persist: false },
          decision: null,
          coverage: null,
          claims: null,
          reuse_signal: null,
          recent_actions: [],
          acceptance: null,
          activation: null,
          drift: null,
          nextBestAction: null,
          generatedAt: '2026-04-15T00:00:00.000Z',
        },
        {
          status: 'partial',
          subject: { npi: '1234567890' },
          context: { orgId: '', role: 'viewer', persist: false },
          decision: null,
          coverage: null,
          claims: null,
          reuse_signal: null,
          recent_actions: [],
          acceptance: null,
          activation: null,
          drift: null,
          nextBestAction: null,
          generatedAt: '2026-04-15T00:00:00.000Z',
        },
      ],
    })).toThrow('Multiple system outputs detected');
  });
});
