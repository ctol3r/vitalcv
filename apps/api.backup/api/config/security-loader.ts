/**
 * B119A-SEC-001: Security Configuration Loader
 * Loads security.yml and provides tenant-specific configuration
 */

import * as fs from 'fs';
import * as path from 'path';

// Try to load js-yaml, fallback to manual parsing if not available
let yaml: any;
try {
  yaml = require('js-yaml');
} catch {
  // Fallback: use simple YAML-like parsing or environment variables
  yaml = null;
}

export interface SecurityConfig {
  security: {
    dpop: {
      enabled: boolean;
      required: boolean;
      default: boolean;
    };
    mtls: {
      enabled: boolean;
      allowed_for_confidential: boolean;
    };
    tenants?: {
      [tenantId: string]: {
        mtls?: {
          enabled: boolean;
          allowed_for_confidential: boolean;
        };
      };
    };
    token_binding_methods: string[];
    dpop_algorithms: string[];
    jti_cache_ttl_seconds: number;
    nonce_skew_tolerance_seconds: number;
  };
}

let cachedConfig: SecurityConfig | null = null;

/**
 * Load security configuration from security.yml
 */
export function loadSecurityConfig(): SecurityConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.join(__dirname, 'security.yml');

  try {
    const fileContents = fs.readFileSync(configPath, 'utf8');

    if (yaml && yaml.load) {
      cachedConfig = yaml.load(fileContents) as SecurityConfig;
    } else {
      // Fallback: parse JSON if YAML parser not available
      try {
        cachedConfig = JSON.parse(fileContents) as SecurityConfig;
      } catch {
        // If file exists but can't parse, use environment variables
        cachedConfig = loadFromEnv();
        return cachedConfig;
      }
    }

    // Validate required fields
    if (!cachedConfig?.security) {
      throw new Error('Invalid security.yml: missing security section');
    }

    return cachedConfig;
  } catch (error) {
    console.warn('Failed to load security.yml, using defaults:', error);
    // Return default configuration or load from env
    cachedConfig = loadFromEnv();
    return cachedConfig;
  }
}

/**
 * Load configuration from environment variables as fallback
 */
function loadFromEnv(): SecurityConfig {
  return {
    security: {
      dpop: {
        enabled: process.env.DPOP_ENABLED !== 'false',
        required: process.env.DPOP_REQUIRED !== 'false',
        default: process.env.DPOP_DEFAULT !== 'false',
      },
      mtls: {
        enabled: process.env.MTLS_ENABLED === 'true',
        allowed_for_confidential: process.env.MTLS_ALLOWED_FOR_CONFIDENTIAL === 'true',
      },
      token_binding_methods: process.env.TOKEN_BINDING_METHODS?.split(',') || ['DPoP'],
      dpop_algorithms: process.env.DPOP_ALGORITHMS?.split(',') || ['ES256', 'EdDSA'],
      jti_cache_ttl_seconds: parseInt(process.env.JTI_CACHE_TTL_SECONDS || '60', 10),
      nonce_skew_tolerance_seconds: parseInt(process.env.NONCE_SKEW_TOLERANCE_SECONDS || '60', 10),
    },
  };
}

/**
 * Get tenant-specific mTLS configuration
 * B119A-SEC-001: Returns tenant-specific mTLS settings or defaults
 */
export function getTenantMtlsConfig(tenantId?: string): {
  enabled: boolean;
  allowed_for_confidential: boolean;
} {
  const config = loadSecurityConfig();
  const defaultMtls = config.security.mtls;

  // If no tenant ID provided, return default
  if (!tenantId || !config.security.tenants?.[tenantId]) {
    return defaultMtls;
  }

  // Return tenant-specific config, falling back to defaults
  const tenantConfig = config.security.tenants[tenantId];
  return {
    enabled: tenantConfig.mtls?.enabled ?? defaultMtls.enabled,
    allowed_for_confidential: tenantConfig.mtls?.allowed_for_confidential ?? defaultMtls.allowed_for_confidential,
  };
}

/**
 * Check if DPoP is required (always true per B119A-SEC-001)
 */
export function isDpopRequired(): boolean {
  const config = loadSecurityConfig();
  return config.security.dpop.required && config.security.dpop.enabled;
}

/**
 * Get DPoP algorithms allowlist
 */
export function getDpopAlgorithms(): string[] {
  const config = loadSecurityConfig();
  return config.security.dpop_algorithms;
}

/**
 * Reset cached config (for testing)
 */
export function resetSecurityConfig(): void {
  cachedConfig = null;
}

