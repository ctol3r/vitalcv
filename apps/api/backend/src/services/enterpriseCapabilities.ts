/**
 * Enterprise Capabilities Descriptor — Wave L
 *
 * Returns a runtime-derived snapshot of the system's enterprise readiness.
 * Every field is computed from actual runtime state, never hardcoded.
 */

import { log } from '../obs/logger';
import { isStrictTransitionMode, parseBooleanEnv } from '../utils/environment';
import { getConfiguredIssuerDid, isValidDidFormat } from '../utils/issuerDid';

export type EnterpriseCapabilities = {
  openId4VCIReady: boolean;
  haipCompliant: boolean;
  didReady: boolean;
  selectiveDisclosureReady: boolean;
  lifecycleEngineReady: boolean;
  issuerRegistryReady: boolean;
  transparencyLogActive: boolean;
  auditPacketReady: boolean;
  strictMode: boolean;
  environment: 'development' | 'staging' | 'production';
};

// ── Runtime checks ────────────────────────────────────────────

function resolveEnvironment(): 'development' | 'staging' | 'production' {
  const raw = (process.env.NODE_ENV ?? 'development').trim().toLowerCase();
  if (raw === 'production') return 'production';
  if (raw === 'staging') return 'staging';
  return 'development';
}

function parseSigningJwkPresent(): boolean {
  const raw =
    process.env.ISSUER_SIGNING_JWK?.trim() ??
    process.env.SIGNING_KEY_JWK?.trim() ??
    '';
  if (raw.length === 0) return false;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return (
      parsed.kty === 'EC' &&
      parsed.crv === 'P-256' &&
      parsed.alg === 'ES256' &&
      parsed.use === 'sig' &&
      typeof parsed.x === 'string' &&
      typeof parsed.y === 'string'
    );
  } catch {
    return false;
  }
}

function isHaipCompliant(): boolean {
  if (!parseSigningJwkPresent()) return false;
  const pkce = parseBooleanEnv(process.env.PKCE_REQUIRED, true);
  const par = parseBooleanEnv(process.env.PAR_REQUIRED, true);
  const dpop = parseBooleanEnv(process.env.DPOP_REQUIRED, true);
  return pkce && par && dpop;
}

function isDidReady(): boolean {
  return isValidDidFormat(getConfiguredIssuerDid()) && parseSigningJwkPresent();
}

function isOpenId4VCIReady(): boolean {
  return isHaipCompliant() && isDidReady();
}

function isStrictMode(): boolean {
  return isStrictTransitionMode();
}

function isIssuerRegistryReady(): boolean {
  // Issuer registry is considered ready when an issuer DID is configured
  // and the signing key is present (i.e. we can issue credentials)
  return isDidReady() && parseSigningJwkPresent();
}

function isTransparencyLogActive(): boolean {
  // The transparency log is active when the trust ledger is
  // operational — we check if DATABASE_URL is set (meaning Prisma
  // can write TrustLedgerEntry rows).
  const dbUrl = process.env.DATABASE_URL?.trim() ?? '';
  return dbUrl.length > 0;
}

function isAuditPacketReady(): boolean {
  // Audit packets require: DB, signing key, and DID.
  return isTransparencyLogActive() && isDidReady();
}

function isSelectiveDisclosureReady(): boolean {
  // Selective disclosure is ready when the signing key is present
  // (needed for Merkle proof generation from artifactService).
  return parseSigningJwkPresent();
}

function isLifecycleEngineReady(): boolean {
  // The lifecycle engine is always structurally ready — it's a pure
  // state machine with no external dependencies. We verify it has
  // a DB to persist transitions.
  return isTransparencyLogActive();
}

// ── Public API ────────────────────────────────────────────────

export function getEnterpriseCapabilities(): EnterpriseCapabilities {
  const capabilities: EnterpriseCapabilities = {
    openId4VCIReady: isOpenId4VCIReady(),
    haipCompliant: isHaipCompliant(),
    didReady: isDidReady(),
    selectiveDisclosureReady: isSelectiveDisclosureReady(),
    lifecycleEngineReady: isLifecycleEngineReady(),
    issuerRegistryReady: isIssuerRegistryReady(),
    transparencyLogActive: isTransparencyLogActive(),
    auditPacketReady: isAuditPacketReady(),
    strictMode: isStrictMode(),
    environment: resolveEnvironment(),
  };

  log('info', 'enterprise_capabilities_computed', {
    event: 'enterprise_capabilities_computed',
    capabilities,
  });

  return capabilities;
}
