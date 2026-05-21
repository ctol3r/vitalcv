/**
 * @vitalcv/wallet-sdk
 *
 * VitalCV Wallet SDK — for clinician wallet apps and holder agents.
 * Manages credential storage, presentation generation, OID4VP flows,
 * selective disclosure, and wallet summaries.
 *
 * Usage:
 *   import { VitalCVWallet } from '@vitalcv/wallet-sdk';
 *
 *   const wallet = new VitalCVWallet({
 *     baseUrl: 'https://api.vitalcv.com',
 *     npi: '1234567890',
 *   });
 *
 *   // Get wallet summary
 *   const summary = await wallet.getSummary();
 *
 *   // List credentials with expiry warnings
 *   const creds = await wallet.listCredentials();
 *
 *   // Present credentials to a verifier
 *   const vp = await wallet.createPresentation({ credentialIds: ['cred_abc'] });
 *
 *   // Selective disclosure
 *   const sd = await wallet.presentSelectiveDisclosure({
 *     claims: ['state', 'licenseNumber'],
 *   });
 */

// ── Configuration ──────────────────────────────────────────────────────────

export interface VitalCVWalletConfig {
  /** VitalCV API base URL */
  baseUrl: string;
  /** Clinician NPI (10-digit) */
  npi: string;
  /** Optional holder DID */
  holderDid?: string;
  /** Request timeout in milliseconds (default: 10_000) */
  timeoutMs?: number;
  /** Optional: bearer token or session token for authenticated calls */
  token?: string;
  /** Enables local wallet-only helpers that do not require the VitalCV API */
  localMode?: boolean;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface WalletCredential {
  credentialId: string;
  credentialType: string;
  issuer: string;
  issuerId: string;
  status: 'VALID' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED';
  issuedAt: string;
  expiresAt?: string;
  daysUntilExpiry?: number;
  expiryWarning?: boolean;
  haipCompliant: boolean;
  claims: Record<string, unknown>;
  vcJwt?: string;
}

export interface WalletSummary {
  npi: string;
  totalCredentials: number;
  validCredentials: number;
  expiringCredentials: number;
  expiredCredentials: number;
  revokedCredentials: number;
  haipCompliantCount: number;
  trustBand: 'L0' | 'L1' | 'L2' | 'L3';
  lastUpdated: string;
}

export interface PresentationRequest {
  credentialIds: string[];
  /** Optional verifier DID or audience claim */
  verifierDid?: string;
  /** Optional challenge nonce (anti-replay) */
  challenge?: string;
}

export interface PresentationResult {
  presentationId: string;
  vpJwt: string;
  credentials: Array<{ credentialId: string; type: string }>;
  subject: string;
  createdAt: string;
  expiresAt: string;
}

export interface SelectiveDisclosureRequest {
  /** Claims to disclose */
  claims: string[];
  /** Optional WebAuthn assertion JWT */
  assertionJwt?: string;
  /** Optional verifier DID */
  verifierDid?: string;
}

export interface SelectiveDisclosureResult {
  subject: string;
  disclosedClaims: Record<string, unknown>;
  salts: Record<string, string>;
  commitment: string;
  issuedAt: string;
}

export interface OID4VPRequest {
  /** Verifier-generated presentation request URI or JSON */
  presentationRequestUri: string;
}

export interface OID4VPResponse {
  presentationId: string;
  submittedAt: string;
  accepted: boolean;
  verifier?: string;
}

export interface CredentialOffer {
  offerId: string;
  credentialOfferUri: string;
  credentialType: string;
  issuer: string;
  expiresAt: string;
}

export interface AcceptOfferResult {
  credentialId: string;
  credentialType: string;
  issuer: string;
  storedAt: string;
}

// ── Error ──────────────────────────────────────────────────────────────────

export class VitalCVWalletError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'VitalCVWalletError';
  }
}

// ── Client ─────────────────────────────────────────────────────────────────

export class VitalCVWallet {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;
  readonly localMode: boolean;
  readonly npi: string;
  readonly holderDid?: string;

  constructor(config: VitalCVWalletConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.npi = config.npi;
    this.holderDid = config.holderDid;
    this.localMode = config.localMode ?? false;
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-NPI': config.npi,
      ...(config.holderDid ? { 'X-Holder-DID': config.holderDid } : {}),
      ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
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
        throw new VitalCVWalletError(
          `VitalCV Wallet API error: ${res.status} ${res.statusText}`,
          res.status,
          body
        );
      }
      return body as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Wallet Contents ──────────────────────────────────────────────────

  /**
   * Get wallet summary (counts, trust band, expiry warnings).
   */
  async getSummary(): Promise<WalletSummary> {
    return this.request<WalletSummary>(`/api/credentials/wallet/${encodeURIComponent(this.npi)}/summary`);
  }

  /**
   * List all credentials in the wallet with status and expiry info.
   */
  async listCredentials(filter?: {
    status?: 'VALID' | 'EXPIRED' | 'REVOKED';
    credentialType?: string;
  }): Promise<WalletCredential[]> {
    const qs = new URLSearchParams({ npi: this.npi });
    if (filter?.status)         qs.set('status', filter.status);
    if (filter?.credentialType) qs.set('type', filter.credentialType);
    return this.request<WalletCredential[]>(`/api/credentials/wallet?${qs}`);
  }

  /**
   * Get a single credential by ID.
   */
  async getCredential(credentialId: string): Promise<WalletCredential> {
    return this.request<WalletCredential>(`/api/credentials/${encodeURIComponent(credentialId)}`);
  }

  /**
   * Remove a credential from the wallet.
   */
  async removeCredential(credentialId: string): Promise<{ removed: boolean }> {
    return this.request(`/api/credentials/wallet/${encodeURIComponent(credentialId)}`, {
      method: 'DELETE',
    });
  }

  // ── Presentation ─────────────────────────────────────────────────────

  /**
   * Create a Verifiable Presentation (VP-JWT) for selected credentials.
   */
  async createPresentation(req: PresentationRequest): Promise<PresentationResult> {
    return this.request<PresentationResult>('/api/credentials/present', {
      method: 'POST',
      body: JSON.stringify({ ...req, npi: this.npi, holderDid: this.holderDid }),
    });
  }

  /**
   * Create a local-only presentation envelope for host wallets operating offline.
   */
  async createOfflinePresentation(
    credentialIds: string[],
    nonce?: string,
  ): Promise<PresentationResult> {
    if (!this.localMode) {
      throw new VitalCVWalletError('LOCAL_MODE_REQUIRED');
    }

    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 300_000).toISOString();
    const subject = this.holderDid ?? this.npi;

    return {
      presentationId: `offline-${Date.now()}`,
      vpJwt: JSON.stringify({
        mode: 'offline',
        nonce,
        subject,
        credentialIds,
      }),
      credentials: credentialIds.map((credentialId) => ({
        credentialId,
        type: 'VerifiableCredential',
      })),
      subject,
      createdAt,
      expiresAt,
    };
  }

  /**
   * Perform selective disclosure — disclose only specified claims.
   */
  async presentSelectiveDisclosure(req: SelectiveDisclosureRequest): Promise<SelectiveDisclosureResult> {
    return this.request<SelectiveDisclosureResult>('/api/credentials/present/selective', {
      method: 'POST',
      body: JSON.stringify({ ...req, subject: this.npi }),
    });
  }

  /**
   * Respond to an OID4VP presentation request (cross-device / same-device flows).
   */
  async respondToOID4VPRequest(req: OID4VPRequest): Promise<OID4VPResponse> {
    return this.request<OID4VPResponse>('/api/oid4vp/present', {
      method: 'POST',
      body: JSON.stringify({ ...req, npi: this.npi, holderDid: this.holderDid }),
    });
  }

  // ── Offers ───────────────────────────────────────────────────────────

  /**
   * Accept a credential offer (OID4VCI flow) and store the issued credential.
   */
  async acceptCredentialOffer(offer: CredentialOffer): Promise<AcceptOfferResult> {
    return this.request<AcceptOfferResult>('/api/oid4vci/accept', {
      method: 'POST',
      body: JSON.stringify({ offerId: offer.offerId, npi: this.npi }),
    });
  }

  // ── Trust State ──────────────────────────────────────────────────────

  /**
   * Get the current substrate trust state for this NPI.
   */
  async getTrustState(): Promise<{
    band: string;
    bandLabel: string;
    explanation: string;
    haipCompliant: boolean;
    computedAt: string;
  }> {
    return this.request(`/api/trust/substrate/${encodeURIComponent(this.npi)}/band`);
  }
}

// ── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a VitalCV Wallet SDK client.
 *
 * @example
 * const wallet = createWallet({
 *   baseUrl: 'https://api.vitalcv.com',
 *   npi: '1234567890',
 *   holderDid: 'did:vitalcv:clinician_1234567890',
 * });
 */
export function createWallet(config: VitalCVWalletConfig): VitalCVWallet {
  return new VitalCVWallet(config);
}

export default VitalCVWallet;

// Wave 133: version + diagnostics
export * from './version';
export * from './diagnostics';
// Note: prior `./interoperability` re-export referenced a file that
// was never landed. Canonical fix lives on PR #375.
