import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DecisionContext } from '@/components/verifier/DecisionContext';
import type { DecisionContext as DecisionContextData } from '@/lib/applications/decisionContext';

function ctx(overrides: Partial<DecisionContextData> = {}): DecisionContextData {
  return {
    applicationId: 'app_1',
    opportunityId: 'opp_1',
    accessPerspective: 'employer',
    packet: {
      version: 2,
      hash: 'sha256:abc123',
      integrity: 'valid',
      lifecycle: 'active',
      methodologyVersion: 'wave253.v1',
      clinicianNpi: '1999999984',
    },
    consent: {
      consentAt: '2026-04-26T14:35:00.000Z',
      consentReceiptId: 'rcpt_1',
      purpose: 'employer_review',
      recipient: 'El Camino Health',
      selectedSectionCount: 2,
    },
    coverage: { total: 3, byState: {}, sourceBacked: 1, selfAttested: 1, needsReview: 1, unavailable: 0 },
    staleOrRevoked: false,
    worklistItem: { clinicianNpi: '1999999984', submittedAt: '2026-04-26T14:35:00.000Z', status: 'pending', proofTier: 'self_attested' },
    ...overrides,
  };
}

describe('DecisionContext render', () => {
  it('shows the real sealed-packet identity (hash, NPI, integrity)', () => {
    const html = renderToStaticMarkup(<DecisionContext context={ctx()} />);
    expect(html).toContain('sha256:abc123');
    expect(html).toContain('1999999984');
    expect(html).toContain('Valid (hash matches)');
    expect(html).toContain('rcpt_1'); // consent receipt
  });

  it('flags a revoked packet before a decision is made', () => {
    const html = renderToStaticMarkup(
      <DecisionContext context={ctx({ staleOrRevoked: true, packet: { ...ctx().packet, lifecycle: 'revoked' } })} />,
    );
    expect(html).toContain('data-packet-lifecycle="revoked"');
    expect(html).toContain('has been revoked');
  });

  it('shows the newer-packet banner for a superseded packet', () => {
    const html = renderToStaticMarkup(
      <DecisionContext context={ctx({ staleOrRevoked: true, packet: { ...ctx().packet, lifecycle: 'superseded' } })} />,
    );
    expect(html).toContain('supersedes this one');
  });

  it('renders no stale banner for an active packet', () => {
    const html = renderToStaticMarkup(<DecisionContext context={ctx()} />);
    expect(html).not.toContain('data-packet-lifecycle');
  });

  it('never renders a bare "Verified" affirmative for the packet', () => {
    const html = renderToStaticMarkup(<DecisionContext context={ctx()} />);
    // Truth contract: no bare "Verified" label. "Valid (hash matches)" is integrity, not a source claim.
    expect(html).not.toMatch(/>Verified</);
  });
});
