/**
 * @vitalcv/verifier-sdk
 *
 * VitalCV Verifier SDK — verify clinician credentials and trust states.
 *
 * Usage:
 *   import { VitalCVVerifier } from '@vitalcv/verifier-sdk';
 *
 *   const verifier = new VitalCVVerifier({ baseUrl: 'https://api.vitalcv.com' });
 *
 *   // Check a clinician's trust band
 *   const trust = await verifier.getTrustBand('1234567890');
 *
 *   // Full substrate trust evaluation
 *   const state = await verifier.getSubstrateTrustState('1234567890');
 *
 *   // Verify a credential presentation (VP-JWT)
 *   const result = await verifier.verifyPresentation({ vpJwt });
 *
 *   // Accept a credential presentation
 *   const acceptance = await verifier.acceptPresentation({ presentationId });
 */

// ── Configuration ──────────────────────────────────────────────────────────

export interface VitalCVVerifierConfig {
  /** VitalCV API base URL */
  baseUrl: string;
  /** API key issued to the verifier organisation */
  apiKey?: string;
  /** Request timeout in milliseconds (default: 10_000) */
  timeoutMs?: number;
}

// ── Types ──────────────────────────────────────────────────────────────────

export type TrustBand = 'L0' | 'L1' | 'L2' | 'L3';

export interface TrustBandResult {
  subject: string;
  band: TrustBand;
  bandLabel: string;
  haipCompliant: boolean;
  computedAt: string;
}

export interface IssuerTrustDetail {
  issuerId: string;
  issuerName: string;
  trustLevel: string;
  trustScore: number;
  haipCompliant: boolean;
  status: string;
}

export interface CredentialRisk {
  credentialId: string;
  issuer: string;
  status: string;
  revoked: boolean;
  expired: boolean;
  haipViolations: Array<{ rule: string; severity: string }>;
  verificationErrors: string[];
}

export interface SubstrateTrustState {
  subject: string;
  band: TrustBand;
  bandLabel: string;
  explanation: string;
  issuerTrust: IssuerTrustDetail[];
  credentialRisk: CredentialRisk[];
  revocationState: {
    revokedCount: number;
    hasActiveRevocations: boolean;
  };
  haipCompliance: {
    compliant: boolean;
    violations: Array<{ rule: string; severity: string; detail: string }>;
  };
  federationTrustHealth: {
    healthScore: number;
    totalEntities: number;
    degradedEntities: string[];
  };
  computedAt: string;
}

export interface VerificationResult {
  valid: boolean;
  presentationId?: string;
  subject?: string;
  credentials: Array<{
    credentialId: string;
    issuer: string;
    valid: boolean;
    revoked: boolean;
    errors: string[];
  }>;
  haipCompliant: boolean;
  verifiedAt: string;
  errors: string[];
}

export interface AcceptanceResult {
  accepted: boolean;
  presentationId: string;
  subject: string;
  credentialsAccepted: string[];
  credentialsDenied: string[];
  reason?: string;
  acceptedAt: string;
}

export interface SelectiveDisclosureRequest {
  subject: string;
  claims: string[];
  /** Optional VP assertion JWT from WebAuthn or DID Auth */
  assertionJwt?: string;
}

export interface SelectiveDisclosureResult {
  subject: string;
  disclosedClaims: Record<string, unknown>;
  salts: Record<string, string>;
  commitment: string;
  issuedAt: string;
}

export interface RevocationStatus {
  credentialId: string;
  revoked: boolean;
  permanent?: boolean;
  revokedAt?: string;
  reason?: string;
}

export interface PublicProfile {
  npi: string;
  name?: string;
  trustBand: TrustBand;
  credentials: Array<{
    type: string;
    issuer: string;
    status: string;
    expiresAt?: string;
  }>;
}

// ── Error ──────────────────────────────────────────────────────────────────

export class VitalCVVerifierError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'VitalCVVerifierError';
  }
}

// ── Client ─────────────────────────────────────────────────────────────────

export class VitalCVVerifier {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;

  constructor(config: VitalCVVerifierConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(config.apiKey ? { 'X-API-Key': config.apiKey } : {}),
    };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { ...this.headers, ...(init?.headers as Record<string, string> | undefined) },
        signal: controller.signal,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new VitalCVVerifierError(
          `VitalCV API error: ${res.status} ${res.statusText}`,
          res.status,
          body
        );
      }
      return body as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Trust ────────────────────────────────────────────────────────────

  /**
   * Get lightweight trust band for an NPI (fast path).
   */
  async getTrustBand(npi: string): Promise<TrustBandResult> {
    return this.request<TrustBandResult>(`/api/trust/substrate/${encodeURIComponent(npi)}/band`);
  }

  /**
   * Get full substrate trust state (L0–L3, HAIP, federation, revocation, issuers).
   */
  async getSubstrateTrustState(npi: string): Promise<SubstrateTrustState> {
    return this.request<SubstrateTrustState>(`/api/trust/substrate/${encodeURIComponent(npi)}`);
  }

  /**
   * Get public trust profile for a clinician.
   */
  async getPublicProfile(npi: string): Promise<PublicProfile> {
    return this.request<PublicProfile>(`/api/public/profile/${encodeURIComponent(npi)}`);
  }

  // ── Credential Verification ──────────────────────────────────────────

  /**
   * Verify a Verifiable Presentation (VP-JWT).
   */
  async verifyPresentation(params: { vpJwt: string; expectedNpi?: string }): Promise<VerificationResult> {
    return this.request<VerificationResult>('/api/credentials/verify/presentation', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Accept a credential presentation after verification.
   * Records the decision in the audit ledger.
   */
  async acceptPresentation(params: {
    presentationId: string;
    acceptedCredentials?: string[];
    deniedCredentials?: string[];
    reason?: string;
  }): Promise<AcceptanceResult> {
    return this.request<AcceptanceResult>('/api/credentials/accept', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Request selective disclosure of specific claims for an NPI.
   */
  async requestSelectiveDisclosure(req: SelectiveDisclosureRequest): Promise<SelectiveDisclosureResult> {
    return this.request<SelectiveDisclosureResult>('/api/credentials/present/selective', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  // ── Revocation ───────────────────────────────────────────────────────

  /**
   * Check revocation status for a credential ID.
   */
  async checkRevocation(credentialId: string): Promise<RevocationStatus> {
    return this.request<RevocationStatus>(`/api/revocation/${encodeURIComponent(credentialId)}`);
  }

  /**
   * List all revoked credentials (paginated by offset/limit).
   */
  async listRevocations(params?: { offset?: number; limit?: number }): Promise<RevocationStatus[]> {
    const qs = new URLSearchParams();
    if (params?.offset) qs.set('offset', String(params.offset));
    if (params?.limit)  qs.set('limit',  String(params.limit));
    const query = qs.toString() ? `?${qs}` : '';
    return this.request<RevocationStatus[]>(`/api/revocation${query}`);
  }

  // ── Federation Trust ──────────────────────────────────────────────────

  /**
   * Check federation trust health for an entity.
   */
  async getFederationHealth(entityId: string): Promise<{
    entityId: string;
    status: string;
    chainValid: boolean;
    healthScore: number;
    computedAt: string;
  }> {
    return this.request(`/api/federation/health/${encodeURIComponent(entityId)}`);
  }

  /**
   * List all federated network peers.
   */
  async listFederationPeers(): Promise<Array<{
    networkId: string;
    networkName: string;
    status: string;
    networkType: string;
  }>> {
    const data = await this.request<{ networks?: unknown[]; peers?: unknown[] }>('/api/network/peers');
    return (data.networks ?? data.peers ?? []) as Array<{
      networkId: string;
      networkName: string;
      status: string;
      networkType: string;
    }>;
  }

  // ── Audit ────────────────────────────────────────────────────────────

  /**
   * Retrieve paginated audit events (cursor-based).
   */
  async getAuditEvents(params?: {
    after?: string;
    limit?: number;
  }): Promise<{ events: unknown[]; nextCursor: string | null; ledgerSize: number }> {
    const qs = new URLSearchParams();
    if (params?.after) qs.set('after', params.after);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs}` : '';
    return this.request(`/api/audit/events${query}`);
  }
}

// ── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a VitalCV Verifier SDK client.
 *
 * @example
 * const verifier = createVerifier({
 *   baseUrl: 'https://api.vitalcv.com',
 *   apiKey: process.env.VITALCV_API_KEY,
 * });
 */
export function createVerifier(config: VitalCVVerifierConfig): VitalCVVerifier {
  return new VitalCVVerifier(config);
}

export default VitalCVVerifier;

// Wave 133: version + diagnostics
export * from './version';
export * from './diagnostics';

// ── Wave 158: Webhook Signature Verification ───────────────────────────────

/**
 * Verify a VitalCV webhook signature.
 *
 * VitalCV signs webhook payloads using HMAC-SHA256.
 * The signature header (`x-vitalcv-signature`) contains: `sha256=<hex>`
 *
 * This function is Node.js-only (uses `node:crypto`).
 *
 * @param rawBody - Raw request body as a string
 * @param signatureHeader - Value of the `x-vitalcv-signature` header
 * @param secret - Your webhook secret
 * @returns true if the signature is valid
 *
 * @example
 * ```ts
 * import { verifyWebhookSignature } from '@vitalcv/verifier-sdk';
 *
 * app.post('/webhook', (req, res) => {
 *   const valid = verifyWebhookSignature(
 *     rawBodyString,                          // raw body as string
 *     req.headers['x-vitalcv-signature'],     // signature header
 *     process.env.VITALCV_WEBHOOK_SECRET!,    // your secret
 *   );
 *   if (!valid) return res.status(401).send('Invalid signature');
 *   // Process event...
 *   res.status(200).send('OK');
 * });
 * ```
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;

  try {
    // Use globalThis to access Node.js crypto without type declarations
    const nodeCrypto = (globalThis as Record<string, unknown>).__vitalcv_crypto ??
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      ((globalThis as Record<string, unknown>).__vitalcv_crypto = (
        new Function('return require("node:crypto")')
      )() as Record<string, (...args: unknown[]) => unknown>);

    const crypto = nodeCrypto as Record<string, (...args: unknown[]) => unknown>;
    const hmac = crypto['createHmac']('sha256', secret) as Record<string, (...args: unknown[]) => unknown>;
    hmac['update'](rawBody);
    const expectedSig = hmac['digest']('hex') as string;
    const expected = `sha256=${expectedSig}`;

    // Simple constant-time comparison
    if (signatureHeader.length !== expected.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) {
      mismatch |= signatureHeader.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return mismatch === 0;
  } catch {
    return false;
  }
}

// ── Offline verification (protocol-level, no API dependency) ─────────────────
export {
  verifyEnvelope,
  validateCapsuleStructure,
  computeTrustBand,
  verifyArtifactHash,
  buildArtifactCanonicalPayload,
  buildCapsuleCanonicalPayload,
  fetchDiscoveryDocument,
  fetchIssuerPublicKeys,
  type CryptoEnvelope as OfflineCryptoEnvelope,
  type IssuerPublicKey,
  type EnvelopeVerifyResult,
  type CapsuleValidation,
  type TrustBandComputation,
} from './offline';
