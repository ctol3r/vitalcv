import { createHash } from 'crypto';
import { decodeProtectedHeader, jwtVerify, createLocalJWKSet } from 'jose';
import { getPublicKeyJwk } from '@/lib/crypto/receiptIssuer';

export const RECEIPT_ISSUER = 'https://vitalcv.com';
export const RECEIPT_AUDIENCE = 'vitalcv:receipt-verifier';
export const RECEIPT_ALLOWED_ALG = 'ES256';

export interface ReceiptVerificationHeader {
  alg: typeof RECEIPT_ALLOWED_ALG;
  kid: string;
}

export interface ReceiptClaimsSummary {
  receiptId?: string;
  subjectHash?: string;
  clinicianHash?: string;
  issuer: typeof RECEIPT_ISSUER;
  audience: typeof RECEIPT_AUDIENCE;
  issuedAt?: number;
  expiresAt?: number;
  proofTier?: string;
  status?: string;
  warnings: string[];
  limitations: string[];
}

export interface ReceiptVerificationResult {
  verified: boolean;
  header?: ReceiptVerificationHeader;
  payload?: ReceiptClaimsSummary;
  error?: string;
  errorCode?:
    | 'signature_invalid'
    | 'token_expired'
    | 'algorithm_rejected'
    | 'malformed'
    | 'unsigned'
    | 'wrong_kid'
    | 'wrong_issuer'
    | 'wrong_audience'
    | 'receipt_state_rejected'
    | 'unknown';
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function readVcvStatus(payload: Record<string, unknown>): string | undefined {
  const topLevelStatus = asString(payload['status']);
  if (topLevelStatus) return topLevelStatus;

  const vcv = payload['vcv'];
  if (typeof vcv === 'object' && vcv !== null) {
    return asString((vcv as Record<string, unknown>)['status']);
  }

  return undefined;
}

function buildClaimsSummary(payload: Record<string, unknown>): ReceiptClaimsSummary {
  const subject = asString(payload['sub']);
  const subjectHash = asString(payload['subjectHash']) ?? (subject ? sha256(subject) : undefined);
  const clinicianHash = asString(payload['clinicianHash']);
  const warnings: string[] = [];
  const limitations = [
    'Cryptographic receipt validation checks JWT integrity only.',
    'This is not legal acceptance, credentialing clearance, or source attestation by itself.',
  ];

  if (subject && !asString(payload['subjectHash'])) {
    warnings.push('Receipt subject was hashed before returning the verification result.');
  }

  return {
    ...(asString(payload['jti']) ? { receiptId: asString(payload['jti']) } : {}),
    ...(subjectHash ? { subjectHash } : {}),
    ...(clinicianHash ? { clinicianHash } : {}),
    issuer: RECEIPT_ISSUER,
    audience: RECEIPT_AUDIENCE,
    ...(asNumber(payload['iat']) ? { issuedAt: asNumber(payload['iat']) } : {}),
    ...(asNumber(payload['exp']) ? { expiresAt: asNumber(payload['exp']) } : {}),
    ...(asString(payload['proofTier']) ? { proofTier: asString(payload['proofTier']) } : {}),
    ...(readVcvStatus(payload) ? { status: readVcvStatus(payload) } : {}),
    warnings,
    limitations,
  };
}

function classifyJoseError(message: string): ReceiptVerificationResult['errorCode'] {
  if (message.includes('"iss"') || message.toLowerCase().includes('issuer')) return 'wrong_issuer';
  if (message.includes('"aud"') || message.toLowerCase().includes('audience')) return 'wrong_audience';
  if (message.includes('signature')) return 'signature_invalid';
  if (message.includes('expired') || message.includes('exp')) return 'token_expired';
  if (message.includes('alg') || message.includes('algorithm')) return 'algorithm_rejected';
  if (message.includes('malformed') || message.includes('Invalid')) return 'malformed';
  return 'unknown';
}

export async function verifyReceiptJWT(token: string): Promise<ReceiptVerificationResult> {
  try {
    const segments = token.split('.');
    if (segments.length !== 3 || !segments[0] || !segments[1]) {
      return { verified: false, error: 'malformed compact JWT', errorCode: 'malformed' };
    }

    const header = decodeProtectedHeader(token);
    if (header.alg !== RECEIPT_ALLOWED_ALG) {
      return { verified: false, error: 'receipt algorithm rejected', errorCode: 'algorithm_rejected' };
    }

    const publicJwk = await getPublicKeyJwk();
    const expectedKid = asString(publicJwk['kid']);
    if (!expectedKid || header.kid !== expectedKid) {
      return { verified: false, error: 'receipt key id rejected', errorCode: 'wrong_kid' };
    }

    if (!segments[2]) {
      return { verified: false, error: 'unsigned receipt token rejected', errorCode: 'unsigned' };
    }

    const JWKS = createLocalJWKSet({ keys: [publicJwk] } as Parameters<typeof createLocalJWKSet>[0]);
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: [RECEIPT_ALLOWED_ALG],
      issuer: RECEIPT_ISSUER,
      audience: RECEIPT_AUDIENCE,
    });

    const safePayload = payload as Record<string, unknown>;
    if (readVcvStatus(safePayload) === 'unable_to_verify') {
      return {
        verified: false,
        error: 'unable_to_verify receipts cannot be validated as proof',
        errorCode: 'receipt_state_rejected',
      };
    }

    return {
      verified: true,
      header: { alg: RECEIPT_ALLOWED_ALG, kid: expectedKid },
      payload: buildClaimsSummary(safePayload),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    return { verified: false, error: message, errorCode: classifyJoseError(message) };
  }
}
