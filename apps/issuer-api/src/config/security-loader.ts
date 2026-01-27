/**
 * Security Configuration Loader
 * B119A-SEC-001: DPoP and mTLS configuration
 */

export interface TenantMtlsConfig {
  enabled: boolean;
  allowed_for_confidential: boolean;
}

/**
 * Get tenant-specific mTLS configuration
 * @param tenantId - Optional tenant identifier
 * @returns mTLS configuration for the tenant
 */
export function getTenantMtlsConfig(_tenantId?: string): TenantMtlsConfig {
  return {
    enabled: process.env.MTLS_ENABLED === 'true',
    allowed_for_confidential: process.env.MTLS_ALLOWED_FOR_CONFIDENTIAL !== 'false',
  };
}

/**
 * Check if DPoP is required (default: true)
 * @returns true if DPoP validation is required
 */
export function isDpopRequired(): boolean {
  return process.env.DPOP_REQUIRED !== 'false';
}

/**
 * Get allowed DPoP signature algorithms
 * B109A-TBIND-002: JOSE allowlist for DPoP proofs
 * @returns Array of allowed algorithms (default: EdDSA, ES256)
 */
export function getDpopAlgorithms(): string[] {
  const envValue = process.env.DPOP_ALGORITHMS || process.env.DPOP_ALGS;
  if (!envValue) {
    return ['EdDSA', 'ES256'];  // Default allowlist
  }
  return envValue
    .split(',')
    .map((alg) => alg.trim())
    .filter(Boolean);
}
