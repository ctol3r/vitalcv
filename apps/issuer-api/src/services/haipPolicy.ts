import { createHash } from 'node:crypto';
import { decodeJwt, decodeProtectedHeader } from 'jose';
import { type Request } from 'express';
import {
  assertAlgorithmAllowed,
  assertDpopExpValid,
  assertDpopRequired,
  assertParRequired,
  assertPkceValid,
  haipConfig,
} from '@vitalcv/haip-config';

type CNonceRecord = {
  issuedAtMs: number;
  used: boolean;
};

type HaipComplianceSnapshot = {
  signingAlg: 'ES256';
  pkceRequired: boolean;
  nonceStrict: boolean;
  downgradeProtection: boolean;
  compliant: boolean;
};

const cNonceStore = new Map<string, CNonceRecord>();
let cNonceSequence = 0;

const REQUIRED_SIGNING_ALG = 'ES256';
const REQUIRED_PKCE_METHOD = 'S256';
const STRICT_NONCE_TTL_SECONDS = Math.max(
  Math.min(haipConfig.nonce.cNonceLifetimeSeconds, 60),
  1,
);

function parseBooleanEnv(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

function parsePositiveInteger(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function normalizeString(input: unknown): string {
  return typeof input === 'string' ? input.trim() : '';
}

function normalizeBodyValue(body: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const current = value as Record<string, unknown>;
    return current[key];
  }, body);
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === 'object' && !Array.isArray(input);
}

function parseNumberPayload(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`Invalid ${field}: must be a numeric timestamp.`);
  }
  return value;
}

function parseStringPayload(value: unknown, field: string): string {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw new Error(`Invalid ${field}: must be a non-empty string.`);
  }
  return normalized;
}

function parseStringPayloadOptional(value: unknown): string {
  return parseStringPayload(value, 'token subject');
}

function parseAudienceValue(audience: unknown): string[] {
  if (Array.isArray(audience)) {
    return audience
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  if (typeof audience === 'string') {
    const parsed = audience.trim();
    return parsed.length > 0 ? [parsed] : [];
  }

  return [];
}

function cleanupExpiredNonces(nowMs: number): void {
  for (const [nonce, entry] of cNonceStore.entries()) {
    if (nowMs - entry.issuedAtMs > STRICT_NONCE_TTL_SECONDS * 1000) {
      cNonceStore.delete(nonce);
    }
  }
}

export function isStrictTransitionMode(): boolean {
  return parseBooleanEnv(process.env.STRICT_TRANSITION_MODE, false);
}

function parseScope(scope: string): string {
  return scope.trim().length > 0 ? scope.trim() : '';
}

function parseDpopHeader(request: Request): string {
  return normalizeString(request.get('dpop'));
}

function hasStrictNonceWindow(): boolean {
  return STRICT_NONCE_TTL_SECONDS <= 60;
}

function enforceNoDowngradeGuards(): void {
  const signingAlgorithms = haipConfig.allowedAlgorithms;
  const pkceMethods = haipConfig.pkce.allowedMethods;

  if (signingAlgorithms.length !== 1 || signingAlgorithms[0] !== REQUIRED_SIGNING_ALG) {
    throw new Error('HAIP downgrade disallowed: ES256 only.');
  }

  if (!haipConfig.pkce.required || pkceMethods.length !== 1 || pkceMethods[0] !== REQUIRED_PKCE_METHOD) {
    throw new Error('HAIP downgrade disallowed: PKCE S256 required.');
  }

  if (!haipConfig.par.required) {
    throw new Error('HAIP downgrade disallowed: PAR required.');
  }

  if (!haipConfig.dpop.required) {
    throw new Error('HAIP downgrade disallowed: DPoP required.');
  }
}

function validateStrictNonceWindow(): void {
  if (isStrictTransitionMode() && !hasStrictNonceWindow()) {
    throw new Error('STRICT_TRANSITION_MODE requires C_NONCE_LIFETIME_SECONDS <= 60.');
  }
}

export function isStrictNonceWindow(): boolean {
  return hasStrictNonceWindow();
}

export function issueCNonce(): string {
  cNonceSequence += 1;
  const nowMs = Date.now();
  const deterministicSeed = `${cNonceSequence}|${nowMs}|${STRICT_NONCE_TTL_SECONDS}`;
  const nonce = createHash('sha256').update(deterministicSeed).digest('hex').slice(0, 32);
  cNonceStore.set(nonce, { issuedAtMs: nowMs, used: false });
  cleanupExpiredNonces(nowMs);
  return nonce;
}

export function getCNonceLifetimeSeconds(): number {
  return STRICT_NONCE_TTL_SECONDS;
}

export function validateCNonce(nonce: string): void {
  if (!nonce) {
    throw new Error('c_nonce is required for HAIP-compliant issuance.');
  }

  const entry = cNonceStore.get(nonce);
  if (!entry) {
    throw new Error('c_nonce is unknown. Issue a nonce before credential requests.');
  }

  if (entry.used) {
    throw new Error('c_nonce replay detected.');
  }

  validateStrictNonceWindow();

  const nowMs = Date.now();
  if (nowMs - entry.issuedAtMs > STRICT_NONCE_TTL_SECONDS * 1000) {
    cNonceStore.delete(nonce);
    throw new Error('c_nonce has expired.');
  }

  entry.used = true;
  cNonceStore.set(nonce, entry);
}

export function getHaipComplianceSnapshot(): HaipComplianceSnapshot {
  const signingAlg = haipConfig.allowedAlgorithms[0] ?? REQUIRED_SIGNING_ALG;
  const pkceRequired = parseBooleanEnv(process.env.HAIP_ENFORCE, true) ? true : haipConfig.pkce.required;
  const nonceStrict = STRICT_NONCE_TTL_SECONDS <= 60;
  const downgradeProtection =
    signingAlg === REQUIRED_SIGNING_ALG &&
    pkceRequired &&
    haipConfig.pkce.allowedMethods.length === 1 &&
    haipConfig.pkce.allowedMethods[0] === REQUIRED_PKCE_METHOD &&
    haipConfig.dpop.required;

  const compliant =
    signingAlg === 'ES256' &&
    pkceRequired &&
    nonceStrict &&
    downgradeProtection &&
    haipConfig.par.required;

  return {
    signingAlg,
    pkceRequired,
    nonceStrict,
    downgradeProtection,
    compliant,
  };
}

export function validateHAIPCompliance(request: Request): void {
  if (parsePositiveInteger(process.env.C_NONCE_LIFETIME_SECONDS, STRICT_NONCE_TTL_SECONDS) !== STRICT_NONCE_TTL_SECONDS) {
    throw new Error('Inconsistent C_NONCE_LIFETIME_SECONDS configuration.');
  }

  enforceNoDowngradeGuards();
  validateStrictNonceWindow();

  const body = isRecord(request.body) ? request.body : {};
  const codeChallenge = normalizeString(normalizeBodyValue(body, 'code_challenge'));
  const codeChallengeMethod = normalizeString(normalizeBodyValue(body, 'code_challenge_method'));
  const requestUri = normalizeString(normalizeBodyValue(body, 'request_uri'));

  assertPkceValid({
    codeChallenge: codeChallenge.length > 0 ? codeChallenge : null,
    codeChallengeMethod: codeChallengeMethod.length > 0 ? codeChallengeMethod : null,
  });

  assertParRequired({
    requestUri: requestUri.length > 0 ? requestUri : null,
    scope: parseScope(normalizeString(normalizeBodyValue(body, 'scope'))),
  });

  const proof = normalizeBodyValue(body, 'proof');
  if (!isRecord(proof)) {
    throw new Error('Missing proof object.');
  }

  const proofJwt = parseStringPayload(proof.jwt, 'proof.jwt');
  const proofHeader = decodeProtectedHeader(proofJwt);
  const proofAlg = parseStringPayload(proofHeader.alg, 'proof alg');
  if (proofAlg === 'none') {
    throw new Error('Unsecured JWTs are not allowed.');
  }
  assertAlgorithmAllowed(proofAlg);

  const proofPayload = decodeJwt(proofJwt) as Record<string, unknown>;
  const proofIss = parseStringPayload(proofPayload.iss, 'proof iss');
  const proofAudiences = parseAudienceValue(proofPayload.aud);
  const proofIat = parseNumberPayload(proofPayload.iat, 'proof iat');
  const proofExp = proofPayload.exp === undefined ? null : parseNumberPayload(proofPayload.exp, 'proof exp');
  const proofJti = parseStringPayloadOptional(proofPayload.jti);
  const proofNonce = parseStringPayload(proofPayload.nonce, 'proof nonce');

  if (proofIss !== haipConfig.tokenIssuer) {
    throw new Error(`Invalid proof iss. Expected ${haipConfig.tokenIssuer}.`);
  }

  if (!proofAudiences.includes(haipConfig.tokenAudience)) {
    throw new Error(`Invalid proof aud. Expected ${haipConfig.tokenAudience}.`);
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - proofIat) > haipConfig.dpop.maxClockSkewSeconds) {
    throw new Error('proof iat is outside allowed clock skew.');
  }

  const cNonce = normalizeString(normalizeBodyValue(body, 'c_nonce'));
  if (!cNonce) {
    throw new Error('c_nonce is required.');
  }

  if (proofNonce !== cNonce) {
    throw new Error('proof.nonce must match request c_nonce.');
  }

  const dpopHeader = parseDpopHeader(request);
  if (!dpopHeader) {
    throw new Error('Missing dpop header.');
  }
  assertDpopRequired({
    dpopHeader,
    clientType: 'wallet',
  });

  assertDpopExpValid({
    exp: proofExp,
    iat: proofIat,
  });

  validateCNonce(cNonce);

  if (proofJti.length < 16) {
    throw new Error('proof.jti must be present and non-empty.');
  }
}
