/**
 * @vitalcv/issuer-sdk
 *
 * VitalCV Issuer SDK — issue and manage healthcare verifiable credentials
 * with full HAIP profile compliance, SD-JWT support, and OID4VCI integration.
 *
 * Usage:
 *   import { VitalCVIssuer } from '@vitalcv/issuer-sdk';
 *
 *   const issuer = new VitalCVIssuer({
 *     baseUrl: 'https://api.vitalcv.com',
 *     apiKey: 'iss_key_...',
 *     issuerId: 'did:vitalcv:org_ca_medical_board',
 *   });
 *
 *   // Issue a credential
 *   const vc = await issuer.issueCredential({
 *     npi: '1234567890',
 *     credentialType: 'MedicalLicense',
 *     claims: { state: 'CA', licenseNumber: 'A12345' },
 *   });
 *
 *   // Revoke a credential
 *   await issuer.revokeCredential(vc.credentialId, { reason: 'License expired' });
 */

// ── Configuration ──────────────────────────────────────────────────────────

export interface VitalCVIssuerConfig {
  /** VitalCV API base URL */
  baseUrl: string;
  /** Issuer API key */
  apiKey: string;
  /** DID of this issuer (e.g. did:vitalcv:org_ca_medical_board) */
  issuerId?: string;
  /** Request timeout in milliseconds (default: 15_000) */
  timeoutMs?: number;
}

// ── Types ──────────────────────────────────────────────────────────────────

export type CredentialType =
  | 'MedicalLicense'
  | 'BoardCertification'
  | 'DEARegistration'
  | 'NPIAttestation'
  | 'HospitalPrivileges'
  | 'MalpracticeInsurance'
  | 'CMECompletion'
  | string;

export interface IssueCredentialRequest {
  /** 10-digit NPI of the credential subject */
  npi: string;
  /** Type of credential being issued */
  credentialType: CredentialType;
  /** Credential claims (domain-specific fields) */
  claims: Record<string, unknown>;
  /** ISO-8601 expiry date (optional; defaults to issuer policy) */
  expiresAt?: string;
  /** Whether to apply SD-JWT selective disclosure structure */
  selectiveDisclosure?: boolean;
  /** Specific claims to make selectively disclosable */
  disclosableFields?: string[];
}

export interface IssuedCredential {
  credentialId: string;
  npi: string;
  issuer: string;
  issuerId: string;
  credentialType: string;
  vcJwt: string;
  sdJwtVc?: string;
  claims: Record<string, unknown>;
  issuedAt: string;
  expiresAt?: string;
  haipCompliant: boolean;
  receiptHash: string;
  traceId: string;
}

export interface OID4VCIOfferRequest {
  npi: string;
  credentialType: CredentialType;
  claims?: Record<string, unknown>;
  /** Offer lifetime in seconds (default: 300) */
  ttlSeconds?: number;
}

export interface OID4VCIOfferResult {
  offerId: string;
  credentialOfferUri: string;
  qrCodeUri?: string;
  expiresAt: string;
}

export interface RevokeCredentialRequest {
  reason?: string;
  /** Whether revocation is permanent (default: true) */
  permanent?: boolean;
}

export interface RevocationResult {
  credentialId: string;
  revoked: boolean;
  revokedAt: string;
  reason?: string;
  cascadeTriggered: boolean;
}

export interface IssuerRegistrationResult {
  issuerId: string;
  issuerName: string;
  did: string;
  trustScore: number;
  status: string;
  registeredAt: string;
}

export interface CredentialStatusUpdate {
  credentialId: string;
  status: 'VALID' | 'SUSPENDED' | 'REVOKED';
  reason?: string;
}

export interface IssuerStats {
  totalIssued: number;
  activeCredentials: number;
  revokedCredentials: number;
  expiredCredentials: number;
  haipCompliantPct: number;
  averageTrustScore: number;
}

// ── Error ──────────────────────────────────────────────────────────────────

export class VitalCVIssuerError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'VitalCVIssuerError';
  }
}

// ── Client ─────────────────────────────────────────────────────────────────

export class VitalCVIssuer {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;
  readonly issuerId?: string;

  constructor(config: VitalCVIssuerConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs ?? 15_000;
    this.issuerId = config.issuerId;
    this.headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-API-Key': config.apiKey,
      ...(config.issuerId ? { 'X-Issuer-DID': config.issuerId } : {}),
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
        throw new VitalCVIssuerError(
          `VitalCV Issuer API error: ${res.status} ${res.statusText}`,
          res.status,
          body
        );
      }
      return body as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Issuance ─────────────────────────────────────────────────────────

  /**
   * Issue a verifiable credential for a clinician (NPI-bound).
   * Automatically enforces HAIP profile and logs to audit ledger.
   */
  async issueCredential(req: IssueCredentialRequest): Promise<IssuedCredential> {
    return this.request<IssuedCredential>('/api/credentials/issue', {
      method: 'POST',
      body: JSON.stringify({ ...req, issuerId: this.issuerId }),
    });
  }

  /**
   * Create an OID4VCI credential offer for wallet issuance.
   */
  async createOID4VCICredentialOffer(req: OID4VCIOfferRequest): Promise<OID4VCIOfferResult> {
    return this.request<OID4VCIOfferResult>('/api/oid4vci/offer', {
      method: 'POST',
      body: JSON.stringify({ ...req, issuerId: this.issuerId }),
    });
  }

  // ── Revocation ───────────────────────────────────────────────────────

  /**
   * Revoke a credential by ID.
   * Triggers cascade analysis and emits CRITICAL audit event.
   */
  async revokeCredential(credentialId: string, options?: RevokeCredentialRequest): Promise<RevocationResult> {
    return this.request<RevocationResult>('/api/revocation/revoke', {
      method: 'POST',
      body: JSON.stringify({
        credentialId,
        reason: options?.reason,
        permanent: options?.permanent ?? true,
        issuerId: this.issuerId,
      }),
    });
  }

  /**
   * Bulk update credential statuses.
   */
  async updateCredentialStatuses(updates: CredentialStatusUpdate[]): Promise<{ updated: number; errors: string[] }> {
    return this.request('/api/credentials/status/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ updates, issuerId: this.issuerId }),
    });
  }

  // ── Registry ─────────────────────────────────────────────────────────

  /**
   * Register this issuer in the VitalCV trust registry.
   */
  async registerIssuer(params: {
    issuerName: string;
    issuerType: string;
    jurisdiction?: string;
    endpoint?: string;
    publicKey?: string;
  }): Promise<IssuerRegistrationResult> {
    return this.request<IssuerRegistrationResult>('/api/registry/issuers', {
      method: 'POST',
      body: JSON.stringify({ ...params, did: this.issuerId }),
    });
  }

  // ── Stats ────────────────────────────────────────────────────────────

  /**
   * Get issuance statistics for this issuer.
   */
  async getStats(): Promise<IssuerStats> {
    const path = this.issuerId
      ? `/api/analytics/issuer/${encodeURIComponent(this.issuerId)}`
      : '/api/analytics/issuer/self';
    return this.request<IssuerStats>(path);
  }
}

// ── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a VitalCV Issuer SDK client.
 *
 * @example
 * const issuer = createIssuer({
 *   baseUrl: 'https://api.vitalcv.com',
 *   apiKey: process.env.VITALCV_ISSUER_API_KEY!,
 *   issuerId: 'did:vitalcv:org_ca_medical_board',
 * });
 */
export function createIssuer(config: VitalCVIssuerConfig): VitalCVIssuer {
  return new VitalCVIssuer(config);
}

export default VitalCVIssuer;

// Wave 133: version + diagnostics
export * from './version';
export * from './diagnostics';
