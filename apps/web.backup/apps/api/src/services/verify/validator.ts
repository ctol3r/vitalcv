import { Buffer } from 'node:buffer';
import type { JWK, KeyLike, JWTPayload } from 'jose';
import { decodeJwt, decodeProtectedHeader, importJWK, jwtVerify } from 'jose';
import {
  CredentialSchemaRegistry,
  CsdJwtVerifier,
  type CsdPresentationDisclosure,
} from '@chai-vc/vc-formats-csdjwt';
import { getPublicJwksPayload, type PublicJwkWithStatus } from '../../../../services/identity/signingKeyProvider';
import { checkStatusList, type StatusCheckResult } from './statuslist';
import { describeReason, type ReasonCode } from './reasons';
import type { ProofVerificationResult, StatusListPointer } from './types';
import { evaluateIssuerConfidence, TRUST_WEIGHT_THRESHOLD } from '../trust/confidence';
import { isIssuerBlacklisted } from '../trust/breach';

const DEFAULT_STATUSLIST_URL =
  process.env.STATUS_LIST_URL || `${process.env.PUBLIC_URL || 'http://localhost:4000'}/status/1`;

const schemaRegistry = new CredentialSchemaRegistry();
const keyCache = new Map<string, Promise<IssuerKeyResolution>>();

const csdVerifier = new CsdJwtVerifier({
  schemaRegistry,
  keyResolver: async ({ kid, alg }) => {
    const resolution = await resolveIssuerKey(kid, alg);
    return resolution.key;
  },
});

export interface SdJwtValidationOptions {
  token: string;
  disclosures?: Array<Record<string, any>>;
  revealGroups?: string[];
  expectedNonce?: string;
  fallbackStatusListUrl?: string;
}

export interface JwtVcValidationOptions {
  token: string;
  expectedAudience?: string;
  expectedNonce?: string;
  fallbackStatusListUrl?: string;
}

export async function validateSdJwtProof(
  options: SdJwtValidationOptions,
): Promise<ProofVerificationResult> {
  const disclosures = normalizeDisclosures(options.disclosures ?? []);
  const hint = decodeSdJwtHint(options.token);
  const pointer = normalizeStatusPointer(hint?.credentialStatus, hint?.credentialId);
  const statusCheck = await checkStatusList(pointer, options.fallbackStatusListUrl ?? DEFAULT_STATUSLIST_URL);

  if (statusCheck.revoked) {
    return buildFailureResult('sd-jwt', 'REVoked', {
      credentialId: hint?.credentialId,
      credentialType: deriveCredentialType(hint?.credentialType),
      status: 'revoked',
      statusCheck,
      token: options.token,
    });
  }

  try {
    const verification = await csdVerifier.verify({
      csdJwt: options.token,
      disclosures,
      revealGroups: options.revealGroups ?? [],
      expectedNonce: options.expectedNonce,
    });

    if (!verification.valid) {
      const reasonCode = mapCsdFailureToReason(verification.code);
      return buildFailureResult('sd-jwt', reasonCode, {
        credentialId: hint?.credentialId,
        credentialType: deriveCredentialType(hint?.credentialType),
        status: reasonCode === 'NONCEReuse' ? 'invalid' : 'invalid',
        statusCheck,
        reason: verification.error,
        token: options.token,
      });
    }

    const credential = verification.credential;
    const issuerDid = deriveIssuerDid(credential?.issuer, verification.issuer);
    if (issuerDid && isIssuerBlacklisted(issuerDid)) {
      return buildFailureResult('sd-jwt', 'ISSUERBlacklisted', {
        credentialId: credential?.id ?? hint?.credentialId,
        credentialType: deriveCredentialType(credential?.type),
        status: 'invalid',
        statusCheck,
        reason: `Issuer ${issuerDid} is blocked due to trust breaches`,
        token: options.token,
        warnings: ['Issuer blacklisted - reject credential'],
      });
    }
    const expiresAt = credential?.expirationDate;
    if (expiresAt && Date.now() > Date.parse(expiresAt)) {
      return buildFailureResult('sd-jwt', 'EXPired', {
        credentialId: credential?.id ?? hint?.credentialId,
        credentialType: deriveCredentialType(credential?.type),
        status: 'expired',
        statusCheck,
        token: options.token,
      });
    }

    const result: ProofVerificationResult = {
      proofType: 'sd-jwt',
      valid: true,
      status: 'valid',
      credentialId: credential?.id ?? hint?.credentialId,
      credentialType: deriveCredentialType(credential?.type),
      issuer: {
        did: credential?.issuer?.id ?? credential?.issuer ?? verification.issuer,
        name: credential?.issuer?.name,
        kid: verification.proof?.kid,
      },
      holder: {
        subject: verification.subject,
      },
      timestamps: {
        issuedAt: credential?.issuanceDate,
        expiresAt: credential?.expirationDate,
      },
      disclosure: {
        fields: verification.revealedClaims ?? {},
        manifest: verification.manifest,
        groups: verification.groups,
        proof: verification.proof,
      },
      revocation: buildRevocationResult(statusCheck),
      raw: {
        credential,
        payload: undefined,
        token: options.token,
      },
    };
    return attachTrustMetadata(result, issuerDid);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SD-JWT verification failed';
    return buildFailureResult('sd-jwt', 'SIGInvalid', {
      credentialId: hint?.credentialId,
      credentialType: deriveCredentialType(hint?.credentialType),
      status: 'invalid',
      statusCheck,
      reason: message,
      token: options.token,
    });
  }
}

export async function validateJwtVcProof(
  options: JwtVcValidationOptions,
): Promise<ProofVerificationResult> {
  let payload: JWTPayload;
  let protectedHeader: ReturnType<typeof decodeProtectedHeader>;

  try {
    payload = decodeJwt(options.token);
    protectedHeader = decodeProtectedHeader(options.token);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to decode JWT payload';
    return buildFailureResult('jwt-vc', 'SIGInvalid', {
      status: 'invalid',
      reason: message,
      token: options.token,
    });
  }

  const credential = extractCredentialFromPayload(payload);
  const pointer = normalizeStatusPointer(
    credential?.credentialStatus,
    credential?.id ?? (payload.jti as string | undefined),
  );
  const statusCheck = await checkStatusList(pointer, options.fallbackStatusListUrl ?? DEFAULT_STATUSLIST_URL);

  if (statusCheck.revoked) {
    return buildFailureResult('jwt-vc', 'REVoked', {
      credentialId: pointer?.credentialId,
      credentialType: deriveCredentialType(credential?.type),
      status: 'revoked',
      statusCheck,
      token: options.token,
    });
  }

  try {
    const resolution = await resolveIssuerKey(protectedHeader.kid, protectedHeader.alg);
    const issuer = deriveIssuerDid(credential?.issuer, payload.iss);
    if (issuer && isIssuerBlacklisted(issuer)) {
      return buildFailureResult('jwt-vc', 'ISSUERBlacklisted', {
        credentialId: credential?.id ?? (payload.jti as string | undefined),
        credentialType: deriveCredentialType(credential?.type),
        status: 'invalid',
        statusCheck,
        reason: `Issuer ${issuer} is blocked due to trust breaches`,
        token: options.token,
        warnings: ['Issuer blacklisted - reject credential'],
      });
    }
    const verification = await jwtVerify(options.token, resolution.key, {
      issuer,
      audience: options.expectedAudience,
    });

    if (
      options.expectedNonce &&
      verification.payload?.nonce &&
      verification.payload.nonce !== options.expectedNonce
    ) {
      return buildFailureResult('jwt-vc', 'NONCEReuse', {
        credentialId: credential?.id,
        credentialType: deriveCredentialType(credential?.type),
        status: 'invalid',
        statusCheck,
        token: options.token,
      });
    }

    const expiresAt =
      credential?.expirationDate ?? isoFromNumericDate(verification.payload.exp as number | undefined);
    if (expiresAt && Date.now() > Date.parse(expiresAt)) {
      return buildFailureResult('jwt-vc', 'EXPired', {
        credentialId: credential?.id,
        credentialType: deriveCredentialType(credential?.type),
        status: 'expired',
        statusCheck,
        token: options.token,
      });
    }

    const result: ProofVerificationResult = {
      proofType: 'jwt-vc',
      valid: true,
      status: 'valid',
      credentialId: credential?.id ?? (payload.jti as string | undefined),
      credentialType: deriveCredentialType(credential?.type),
      issuer: {
        did: issuer,
        name: credential?.issuer?.name,
        kid: resolution.record.kid,
        jwksUri: resolution.record.jwksUri,
      },
      holder: {
        subject: payload.sub as string | undefined,
      },
      timestamps: {
        issuedAt:
          credential?.issuanceDate ?? isoFromNumericDate(verification.payload.nbf as number | undefined),
        expiresAt,
      },
      disclosure: {
        fields: credential?.credentialSubject ?? {},
      },
      revocation: buildRevocationResult(statusCheck),
      raw: {
        credential,
        payload: verification.payload as Record<string, any>,
        token: options.token,
      },
    };
    return attachTrustMetadata(result, issuer);
  } catch (error) {
    const reason: ReasonCode =
      error instanceof IssuerKeyError ? 'ISSUERUntrusted' : 'SIGInvalid';
    const message = error instanceof Error ? error.message : 'JWT verification failed';
    return buildFailureResult('jwt-vc', reason, {
      credentialId: credential?.id,
      credentialType: deriveCredentialType(credential?.type),
      status: 'invalid',
      statusCheck,
      reason: message,
      token: options.token,
    });
  }
}

interface IssuerKeyResolution {
  key: KeyLike;
  jwk: JWK;
  record: PublicJwkWithStatus & { jwksUri?: string };
}

async function resolveIssuerKey(kid?: string, alg?: string): Promise<IssuerKeyResolution> {
  const cacheKey = `${kid ?? 'active'}`;
  if (keyCache.has(cacheKey)) {
    return keyCache.get(cacheKey)!;
  }

  const promise = (async () => {
    const snapshot = await getPublicJwksPayload();
    const candidates = selectKeyCandidate(snapshot.keys, kid);
    const jwk = sanitizePublicJwk(candidates.key.publicJwk ?? candidates.key);
    const key = await importJWK(jwk, alg ?? jwk.alg ?? 'EdDSA');
    return {
      key,
      jwk,
      record: {
        ...candidates.key,
      },
    };
  })();

  keyCache.set(cacheKey, promise);
  return promise;
}

function selectKeyCandidate(
  keys: PublicJwkWithStatus[],
  kid?: string,
): { key: PublicJwkWithStatus } {
  if (kid) {
    const match = keys.find((entry) => entry.kid === kid);
    if (!match) {
      throw new IssuerKeyError(`Issuer key ${kid} not found`);
    }
    return { key: match };
  }

  const active = keys.find((entry) => entry.status === 'active');
  if (!active) {
    throw new IssuerKeyError('No active issuer keys available');
  }
  return { key: active };
}

function sanitizePublicJwk(jwk: JWK): JWK {
  const clone = { ...jwk };
  delete (clone as any).status;
  delete (clone as any).createdAt;
  delete (clone as any).rotatedAt;
  delete (clone as any).use;
  return clone;
}

class IssuerKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IssuerKeyError';
  }
}

function normalizeDisclosures(entries: Array<Record<string, any>>): CsdPresentationDisclosure[] {
  return entries
    .filter((entry) => entry && typeof entry.path === 'string')
    .map((entry) => ({
      groupId: entry.groupId || 'default',
      path: entry.path,
      salt: entry.salt,
      value: entry.value,
    }));
}

function decodeSdJwtHint(token: string): { credentialStatus?: StatusListPointer; credentialId?: string; credentialType?: string | string[] } | null {
  try {
    const segments = token.split('.');
    if (segments.length < 2) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'));
    const vc = payload?.vc;
    return {
      credentialStatus: vc?.credentialStatus,
      credentialId: vc?.id ?? payload?.jti,
      credentialType: vc?.type,
    };
  } catch {
    return null;
  }
}

function normalizeStatusPointer(
  pointer?: StatusListPointer | Record<string, any>,
  credentialId?: string,
): StatusListPointer | undefined {
  if (!pointer && !credentialId) {
    return undefined;
  }
  if (!pointer) {
    return { credentialId };
  }
  return {
    statusListCredential: pointer.statusListCredential ?? pointer.url ?? pointer.id,
    statusListIndex: pointer.statusListIndex ?? pointer.index,
    statusPurpose: pointer.statusPurpose,
    credentialId: credentialId ?? pointer.credentialId,
  };
}

function mapCsdFailureToReason(code?: string): ReasonCode {
  if (code === 'nonce_mismatch') {
    return 'NONCEReuse';
  }
  return 'SIGInvalid';
}

function buildRevocationResult(statusCheck: StatusCheckResult): ProofVerificationResult['revocation'] {
  return {
    revoked: statusCheck.revoked,
    statusListUrl: statusCheck.pointer?.url,
    statusListIndex: statusCheck.pointer?.index?.toString(),
    checkedAt: statusCheck.checkedAt,
    reason: statusCheck.reason,
    statusCheck,
  };
}

function buildFailureResult(
  proofType: ProofVerificationResult['proofType'],
  code: ReasonCode,
  context: {
    credentialId?: string;
    credentialType?: string;
    status: ProofVerificationResult['status'];
    statusCheck?: StatusCheckResult;
    reason?: string;
    token?: string;
    warnings?: string[];
  },
): ProofVerificationResult {
  const descriptor = describeReason(code, {
    message: context.reason,
  });
  return {
    proofType,
    valid: false,
    status: context.status,
    credentialId: context.credentialId,
    credentialType: context.credentialType,
    issuer: {},
    holder: {},
    timestamps: {},
    disclosure: {
      fields: {},
    },
    revocation: buildRevocationResult(
      context.statusCheck ?? {
        revoked: false,
        checkedAt: new Date().toISOString(),
      },
    ),
    reasonCode: code,
    reason: descriptor.message,
    warnings: context.warnings ?? [],
    raw: {
      token: context.token,
    },
  };
}

async function attachTrustMetadata(
  result: ProofVerificationResult,
  issuerDid?: string,
): Promise<ProofVerificationResult> {
  if (!issuerDid) {
    return result;
  }

  try {
    const trust = await evaluateIssuerConfidence(issuerDid);
    const warnings = result.warnings ? [...result.warnings] : [];
    if (trust.requiresSecondFactor) {
      warnings.push('Issuer trust weight below threshold - capture secondary proof');
    }

    return {
      ...result,
      warnings,
      trust: {
        issuerDid,
        confidence: trust.confidence,
        requiresSecondFactor: trust.requiresSecondFactor,
        threshold: TRUST_WEIGHT_THRESHOLD,
        adjustedWeight: trust.adjustedNormalized,
        lineageDepth: trust.lineageDepth,
        federationPath: trust.federationPath,
        notes: trust.notes,
      },
    };
  } catch (error) {
    console.warn('[verify][trust] unable to attach trust metadata', error);
    return result;
  }
}

function deriveCredentialType(value: any): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.find((entry) => entry !== 'VerifiableCredential');
  }
  return undefined;
}

function deriveIssuerDid(issuerField: any, fallback?: string): string | undefined {
  if (typeof issuerField === 'string') {
    return issuerField;
  }
  if (issuerField && typeof issuerField.id === 'string') {
    return issuerField.id;
  }
  return fallback;
}

function isoFromNumericDate(value?: number): string | undefined {
  if (!value) {
    return undefined;
  }
  return new Date(value * 1000).toISOString();
}

function extractCredentialFromPayload(payload: JWTPayload): any {
  if (payload.vc && typeof payload.vc === 'object') {
    return payload.vc;
  }
  if (payload.credential && typeof payload.credential === 'object') {
    return payload.credential;
  }
  return undefined;
}

import { isTrusted, listTrustedIssuers } from '../trust/registry';
import { isInFederation } from '../trust/federation';

export interface TrustEvaluationResult {
  trusted: boolean;
  issuerDid?: string;
  reason?: 'ISSUERUntrusted' | 'ISSUERUnknown' | 'FEDERATION_TRUST' | 'ISSUERBlacklisted';
  viaFederation?: boolean;
  parentIssuerDid?: string;
  federationPath?: string[];
  federationTrustLevel?: number;
  confidence?: number;
  requiresSecondFactor?: boolean;
  trustThreshold?: number;
  notes?: string[];
}

export function peekIssuerDidFromVpToken(token?: string): string | undefined {
  if (!token) {
    return undefined;
  }

  try {
    const payload = decodeJwt(token);
    return extractIssuerFromPayload(payload);
  } catch {
    return undefined;
  }
}

export function extractIssuerFromPayload(payload: JWTPayload): string | undefined {
  if (typeof payload.iss === 'string') {
    return payload.iss;
  }

  if (payload.vp && typeof payload.vp === 'object') {
    const vp = payload.vp as Record<string, any>;
    if (vp.verifiableCredential) {
      const credential = Array.isArray(vp.verifiableCredential)
        ? vp.verifiableCredential[0]
        : vp.verifiableCredential;
      if (credential?.iss) {
        return credential.iss as string;
      }
      if (credential?.issuer) {
        if (typeof credential.issuer === 'string') {
          return credential.issuer;
        }
        if (credential.issuer?.id) {
          return credential.issuer.id;
        }
      }
    }
  }

  return undefined;
}

export async function ensureTrustedIssuer(
  vpToken: string,
  fallbackIssuer?: string,
): Promise<TrustEvaluationResult> {
  const issuerDid = fallbackIssuer ?? peekIssuerDidFromVpToken(vpToken);
  if (!issuerDid) {
    return {
      trusted: false,
      reason: 'ISSUERUnknown',
    };
  }

  if (isIssuerBlacklisted(issuerDid)) {
    return {
      trusted: false,
      issuerDid,
      reason: 'ISSUERBlacklisted',
    };
  }

  const trusted = await isTrusted(issuerDid);
  if (!trusted) {
    const federated = await resolveFederatedIssuer(issuerDid);
    if (federated) {
      return enrichEvaluationWithConfidence({
        trusted: true,
        issuerDid,
        reason: 'FEDERATION_TRUST',
        viaFederation: true,
        parentIssuerDid: federated.parentDid,
        federationPath: federated.path,
        federationTrustLevel: federated.minimumTrustLevel,
      });
    }

    return {
      trusted: false,
      issuerDid,
      reason: 'ISSUERUntrusted',
    };
  }

  return enrichEvaluationWithConfidence({
    trusted: true,
    issuerDid,
  });
}

async function resolveFederatedIssuer(candidateDid: string) {
  const parents = await listTrustedIssuers();
  for (const parent of parents) {
    const resolution = await isInFederation(parent.did, candidateDid);
    if (resolution) {
      return resolution;
    }
  }
  return null;
}

async function enrichEvaluationWithConfidence(result: TrustEvaluationResult): Promise<TrustEvaluationResult> {
  if (!result.issuerDid || !result.trusted) {
    return result;
  }

  try {
    const trust = await evaluateIssuerConfidence(result.issuerDid);
    return {
      ...result,
      confidence: trust.confidence,
      requiresSecondFactor: trust.requiresSecondFactor,
      trustThreshold: TRUST_WEIGHT_THRESHOLD,
      notes: trust.notes,
    };
  } catch (error) {
    console.warn('[verify][trust] unable to hydrate trust evaluation', error);
    return result;
  }
}

