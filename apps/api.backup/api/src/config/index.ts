/**
 * Configuration Management
 * Tagged: cursor-batch-1105 (Tasks 0021, 0027)
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Centralized configuration with environment variable support
 */

/**
 * Cache Configuration
 */
export interface CacheConfig {
  /** DID cache positive TTL (seconds) */
  didCacheTtl: number;

  /** DID cache negative TTL (seconds) - how long to cache "not found" */
  didCacheNegativeTtl: number;

  /** JWKS cache positive TTL (seconds) */
  jwksCacheTtl: number;

  /** JWKS cache negative TTL (seconds) */
  jwksCacheNegativeTtl: number;

  /** LRU cache max size */
  lruMaxSize: number;
}

/**
 * Feature Flags
 */
export interface FeatureFlags {
  /** Enable SD-JWT support */
  enableSdJwt: boolean;

  /** Enable BBS+ signatures */
  enableBbs: boolean;

  /** Enable DIDComm v2 */
  enableDidComm: boolean;

  /** Enable webhook HMAC verification */
  enableWebhookHmac: boolean;

  /** Enable trust registry enforcement */
  enableTrustRegistry: boolean;

  /** Accept only EUDI wallet presentations (block non-EUDI when enabled) */
  acceptEudiWalletsOnly: boolean;
}

/**
 * Webhook Configuration
 */
export interface WebhookConfig {
  /** Maximum timestamp skew (seconds) */
  maxTimestampSkew: number;

  /** HMAC algorithm */
  algorithm: string;
}

/**
 * Revocation Configuration
 */
export interface RevocationConfig {
  /** Status list rollover threshold */
  rolloverThreshold: number;
}

/**
 * Observability Configuration
 */
export interface ObservabilityConfig {
  /** Enable Prometheus metrics */
  enableMetrics: boolean;

  /** Metrics port */
  metricsPort: number;

  /** Enable distributed tracing */
  enableTracing: boolean;
}

/**
 * Substrate Chain Configuration
 */
export interface SubstrateConfig {
  /** Substrate WebSocket URL */
  wsUrl: string;

  /** Enable chain integration */
  enabled: boolean;

  /** Retry attempts on connection failure */
  retryAttempts: number;

  /** Initial retry delay (ms) */
  retryDelay: number;

  /** Max retry delay (ms) */
  maxRetryDelay: number;
}

/**
 * Complete Application Configuration
 */
export interface AppConfig {
  /** Node environment */
  env: 'development' | 'production' | 'test';

  /** Server port */
  port: number;

  /** Database URL */
  databaseUrl: string;

  /** Redis URL */
  redisUrl?: string;

  /** Cache configuration */
  cache: CacheConfig;

  /** Feature flags */
  features: FeatureFlags;

  /** Webhook configuration */
  webhook: WebhookConfig;

  /** Revocation configuration */
  revocation: RevocationConfig;

  /** Observability configuration */
  observability: ObservabilityConfig;

  /** Substrate chain configuration */
  substrate: SubstrateConfig;
}

/**
 * Parse boolean from environment variable
 */
function parseEnvBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

/**
 * Parse integer from environment variable
 */
function parseEnvInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Load configuration from environment variables
 * Task 201.4 - Add SUBSTRATE_WS_URL to config
 */
export function loadConfig(): AppConfig {
  return {
    env: (process.env.NODE_ENV as any) || 'development',
    port: parseEnvInt(process.env.PORT, 3000),
    databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/chai_vc',
    redisUrl: process.env.REDIS_URL,

    cache: {
      didCacheTtl: parseEnvInt(process.env.DID_CACHE_TTL, 3600), // 1 hour default
      didCacheNegativeTtl: parseEnvInt(process.env.DID_CACHE_NEGATIVE_TTL, 300), // 5 minutes default
      jwksCacheTtl: parseEnvInt(process.env.JWKS_CACHE_TTL, 3600), // 1 hour default
      jwksCacheNegativeTtl: parseEnvInt(process.env.JWKS_CACHE_NEGATIVE_TTL, 300), // 5 minutes default
      lruMaxSize: parseEnvInt(process.env.LRU_MAX_SIZE, 1000),
    },

    features: {
      enableSdJwt: parseEnvBool(process.env.ENABLE_SD_JWT, true),
      enableBbs: parseEnvBool(process.env.ENABLE_BBS, false),
      enableDidComm: parseEnvBool(process.env.ENABLE_DIDCOMM, true),
      enableWebhookHmac: parseEnvBool(process.env.ENABLE_WEBHOOK_HMAC, true),
      enableTrustRegistry: parseEnvBool(process.env.ENABLE_TRUST_REGISTRY, true),
      acceptEudiWalletsOnly: parseEnvBool(process.env.ACCEPT_EUDI_WALLETS_ONLY, false),
    },

    webhook: {
      maxTimestampSkew: parseEnvInt(process.env.WEBHOOK_MAX_SKEW, 60),
      algorithm: process.env.WEBHOOK_ALGORITHM || 'sha256',
    },

    revocation: {
      rolloverThreshold: parseEnvInt(process.env.STATUS_LIST_ROLLOVER_THRESHOLD, 100000),
    },

    observability: {
      enableMetrics: parseEnvBool(process.env.ENABLE_METRICS, true),
      metricsPort: parseEnvInt(process.env.METRICS_PORT, 9090),
      enableTracing: parseEnvBool(process.env.ENABLE_TRACING, false),
    },

    substrate: {
      wsUrl: process.env.SUBSTRATE_WS_URL || 'ws://localhost:9944',
      enabled: parseEnvBool(process.env.SUBSTRATE_ENABLED, true),
      retryAttempts: parseEnvInt(process.env.SUBSTRATE_RETRY_ATTEMPTS, 5),
      retryDelay: parseEnvInt(process.env.SUBSTRATE_RETRY_DELAY, 1000),
      maxRetryDelay: parseEnvInt(process.env.SUBSTRATE_MAX_RETRY_DELAY, 30000),
    },
  };
}

/**
 * Global configuration instance
 */
let _config: AppConfig | null = null;

/**
 * Get application configuration
 */
export function getConfig(): AppConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

/**
 * Reset configuration (for testing)
 */
export function resetConfig(): void {
  _config = null;
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const config = getConfig();
  return config.features[feature];
}

