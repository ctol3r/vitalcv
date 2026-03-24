import {
  assertCredentialObservationIntegrity,
  resolveCredentialEvidence,
  resolveReceiptLinkedArtifactId,
} from '../evidenceIntegrity';

describe('evidenceIntegrity', () => {
  it('marks source-verified credentials public-safe only when a receipt links to a sourced artifact', () => {
    const result = resolveCredentialEvidence({
      credential: {
        id: 'cred-1',
        verificationLevel: 'SOURCE_VERIFIED',
        artifactIds: ['artifact-1'],
        receiptIds: ['receipt-1'],
      },
      artifactsById: new Map([
        ['artifact-1', { id: 'artifact-1', source: 'NPPES_API' }],
      ]),
      receiptsById: new Map([
        ['receipt-1', { receiptId: 'receipt-1', sourceArtifactId: 'artifact-1', verificationArtifactId: null }],
      ]),
    });

    expect(result.publicSafe).toBe(true);
    expect(result.validArtifactIds).toEqual(['artifact-1']);
    expect(result.validReceiptIds).toEqual(['receipt-1']);
  });

  it('withholds verified credentials that lost their receipt chain', () => {
    const result = resolveCredentialEvidence({
      credential: {
        id: 'cred-1',
        verificationLevel: 'SOURCE_VERIFIED',
        artifactIds: ['artifact-1'],
        receiptIds: ['receipt-1'],
      },
      artifactsById: new Map([
        ['artifact-1', { id: 'artifact-1', source: 'STATE_BOARD' }],
      ]),
      receiptsById: new Map(),
    });

    expect(result.publicSafe).toBe(false);
    expect(result.issues).toContain('missing_receipt');
  });

  it('quarantines replayed receipt links that no longer point at the credential artifact', () => {
    const result = resolveCredentialEvidence({
      credential: {
        id: 'cred-1',
        verificationLevel: 'SOURCE_VERIFIED',
        artifactIds: ['artifact-1'],
        receiptIds: ['receipt-1'],
      },
      artifactsById: new Map([
        ['artifact-1', { id: 'artifact-1', source: 'STATE_BOARD' }],
      ]),
      receiptsById: new Map([
        ['receipt-1', { receiptId: 'receipt-1', sourceArtifactId: 'artifact-999', verificationArtifactId: null }],
      ]),
    });

    expect(result.publicSafe).toBe(false);
    expect(result.validReceiptIds).toEqual([]);
    expect(result.quarantinedReceiptIds).toEqual(['receipt-1']);
    expect(result.issues).toContain('quarantined_receipt');
    expect(result.issues).toContain('missing_receipt');
  });

  it('rejects materialized observations without a backing artifact or receipt', () => {
    expect(() => assertCredentialObservationIntegrity({
      verificationLevel: 'SOURCE_VERIFIED',
      artifactIds: [],
      receiptIds: [],
      context: 'test',
    })).toThrow('backing artifact');

    expect(() => assertCredentialObservationIntegrity({
      verificationLevel: 'SOURCE_VERIFIED',
      artifactIds: ['artifact-1'],
      receiptIds: [],
      context: 'test',
    })).toThrow('verification receipt');
  });

  it('prefers the source artifact link when resolving receipt provenance', () => {
    expect(resolveReceiptLinkedArtifactId({
      receiptId: 'receipt-1',
      sourceArtifactId: 'artifact-source',
      verificationArtifactId: 'artifact-verification',
    })).toBe('artifact-source');

    expect(resolveReceiptLinkedArtifactId({
      receiptId: 'receipt-2',
      sourceArtifactId: null,
      verificationArtifactId: 'artifact-verification',
    })).toBe('artifact-verification');
  });
});
