import { describe, expect, it } from 'vitest';

import { deriveDecisionContext } from '@/lib/applications/decisionContext';
import type { ApplicationEvidenceField, ApplicationEvidenceViewData } from '@/lib/applications/evidenceView';

function field(overrides: Partial<ApplicationEvidenceField> = {}): ApplicationEvidenceField {
  return {
    sectionId: 'identity',
    fieldId: 'npi',
    label: 'NPI',
    value: '1999999984',
    evidenceState: 'self_attested',
    sourceId: 'clinician',
    sourceObservedAt: null,
    freshUntil: null,
    artifactId: null,
    receiptId: null,
    ...overrides,
  };
}

function view(overrides: {
  lifecycle?: 'active' | 'superseded' | 'revoked';
  fields?: ApplicationEvidenceField[];
} = {}): ApplicationEvidenceViewData {
  return {
    applicationId: 'app_1',
    opportunityId: 'opp_1',
    accessPerspective: 'employer',
    mode: 'sealed',
    submittedPacket: {
      packetVersion: 2,
      packetHash: 'sha256:abc',
      clinicianNpi: '1999999984',
      integrity: 'valid',
      purpose: 'employer_review',
      recipient: 'El Camino Health',
      consentAt: '2026-04-26T14:35:00.000Z',
      consentReceiptId: 'rcpt_1',
      selectedSections: ['identity', 'license'],
      fields: overrides.fields ?? [field()],
      methodologyVersion: 'wave253.v1',
      clinicianNote: null,
      lifecycle: overrides.lifecycle ?? 'active',
    },
    legacyNotice: null,
    currentEvidence: {
      status: 'available',
      observedAt: null,
      methodologyVersion: null,
      fields: [],
      changesSinceSubmission: [],
      notice: '',
    },
  };
}

describe('deriveDecisionContext — identity & consent are carried from the packet', () => {
  it('maps packet identity, consent, and section count without inventing values', () => {
    const ctx = deriveDecisionContext(view());
    expect(ctx.packet).toMatchObject({ version: 2, hash: 'sha256:abc', integrity: 'valid', clinicianNpi: '1999999984' });
    expect(ctx.consent).toMatchObject({
      consentReceiptId: 'rcpt_1',
      purpose: 'employer_review',
      recipient: 'El Camino Health',
      selectedSectionCount: 2,
    });
    expect(ctx.worklistItem.submittedAt).toBe('2026-04-26T14:35:00.000Z');
  });
});

describe('deriveDecisionContext — proof tier is honest', () => {
  it('is self_attested when no field carries a receipt', () => {
    expect(deriveDecisionContext(view()).worklistItem.proofTier).toBe('self_attested');
  });

  it('is receipt_candidate when a source-backed field has a receipt — never psv_sourced', () => {
    const ctx = deriveDecisionContext(
      view({ fields: [field({ evidenceState: 'source_backed', receiptId: 'r1' })] }),
    );
    expect(ctx.worklistItem.proofTier).toBe('receipt_candidate');
    expect(ctx.worklistItem.proofTier).not.toBe('psv_sourced');
  });

  it('does not claim receipt_candidate for a source-backed field with no receipt', () => {
    const ctx = deriveDecisionContext(
      view({ fields: [field({ evidenceState: 'source_backed', receiptId: null })] }),
    );
    expect(ctx.worklistItem.proofTier).toBe('self_attested');
  });
});

describe('deriveDecisionContext — coverage counts every state, unknown is not adverse', () => {
  it('tallies each evidence state distinctly', () => {
    const ctx = deriveDecisionContext(
      view({
        fields: [
          field({ evidenceState: 'source_backed', receiptId: 'r1' }),
          field({ evidenceState: 'self_attested' }),
          field({ evidenceState: 'needs_review' }),
          field({ evidenceState: 'unavailable' }),
          field({ evidenceState: 'access_required' }),
        ],
      }),
    );
    expect(ctx.coverage.total).toBe(5);
    expect(ctx.coverage.sourceBacked).toBe(1);
    expect(ctx.coverage.selfAttested).toBe(1);
    expect(ctx.coverage.needsReview).toBe(1);
    expect(ctx.coverage.unavailable).toBe(1);
    // access_required is counted, and is NOT folded into any adverse bucket.
    expect(ctx.coverage.byState.access_required).toBe(1);
  });
});

describe('deriveDecisionContext — legacy application has no sealed packet', () => {
  it('returns null (honest "no sealed record") when submittedPacket is null', () => {
    const legacy = { ...view(), mode: 'legacy' as const, submittedPacket: null };
    expect(deriveDecisionContext(legacy)).toBeNull();
  });
});

describe('deriveDecisionContext — lifecycle & no-decision honesty', () => {
  it('flags a revoked packet as stale', () => {
    expect(deriveDecisionContext(view({ lifecycle: 'revoked' })).staleOrRevoked).toBe(true);
    expect(deriveDecisionContext(view({ lifecycle: 'superseded' })).staleOrRevoked).toBe(true);
    expect(deriveDecisionContext(view({ lifecycle: 'active' })).staleOrRevoked).toBe(false);
  });

  it('never fabricates a workflow decision — status stays pending until one is recorded', () => {
    for (const lifecycle of ['active', 'superseded', 'revoked'] as const) {
      expect(deriveDecisionContext(view({ lifecycle })).worklistItem.status).toBe('pending');
    }
  });
});
