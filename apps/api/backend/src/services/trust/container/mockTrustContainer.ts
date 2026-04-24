import { createHash } from 'crypto';
import { sha256Hex, stableStringify } from '../../../utils/deterministic';
import type {
  AnchorReceiptResult,
  CredentialEnvelopePayload,
  DidDocument,
  HealthCheckResult,
  IssuedCredentialResult,
  PresentationResult,
  ProofBundleExport,
  TrustContainerProvider,
  TrustContainerProviderKind,
  VerificationResult,
} from './trustContainerContract';
import { assertLimitationConsistency } from './trustContainerContract';

export class MockTrustContainer implements TrustContainerProvider {
  readonly kind: TrustContainerProviderKind = 'mock';

  private hash(value: unknown, domain: string): string {
    return sha256Hex(`${domain}::${stableStringify(value)}`);
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return { ok: true, status: 'mock-provider-healthy' };
  }

  async issueCredential(payload: CredentialEnvelopePayload): Promise<IssuedCredentialResult> {
    assertLimitationConsistency(payload);

    const envelopeHash = this.hash(payload, 'vitalcv.envelope');
    const issuedAt = this.deterministicTimestamp(payload.entityId, payload.auditHash);

    return {
      id: `mock_vc_${envelopeHash.substring(0, 32)}`,
      did: 'did:vitalcv-mock:issuer',
      vcPayload: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'VitalCVReadinessCredentialMock'],
        issuer: payload.issuer.did,
        issuanceDate: issuedAt,
        credentialSubject: payload,
        proof: {
          type: 'VitalCVMockProof2026',
          created: issuedAt,
          proofPurpose: 'assertionMethod',
          envelopeHash,
          mock: true,
        },
      },
      issuedAt,
      envelopeHash,
      mock: true,
    };
  }

  async verifyCredential(vc: unknown): Promise<VerificationResult> {
    const envelopeHash = (vc as { proof?: { envelopeHash?: string } } | null | undefined)?.proof?.envelopeHash;
    return { valid: true, errors: [], envelopeHash, mock: true };
  }

  async anchorReceipt(receiptData: unknown): Promise<AnchorReceiptResult> {
    const hash = this.hash(receiptData, 'vitalcv.receipt');
    return {
      receiptId: `mock_receipt_${hash.substring(0, 24)}`,
      anchoredAt: this.deterministicTimestamp('anchor', hash),
      txHash: `mock:${hash}`,
      mock: true,
    };
  }

  async createPresentation(vcs: unknown[]): Promise<PresentationResult> {
    return {
      vpPayload: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation', 'VitalCVPresentationMock'],
        verifiableCredential: vcs,
        proof: { type: 'VitalCVMockProof2026', mock: true },
      },
      mock: true,
    };
  }

  async resolveDid(did: string): Promise<DidDocument> {
    return {
      did,
      document: {
        id: did,
        '@context': 'https://www.w3.org/ns/did/v1',
        verificationMethod: [],
      },
      mock: true,
    };
  }

  async exportProofBundle(entityId: string): Promise<ProofBundleExport> {
    return { entityId, bundle: [], mock: true };
  }

  private deterministicTimestamp(...parts: string[]): string {
    const digest = createHash('sha256').update(parts.join('|')).digest('hex');
    const seconds = parseInt(digest.substring(0, 8), 16);
    const base = Date.UTC(2020, 0, 1);
    return new Date(base + seconds * 1000).toISOString();
  }
}
