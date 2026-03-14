import { getFeatureFlag } from '../../config/envValidation';
import { log } from '../../obs/logger';

const DEFAULT_STATE_LICENSE_VERIFICATION_FRESHNESS_DAYS = 90;

export function isCredentialIngestionEnabled(): boolean {
  return getFeatureFlag('FEATURE_CREDENTIAL_INGESTION');
}

export function getStateLicenseVerificationFreshnessDays(): number {
  const raw = process.env.STATE_LICENSE_VERIFICATION_FRESHNESS_DAYS?.trim();
  if (!raw) {
    return DEFAULT_STATE_LICENSE_VERIFICATION_FRESHNESS_DAYS;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  log('warn', 'credential_ingestion_invalid_state_license_freshness_days', {
    raw,
    fallback: DEFAULT_STATE_LICENSE_VERIFICATION_FRESHNESS_DAYS,
  });
  return DEFAULT_STATE_LICENSE_VERIFICATION_FRESHNESS_DAYS;
}
