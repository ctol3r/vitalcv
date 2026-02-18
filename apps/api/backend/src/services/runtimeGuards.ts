/**
 * Runtime Guards — Wave N
 *
 * Called on server boot. Aborts startup if the production environment
 * violates zero-downgrade security rules.
 *
 * Guards:
 *   1. STRICT_TRANSITION_MODE must be true in production
 *   2. Signing key must be present
 *   3. Issuer registry must not be empty (ISSUER_DID configured)
 *   4. Transparency log must be active (DATABASE_URL set)
 */

import { log } from '../obs/logger';
import { evaluateHaipNoDowngrade } from '../utils/haip';
import { getConfiguredIssuerDid } from '../utils/issuerDid';
import { isStrictTransitionMode, parseBooleanEnv } from '../utils/environment';

export type RuntimeGuardResult = {
  passed: boolean;
  failures: string[];
};

function isSigningKeyPresent(): boolean {
  const raw =
    process.env.ISSUER_SIGNING_JWK?.trim() ??
    process.env.SIGNING_KEY_JWK?.trim() ??
    '';
  if (raw.length === 0) return false;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed.kty === 'EC' && parsed.crv === 'P-256' && parsed.alg === 'ES256';
  } catch {
    return false;
  }
}

function isSigningKeyEphemeral(): boolean {
  // An ephemeral key is one that is auto-generated at startup rather
  // than provided via env. We detect this by checking if the key lacks
  // a private component (d parameter) — production keys must be full
  // key pairs with a private key.
  const raw =
    process.env.ISSUER_SIGNING_JWK?.trim() ??
    process.env.SIGNING_KEY_JWK?.trim() ??
    '';
  if (raw.length === 0) return true;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Ephemeral if no private key component
    return typeof parsed.d !== 'string' || parsed.d.length === 0;
  } catch {
    return true;
  }
}

/**
 * Run all runtime guards. In production, any failure is fatal.
 * In non-production, failures are logged as warnings but do not
 * prevent startup.
 */
export function runRuntimeGuards(): RuntimeGuardResult {
  const isProduction = (process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production';
  const failures: string[] = [];

  // 1. STRICT_TRANSITION_MODE must be true in production
  if (isProduction && !parseBooleanEnv(process.env.STRICT_TRANSITION_MODE)) {
    failures.push('STRICT_TRANSITION_MODE must be true in production');
  }

  // 2. Signing key must be present
  if (isProduction && !isSigningKeyPresent()) {
    failures.push('Signing key (ISSUER_SIGNING_JWK or SIGNING_KEY_JWK) is missing');
  }

  // 3. Signing key must not be ephemeral in production
  if (isProduction && isSigningKeyPresent() && isSigningKeyEphemeral()) {
    failures.push('Signing key must not be ephemeral in production (missing private key component)');
  }

  // 4. Issuer registry must not be empty
  if (isProduction) {
    const issuerDid = getConfiguredIssuerDid();
    if (issuerDid.length === 0) {
      failures.push('ISSUER_DID is not configured (issuer registry empty)');
    }
  }

  // 5. Transparency log must be active (DATABASE_URL required)
  if (isProduction) {
    const dbUrl = process.env.DATABASE_URL?.trim() ?? '';
    if (dbUrl.length === 0) {
      failures.push('DATABASE_URL is not set (transparency log disabled)');
    }
  }

  const result: RuntimeGuardResult = {
    passed: failures.length === 0,
    failures,
  };

  if (failures.length > 0) {
    const level = isProduction ? 'error' : 'warn';
    log(level, 'runtime_guards_result', {
      event: 'runtime_guards_result',
      passed: false,
      failures,
      environment: process.env.NODE_ENV ?? 'development',
    });

    if (isProduction) {
      throw new Error(
        `Runtime guards failed — aborting startup:\n${failures.map((f) => `  - ${f}`).join('\n')}`,
      );
    }
  } else {
    log('info', 'runtime_guards_passed', {
      event: 'runtime_guards_passed',
      environment: process.env.NODE_ENV ?? 'development',
    });
  }

  return result;
}

// ── HAIP No-Downgrade Policy ──────────────────────────────────

export type HaipValidationResult = {
  valid: boolean;
  violations: string[];
};

/**
 * Validate that a VC/proof request does not attempt to downgrade
 * security below the HAIP baseline.
 */
export function enforceHaipNoDowngrade(params: {
  algorithm?: string;
  signed?: boolean;
  issuerType?: string;
  tokenType?: string;
}): HaipValidationResult {
  const result = evaluateHaipNoDowngrade({
    algorithm: params.algorithm,
    signed: params.signed,
    tokenType: params.tokenType,
    issuerDid: params.issuerType,
  });

  return {
    valid: result.valid,
    violations: result.violations,
  };
}

/**
 * Check if zero-downgrade security is fully enforced.
 */
export function isZeroDowngradeEnforced(): boolean {
  const isProduction = (process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production';

  if (!isProduction) {
    // In non-production, check if strict mode is configured
    return isStrictTransitionMode();
  }

  // In production, all guards must pass
  return (
    isStrictTransitionMode() &&
    isHaipNoDowngradeConfigValid() &&
    isSigningKeyPresent() &&
    !isSigningKeyEphemeral() &&
    getConfiguredIssuerDid().length > 0 &&
    (process.env.DATABASE_URL?.trim() ?? '').length > 0
  );
}

function isHaipNoDowngradeConfigValid(): boolean {
  const result = evaluateHaipNoDowngrade({
    algorithm: 'ES256',
    signed: true,
    tokenType: 'dpop',
    issuerDid: getConfiguredIssuerDid(),
  });
  return result.valid;
}
