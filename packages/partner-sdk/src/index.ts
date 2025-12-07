/**
 * VitalCV Partner SDK - Server-Side Credential Verification
 * Tagged: run: next-batch-20251031-2
 * Agent: CURSOR • AGENT
 *
 * @package @vitalcv/partner-sdk
 * @version 0.1.0-pilot
 */

import * as nacl from 'tweetnacl';
import type {
  EnrollmentRequest,
  EnrollmentResponse,
  TimelineEntry,
  VerifyPassportRequest,
  VerifyPassportResponse,
} from '@chai-vc/generated-api-types';
import { emitMetric } from '@chai-vc/metrics-core';

const PACKAGE_NAME = 'partner-sdk';
const REQUEST_METRIC = 'partner_sdk.request';

export interface CredentialProof {
  credentialId: string;
  holderDid: string;
  signature: string; // Ed25519 signature (hex or base64)
  issuedAt: string; // ISO 8601 timestamp
  expiresAt?: string; // ISO 8601 timestamp
  claims: Record<string, any>;
  issuerDid?: string;
  issuerPublicKey?: string; // Ed25519 public key (hex or base64)
}

export interface VerificationOptions {
  checkRevocation?: boolean;
  verifierDid?: string;
  apiEndpoint?: string;
  skipSignature?: boolean; // DANGEROUS: only for testing
  apiKey?: string;
  fetchFn?: typeof fetch;
}

export interface VerificationResult {
  valid: boolean;
  holderDid?: string;
  credentialId?: string;
  issuedAt?: string;
  claims?: Record<string, any>;
  error?: string;
  errorCode?: string;
  revoked?: boolean;
  revokedAt?: string;
  revocationReason?: string;
  auditRef?: string;
}

export interface RevocationCheckResult {
  revoked: boolean;
  revokedAt?: string;
  reason?: string;
  error?: string;
}

export interface PartnerRequestOptions {
  apiEndpoint?: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  query?: Record<string, string | number | undefined>;
}

export interface FetchTimelineOptions extends PartnerRequestOptions {
  limit?: number;
  cursor?: string;
}

const DEFAULT_API_ENDPOINT = 'https://api.vitalcv.com';

function resolveBaseEndpoint(endpoint?: string): string {
  const base = endpoint || DEFAULT_API_ENDPOINT;
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

function assertFetchAvailable(fetchImpl?: typeof fetch): asserts fetchImpl is typeof fetch {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch implementation not available. Provide options.fetchFn or use Node 18+.');
  }
}

function normalizeHeaders(input?: HeadersInit): Record<string, string> {
  if (!input) {
    return {};
  }
  if (input instanceof Headers) {
    return Object.fromEntries(input.entries());
  }
  if (Array.isArray(input)) {
    return Object.fromEntries(input);
  }
  return { ...input };
}

async function partnerApiRequest<T>(
  path: string,
  init: RequestInit,
  operation: string,
  options: PartnerRequestOptions = {}
): Promise<T> {
  const fetchImpl = options.fetchFn ?? fetch;
  assertFetchAvailable(fetchImpl);

  const base = resolveBaseEndpoint(options.apiEndpoint);
  const url = new URL(base + path);

  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...normalizeHeaders(init.headers),
  };

  if (options.apiKey) {
    headers['X-Partner-Key'] = options.apiKey;
  }

  const metricLabels = {
    package: PACKAGE_NAME,
    operation,
    method: (init.method || 'GET').toUpperCase(),
    path,
  };

  const start = Date.now();
  try {
    const response = await fetchImpl(url.toString(), {
      ...init,
      headers,
      signal: options.signal,
    });
    const durationMs = Date.now() - start;

    if (!response.ok) {
      await emitMetric(REQUEST_METRIC, {
        ...metricLabels,
        status: 'error',
        httpStatus: response.status,
        durationMs,
      });
      throw new Error(`Partner API error (${operation}): ${response.status}`);
    }

    const data = (await response.json()) as T;
    await emitMetric(REQUEST_METRIC, {
      ...metricLabels,
      status: 'success',
      httpStatus: response.status,
      durationMs,
    });
    return data;
  } catch (error) {
    await emitMetric(REQUEST_METRIC, {
      ...metricLabels,
      status: 'error',
      reason: error instanceof Error ? error.message : 'unknown',
    });
    throw error;
  }
}

/**
 * Verify a VitalCV credential proof
 */
export async function verifyCredential(
  proof: CredentialProof,
  options: VerificationOptions = {}
): Promise<VerificationResult> {
  try {
    if (!proof || typeof proof !== 'object') {
      return {
        valid: false,
        error: 'Invalid proof format',
        errorCode: 'MALFORMED_PROOF',
      };
    }

    const {
      credentialId,
      holderDid,
      signature,
      issuedAt,
      claims,
      issuerPublicKey,
    } = proof;

    if (!credentialId || !holderDid || !signature || !issuedAt || !claims) {
      return {
        valid: false,
        error: 'Missing required fields in proof',
        errorCode: 'MALFORMED_PROOF',
      };
    }

    try {
      new Date(issuedAt);
    } catch {
      return {
        valid: false,
        error: 'Invalid issuedAt timestamp format',
        errorCode: 'INVALID_TIMESTAMP',
      };
    }

    if (!options.skipSignature) {
      if (!issuerPublicKey) {
        return {
          valid: false,
          error: 'Missing issuer public key for signature verification',
          errorCode: 'MISSING_PUBLIC_KEY',
        };
      }

      const signatureValid = verifyEd25519Signature(
        proof,
        signature,
        issuerPublicKey
      );

      if (!signatureValid) {
        return {
          valid: false,
          error: 'Signature verification failed',
          errorCode: 'INVALID_SIGNATURE',
        };
      }
    }

    let revoked = false;
    let revokedAt: string | undefined;
    let revocationReason: string | undefined;

    if (options.checkRevocation !== false) {
      const revocationResult = await checkRevocation(credentialId, {
        apiEndpoint: options.apiEndpoint,
        apiKey: options.apiKey,
        fetchFn: options.fetchFn,
      });

      revoked = revocationResult.revoked;
      revokedAt = revocationResult.revokedAt;
      revocationReason = revocationResult.reason;
    }

    const auditRef = generateAuditRef(credentialId, options.verifierDid);

    return {
      valid: true,
      holderDid,
      credentialId,
      issuedAt,
      claims,
      revoked,
      revokedAt,
      revocationReason,
      auditRef,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Verification failed',
      errorCode: 'VERIFICATION_ERROR',
    };
  }
}

/**
 * Check if a credential has been revoked
 */
export async function checkRevocation(
  credentialId: string,
  options: PartnerRequestOptions = {}
): Promise<RevocationCheckResult> {
  try {
    if (process.env.VITALCV_MOCK_MODE === 'true') {
      return {
        revoked: false,
      };
    }

    const data = await partnerApiRequest<{ revoked: boolean; revokedAt?: string; reason?: string }>(
      `/v1/credentials/${credentialId}/revocation`,
      {
        method: 'GET',
      },
      'checkRevocation',
      options
    );

    return {
      revoked: data.revoked || false,
      revokedAt: data.revokedAt,
      reason: data.reason,
    };
  } catch (error: any) {
    console.warn('[VitalCV SDK] Revocation check failed:', error.message);

    return {
      revoked: false,
      error: error.message,
    };
  }
}

/**
 * Verify a VitalCV passport via Partner API
 */
export async function verifyPassport(
  request: string | VerifyPassportRequest,
  options: PartnerRequestOptions = {}
): Promise<VerifyPassportResponse> {
  const payload: VerifyPassportRequest =
    typeof request === 'string' ? { passportId: request } : request;

  return partnerApiRequest<VerifyPassportResponse>(
    '/partner/v1/passports/verify',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    'verifyPassport',
    options
  );
}

/**
 * Fetch timeline entries for an organization
 */
export async function fetchTimeline(
  organizationId: string,
  options: FetchTimelineOptions = {}
): Promise<TimelineEntry[]> {
  if (!organizationId) {
    throw new Error('organizationId is required');
  }

  return partnerApiRequest<TimelineEntry[]>(
    `/partner/v1/organizations/${organizationId}/timeline`,
    {
      method: 'GET',
    },
    'fetchTimeline',
    {
      ...options,
      query: {
        limit: options.limit,
        cursor: options.cursor,
      },
    }
  );
}

/**
 * Submit an enrollment request for a new organization/applicant
 */
export async function submitEnrollmentRequest(
  request: EnrollmentRequest,
  options: PartnerRequestOptions = {}
): Promise<EnrollmentResponse> {
  if (!request || !request.organizationId) {
    throw new Error('Invalid enrollment request payload');
  }

  return partnerApiRequest<EnrollmentResponse>(
    '/partner/v1/enrollments',
    {
      method: 'POST',
      body: JSON.stringify(request),
    },
    'submitEnrollmentRequest',
    options
  );
}

/**
 * Verify Ed25519 signature
 */
function verifyEd25519Signature(
  proof: CredentialProof,
  signature: string,
  publicKey: string
): boolean {
  try {
    const message = JSON.stringify({
      credentialId: proof.credentialId,
      holderDid: proof.holderDid,
      issuedAt: proof.issuedAt,
      claims: proof.claims,
    });

    const messageBytes = Buffer.from(message, 'utf-8');
    const signatureBytes = decodeHexOrBase64(signature);
    const publicKeyBytes = decodeHexOrBase64(publicKey);

    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );
  } catch (error) {
    console.error('[VitalCV SDK] Signature verification error:', error);
    return false;
  }
}

/**
 * Decode hex or base64 string to Uint8Array
 */
function decodeHexOrBase64(str: string): Uint8Array {
  if (/^[0-9a-fA-F]+$/.test(str)) {
    return Buffer.from(str, 'hex');
  }
  return Buffer.from(str, 'base64');
}

/**
 * Generate audit reference for verification
 */
function generateAuditRef(
  credentialId: string,
  verifierDid?: string
): string {
  const timestamp = new Date().toISOString();
  const randomId = Math.random().toString(36).substring(2, 10);
  return `audit:${verifierDid || 'anon'}:${credentialId}:${timestamp}:${randomId}`;
}

export type {
  CredentialProof,
  VerificationOptions,
  VerificationResult,
  RevocationCheckResult,
  PartnerRequestOptions,
  FetchTimelineOptions,
  EnrollmentRequest,
  EnrollmentResponse,
  TimelineEntry,
  VerifyPassportRequest,
  VerifyPassportResponse,
};
