export interface TenantMtlsConfig {
  enabled: boolean;
  allowed_for_confidential: boolean;
}

export function getTenantMtlsConfig(_tenantId?: string): TenantMtlsConfig {
  return {
    enabled: process.env.MTLS_ENABLED === 'true',
    allowed_for_confidential: process.env.MTLS_ALLOWED_FOR_CONFIDENTIAL !== 'false',
  };
}

export function isDpopRequired(): boolean {
  return process.env.DPOP_REQUIRED !== 'false';
}

export function getDpopAlgorithms(): string[] {
  const envValue = process.env.DPOP_ALGORITHMS || process.env.DPOP_ALGS;
  if (!envValue) {
    return ['EdDSA', 'ES256'];
  }
  return envValue
    .split(',')
    .map((alg) => alg.trim())
    .filter(Boolean);
}
