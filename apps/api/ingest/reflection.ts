import { getIntakeSummary, hasIntakeData, type IntakeSummary } from './intakeStore';

const PENDING_VERIFICATION = 'Pending verification';
const MISSING_REQUIRED_PSV = 'Missing required PSV';
const IDENTITY_CONFLICT = 'Identity conflict detected';
const FAILED_VERIFICATION = 'Failed verification check';

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function intakeSummaryForTrustState(clinician_id: string): IntakeSummary {
  return getIntakeSummary(clinician_id);
}

export function intakeBlockingReasonMessages(
  clinician_id: string,
  blocking_reasons: readonly string[],
): readonly string[] {
  if (!hasIntakeData(clinician_id)) {
    return Object.freeze([]);
  }

  const normalized = new Set(blocking_reasons);
  const messages: string[] = [];

  if (
    normalized.has('MISSING_PSV') ||
    normalized.has('MISSING_RECOGNITION') ||
    normalized.has('CRS_BELOW_THRESHOLD')
  ) {
    messages.push(MISSING_REQUIRED_PSV);
  }

  if (
    normalized.has('MISSING_PSV') ||
    normalized.has('MISSING_RECOGNITION') ||
    normalized.has('MISSING_ACCEPTANCE') ||
    normalized.has('CRS_BELOW_THRESHOLD')
  ) {
    messages.push(PENDING_VERIFICATION);
  }

  if (
    normalized.has('IDENTITY_CONFLICT') ||
    normalized.has('IDENTITY_CONFLICT_DETECTED') ||
    normalized.has('MISSING_IDENTITY_MATCH')
  ) {
    messages.push(IDENTITY_CONFLICT);
  }

  if (
    normalized.has('FAILED_VERIFICATION') ||
    normalized.has('REVOKED_PSV')
  ) {
    messages.push(FAILED_VERIFICATION);
  }

  if (messages.length === 0) {
    messages.push(MISSING_REQUIRED_PSV, PENDING_VERIFICATION);
  }

  return Object.freeze(dedupe(messages));
}
