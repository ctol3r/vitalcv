const EXAMPLE_PROVIDER_NAME_PATTERNS = [
  /^ada lovelace(?:,\s*md)?$/i,
  /^dr\.?\s*sarah chen$/i,
  /^sarah chen$/i,
  /^dr\.?\s*james okafor$/i,
  /^james okafor$/i,
] as const;

const SYNTHETIC_PROVIDER_LABEL_PATTERNS = [
  /^provider not found in nppes$/i,
  /^resolution unavailable$/i,
  /^unknown provider$/i,
  /^unknown organization$/i,
] as const;

const TRUST_STATE_IDENTITY_FACT_TYPES = new Set([
  'PERSONAL_IDENTITY',
  'NPI_IDENTITY',
  'IDENTITYCLAIM',
  'IDENTITY_CLAIM',
]);

const TRUST_STATE_SPECIALTY_FACT_TYPES = new Set([
  'SPECIALTY',
]);

type TrustStateFactLike = {
  factType?: string | null;
  details?: string | null;
};

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeFactType(value: string | null | undefined): string {
  return typeof value === 'string'
    ? value.trim().replace(/[\s-]+/g, '_').toUpperCase()
    : '';
}

function isTenDigitNpi(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d{10}$/.test(value.trim());
}

export function isExampleProviderName(
  displayName: string | null | undefined,
): boolean {
  if (typeof displayName !== 'string') {
    return false;
  }

  const normalized = normalizeName(displayName);
  return EXAMPLE_PROVIDER_NAME_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isSyntheticProviderLabel(
  displayName: string | null | undefined,
): boolean {
  if (typeof displayName !== 'string') {
    return false;
  }

  const normalized = normalizeName(displayName);
  return SYNTHETIC_PROVIDER_LABEL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function resolvePublicProviderDisplayName(input: {
  displayName?: string | null;
  npi?: string | null;
  fallbackLabel?: string;
}): string {
  const trimmed = typeof input.displayName === 'string'
    ? normalizeName(input.displayName)
    : '';

  if (
    trimmed.length > 0
    && !isExampleProviderName(trimmed)
    && !isSyntheticProviderLabel(trimmed)
  ) {
    return trimmed;
  }

  if (isTenDigitNpi(input.npi)) {
    return `NPI ${input.npi.trim()}`;
  }

  return input.fallbackLabel ?? 'Provider';
}

export function resolveTrustStateIdentityDisplayName(
  facts: readonly TrustStateFactLike[] | null | undefined,
): string | null {
  if (!Array.isArray(facts)) {
    return null;
  }

  for (const fact of facts) {
    if (!TRUST_STATE_IDENTITY_FACT_TYPES.has(normalizeFactType(fact.factType))) {
      continue;
    }

    if (typeof fact.details !== 'string') {
      continue;
    }

    const normalized = normalizeName(fact.details);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return null;
}

export function resolveTrustStateSpecialty(
  facts: readonly TrustStateFactLike[] | null | undefined,
): string | null {
  if (!Array.isArray(facts)) {
    return null;
  }

  for (const fact of facts) {
    if (!TRUST_STATE_SPECIALTY_FACT_TYPES.has(normalizeFactType(fact.factType))) {
      continue;
    }

    if (typeof fact.details !== 'string') {
      continue;
    }

    const trimmed = fact.details.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
}

export function resolvePublicProviderSpecialty(input: {
  displayName?: string | null;
  specialty?: string | null;
}): string | null {
  if (
    isExampleProviderName(input.displayName)
    || isSyntheticProviderLabel(input.displayName)
  ) {
    return null;
  }

  if (typeof input.specialty !== 'string') {
    return null;
  }

  const trimmed = input.specialty.trim();
  return trimmed.length > 0 ? trimmed : null;
}
