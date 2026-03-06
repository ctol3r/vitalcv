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
