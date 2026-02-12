const DEFAULT_REQUIRED_MANUAL_CHECKS = Object.freeze([] as string[]);
const MANUAL_STANDARD_TTL_SECONDS = 30 * 24 * 60 * 60;
const MANUAL_HIGH_RISK_TTL_SECONDS = 7 * 24 * 60 * 60;

let requiredManualChecks = DEFAULT_REQUIRED_MANUAL_CHECKS;

function normalizeCheckName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function manualReceiptTtlSeconds(subject: string): number {
  const normalizedSubject = subject.toLowerCase();
  if (normalizedSubject.includes('sanction') || normalizedSubject.includes('discipline')) {
    return MANUAL_HIGH_RISK_TTL_SECONDS;
  }

  return MANUAL_STANDARD_TTL_SECONDS;
}

export function getRequiredManualChecks(): readonly string[] {
  return requiredManualChecks;
}

export function setRequiredManualChecksForTest(checks: readonly string[]): void {
  requiredManualChecks = Object.freeze(
    checks
      .map((check) => normalizeCheckName(check))
      .filter((check): check is string => Boolean(check)),
  );
}

