/**
 * HAIP 1.0 Enforcement Configuration Types
 *
 * Central type definitions for the High Assurance Interoperability Profile.
 * All services (authz, verifier-api, issuer) import from this package
 * to ensure consistent enforcement across the platform.
 */

// ── Algorithm Configuration ─────────────────────────────────

/**
 * JOSE algorithms allowed under HAIP 1.0.
 * ES256 (P-256 ECDSA) is the only algorithm permitted
 * for signatures and DPoP proofs in strict runtime mode.
 */
export type HaipAlgorithm = 'ES256';

/**
 * Elliptic curves allowed under HAIP 1.0.
 * P-256 for ES256.
 */
export type HaipCurve = 'P-256';

// ── Token Binding ───────────────────────────────────────────

/**
 * Token binding mechanisms supported under HAIP.
 * DPoP is the primary mechanism; mTLS is allowed for confidential clients.
 */
export type TokenBindingMethod = 'dpop' | 'mtls';

/**
 * DPoP enforcement configuration.
 */
export interface DpopConfig {
  /** Whether DPoP is required for wallet clients (HAIP default: true) */
  readonly required: boolean;

  /** Maximum clock skew for iat validation (seconds) */
  readonly maxClockSkewSeconds: number;

  /** JTI replay cache TTL (milliseconds) */
  readonly jtiReplayTtlMs: number;

  /** Whether to require the kid header in DPoP proofs */
  readonly requireKid: boolean;

  /** Allowed algorithms for DPoP proof signing */
  readonly allowedAlgorithms: readonly HaipAlgorithm[];

  /** Maximum DPoP proof lifetime (seconds). SPECIFICATION §2: exp ≤ 5 minutes */
  readonly maxProofLifetimeSeconds: number;
}

// ── PKCE ────────────────────────────────────────────────────

/**
 * PKCE (Proof Key for Code Exchange) code challenge methods.
 * HAIP 1.0 requires S256 exclusively.
 */
export type PkceMethod = 'S256';

export interface PkceConfig {
  /** Whether PKCE is required (HAIP default: true) */
  readonly required: boolean;

  /** Allowed code challenge methods (HAIP: S256 only) */
  readonly allowedMethods: readonly PkceMethod[];
}

// ── PAR ─────────────────────────────────────────────────────

export interface ParConfig {
  /** Whether PAR is required for all authorization requests (HAIP default: true) */
  readonly required: boolean;

  /** Maximum lifetime for PAR request_uri (seconds) */
  readonly requestUriLifetimeSeconds: number;

  /**
   * Scopes that always require PAR, regardless of the global flag.
   * When PAR is not globally required, these scopes still mandate PAR.
   */
  readonly highRiskScopes: readonly string[];
}

// ── Credential Formats ──────────────────────────────────────

/**
 * Credential format identifiers per OpenID4VCI.
 */
export type CredentialFormat =
  | 'jwt_vc_json'
  | 'jwt_vc_json-ld'
  | 'ldp_vc'
  | 'vc+sd-jwt';

/**
 * VP (Verifiable Presentation) format identifiers per OpenID4VP.
 */
export type VpFormat =
  | 'jwt_vp_json'
  | 'jwt_vp_json-ld'
  | 'ldp_vp';

// ── Nonce / c_nonce ─────────────────────────────────────────

export interface NonceConfig {
  /** Lifetime of c_nonce values (seconds) */
  readonly cNonceLifetimeSeconds: number;

  /** Length of generated nonce (bytes, before base64url encoding) */
  readonly nonceLengthBytes: number;
}

// ── Root Configuration ──────────────────────────────────────

/**
 * Complete HAIP enforcement configuration.
 *
 * This is the single source of truth for all security constraints
 * across the VitalCV platform. Every service that participates in
 * OpenID4VCI, OpenID4VP, or HAIP flows must read from this config.
 */
export interface HaipConfig {
  /** HAIP profile version */
  readonly profileVersion: '1.0';

  /** Whether HAIP enforcement is active */
  readonly enforce: boolean;

  /** Allowed JOSE signing algorithms (whitelist) */
  readonly allowedAlgorithms: readonly HaipAlgorithm[];

  /** Allowed elliptic curves */
  readonly allowedCurves: readonly HaipCurve[];

  /** DPoP enforcement settings */
  readonly dpop: DpopConfig;

  /** PKCE enforcement settings */
  readonly pkce: PkceConfig;

  /** PAR enforcement settings */
  readonly par: ParConfig;

  /** Nonce / c_nonce settings */
  readonly nonce: NonceConfig;

  /** Supported credential formats for issuance */
  readonly credentialFormats: readonly CredentialFormat[];

  /** Supported VP formats for verification */
  readonly vpFormats: readonly VpFormat[];

  /** Token binding methods allowed */
  readonly tokenBindingMethods: readonly TokenBindingMethod[];

  /** Issuer DID (used in well-known metadata) */
  readonly issuerDid: string;

  /** Token issuer URL (used in JWT iss claim) */
  readonly tokenIssuer: string;

  /** Token audience URL (used in JWT aud claim) */
  readonly tokenAudience: string;
}
