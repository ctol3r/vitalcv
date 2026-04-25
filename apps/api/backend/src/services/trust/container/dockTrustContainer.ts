import { sha256Hex, stableStringify } from '../../../utils/deterministic';
import type {
  AnchorReceiptResult,
  CredentialEnvelopePayload,
  DidDocument,
  HealthCheckResult,
  IssuedCredentialResult,
  PresentationResult,
  ProofBundleExport,
  TrustContainerConfig,
  TrustContainerProvider,
  TrustContainerProviderKind,
  VerificationResult,
} from './trustContainerContract';
import {
  TrustContainerProviderError,
  assertLimitationConsistency,
} from './trustContainerContract';

export class DockTrustContainer implements TrustContainerProvider {
  readonly kind: TrustContainerProviderKind = 'dock';

  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly issuerDid: string;
  private readonly network: string;

  constructor(config: TrustContainerConfig) {
    this.apiUrl = config.apiUrl?.trim() ?? '';
    this.apiKey = config.apiKey?.trim() ?? '';
    this.issuerDid = config.issuerDid?.trim() ?? '';
    this.network = config.network?.trim() ?? 'testnet';
  }

  private configStatus(): { ok: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!this.apiUrl) missing.push('DOCK_API_URL');
    if (!this.apiKey) missing.push('DOCK_API_KEY');
    if (!this.issuerDid) missing.push('DOCK_ISSUER_DID');
    return { ok: missing.length === 0, missing };
  }

  private ensureConfigured(): void {
    const { ok, missing } = this.configStatus();
    if (!ok) {
      throw new TrustContainerProviderError(
        `Dock provider is not configured; missing: ${missing.join(', ')}`,
        'MISSING_CONFIG',
      );
    }
  }

  private hash(value: unknown, domain: string): string {
    return sha256Hex(`${domain}::${stableStringify(value)}`);
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const { ok, missing } = this.configStatus();
    if (!ok) {
      return {
        ok: false,
        status: 'dock-provider-unconfigured',
        reason: `missing env: ${missing.join(', ')}`,
      };
    }

    return { ok: true, status: 'dock-provider-configured', reason: `network=${this.network}` };
  }

  async issueCredential(payload: CredentialEnvelopePayload): Promise<IssuedCredentialResult> {
    this.ensureConfigured();
    assertLimitationConsistency(payload);

    const envelopeHash = this.hash(payload, 'vitalcv.envelope');

    return {
      id: `dock_vc_scaffold_${envelopeHash.substring(0, 32)}`,
      did: this.issuerDid,
      vcPayload: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'VitalCVReadinessCredential'],
        issuer: this.issuerDid,
        credentialSubject: payload,
      },
      issuedAt: new Date().toISOString(),
      envelopeHash,
    };
  }

  async verifyCredential(_vc: unknown): Promise<VerificationResult> {
    this.ensureConfigured();
    return {
      valid: false,
      errors: ['Dock live verification not yet implemented (Wave 2 scaffold)'],
    };
  }

  async anchorReceipt(receiptData: unknown): Promise<AnchorReceiptResult> {
    this.ensureConfigured();
    const hash = this.hash(receiptData, 'vitalcv.receipt');
    return {
      receiptId: `dock_receipt_scaffold_${hash.substring(0, 24)}`,
      anchoredAt: new Date().toISOString(),
      txHash: `dock-scaffold:${hash}`,
    };
  }

  async createPresentation(vcs: unknown[]): Promise<PresentationResult> {
    this.ensureConfigured();
    return {
      vpPayload: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        verifiableCredential: vcs,
      },
    };
  }

  async resolveDid(did: string): Promise<DidDocument> {
    this.ensureConfigured();
    return { did, document: { id: did } };
  }

  async exportProofBundle(entityId: string): Promise<ProofBundleExport> {
    this.ensureConfigured();
    return { entityId, bundle: [] };
  }
}
