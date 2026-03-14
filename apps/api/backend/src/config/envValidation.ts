/**
 * Wave 196 — Environment Validation
 *
 * Validates required and optional env vars at startup.
 * Adds PROGRAM_GRAVITY_WELL feature flags.
 */

import { log } from '../obs/logger';

export type FeatureFlagKey =
  | 'FEATURE_TRUST_ANCHORS'
  | 'FEATURE_NPI_DID_BINDING'
  | 'FEATURE_SD_JWT_ISSUER'
  | 'FEATURE_PSV_ADAPTERS'
  | 'FEATURE_CREDENTIAL_INGESTION'
  | 'FEATURE_OID4VC'
  | 'FEATURE_VERTICAL_IMAGING'
  | 'FEATURE_VERTICAL_BH'
  | 'FEATURE_READINESS_ENGINE'
  | 'FEATURE_OPERATOR_SEARCH'
  | 'FEATURE_DRAWER_SYSTEM'
  | 'FEATURE_MISSION_OPS_V2'
  | 'FEATURE_CONTRACT_REGISTRY';

const GRAVITY_WELL_FLAGS: Record<FeatureFlagKey, boolean> = {
  FEATURE_TRUST_ANCHORS:     false,
  FEATURE_NPI_DID_BINDING:   false,
  FEATURE_SD_JWT_ISSUER:     false,
  FEATURE_PSV_ADAPTERS:      false,
  FEATURE_CREDENTIAL_INGESTION: false,
  FEATURE_OID4VC:            false,
  FEATURE_VERTICAL_IMAGING:  false,
  FEATURE_VERTICAL_BH:       false,
  FEATURE_READINESS_ENGINE:  false,
  FEATURE_OPERATOR_SEARCH:   false,
  FEATURE_DRAWER_SYSTEM:     false,
  FEATURE_MISSION_OPS_V2:    false,
  FEATURE_CONTRACT_REGISTRY: false,
};

function parseBool(val: string | undefined, fallback = false): boolean {
  if (val === undefined) return fallback;
  return val === 'true' || val === '1';
}

export function getFeatureFlag(name: FeatureFlagKey): boolean {
  const envVal = process.env[name];
  if (envVal !== undefined) return parseBool(envVal);
  return GRAVITY_WELL_FLAGS[name] ?? false;
}

export function validateEnv(): void {
  const isProduction = process.env.NODE_ENV === 'production';

  // --- Required ---
  if (!process.env.DATABASE_URL) {
    if (isProduction) {
      log('error', 'env_validation_fatal', { missing: 'DATABASE_URL' });
      throw new Error('[EnvValidation] DATABASE_URL is required in production');
    } else {
      log('warn', 'env_validation_missing', { key: 'DATABASE_URL', note: 'required in prod' });
    }
  }

  if (getFeatureFlag('FEATURE_SD_JWT_ISSUER') && !process.env.ISSUER_KEY_ENCRYPTION_SECRET) {
    if (isProduction) {
      log('error', 'env_validation_fatal', { missing: 'ISSUER_KEY_ENCRYPTION_SECRET' });
      throw new Error('[EnvValidation] ISSUER_KEY_ENCRYPTION_SECRET is required when SD-JWT issuance is enabled');
    }

    log('warn', 'env_validation_missing', {
      key: 'ISSUER_KEY_ENCRYPTION_SECRET',
      note: 'required when FEATURE_SD_JWT_ISSUER is enabled',
    });
  }

  // --- Optional, warn if absent ---
  const optionalKeys: { key: string; note: string }[] = [
    { key: 'OPENAI_API_KEY',    note: 'LLM provider will use stub mode' },
    { key: 'CLERK_SECRET_KEY',  note: 'Auth will be degraded' },
    { key: 'JWT_SECRET',        note: 'JWT signing will use fallback' },
    { key: 'ISSUER_BASE_URL',   note: 'OID4VC metadata will use default base URL' },
    { key: 'FSMB_API_URL',      note: 'FSMB PSV adapter will use stub' },
  ];

  for (const { key, note } of optionalKeys) {
    if (!process.env[key]) {
      log('warn', 'env_validation_optional_missing', { key, note });
    }
  }

  // --- Gravity Well feature flags (log active ones) ---
  const activeFlags = (Object.keys(GRAVITY_WELL_FLAGS) as FeatureFlagKey[])
    .filter((f) => getFeatureFlag(f));

  if (activeFlags.length > 0) {
    log('info', 'env_gravity_well_flags_active', { flags: activeFlags });
  }

  log('info', 'env_validation_complete', { environment: process.env.NODE_ENV ?? 'development' });
}
