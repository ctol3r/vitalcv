/**
 * Chaos test: verifier portal flow with failure injections.
 */
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { VerifyResult } from '../../../components/VerifyResult';

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

describe('Chaos: verifier portal E2E', () => {
  const noop = () => {};

  it('displays revoked credential errors with anchor context', () => {
    render(
      <VerifyResult
        result={{
          status: 'revoked',
          credentialId: 'cred-revoked',
          auditRef: 'anchor-revoked',
          details: {
            issuer: 'did:web:issuer',
            reason: 'Revoked due to board order',
          },
          timestamp: new Date().toISOString(),
        }}
        onRecheck={noop}
        isRechecking={false}
        lastCheckTime={new Date()}
      />,
    );

    expect(screen.getByText('Credential Revoked')).toBeInTheDocument();
    expect(screen.getByText(/Revoked due to board order/)).toBeInTheDocument();
  });

  it('flags unknown credential on invalid signature injection', () => {
    render(
      <VerifyResult
        result={{
          status: 'unknown',
          credentialId: 'cred-unknown',
          details: {
            issuer: 'did:web:test',
            reason: 'Signature mismatch',
          },
          timestamp: new Date().toISOString(),
        }}
        onRecheck={noop}
        isRechecking={false}
        lastCheckTime={new Date()}
      />,
    );

    expect(screen.getByText('Credential Unknown')).toBeInTheDocument();
    expect(screen.getByText(/Signature mismatch/)).toBeInTheDocument();
  });
});











