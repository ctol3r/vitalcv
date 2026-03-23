/**
 * orgDataIntegrity.ts — Organization data integrity guardrails (M7)
 *
 * Prevents: duplicate orgs, placeholder domains, inconsistent display names.
 *
 * Rules enforced:
 *   1. Name normalization: trim, collapse whitespace, title-case
 *   2. Reject placeholder domains: *.example.com, localhost, test.*
 *   3. Canonical slug: derived from normalized name (url-safe, deduped)
 *   4. Domain validation: must be a real-looking domain if present
 */

// ── Name normalization ─────────────────────────────────────────────────────────

/**
 * Normalize an organization display name.
 * Trims, collapses whitespace, and applies consistent capitalization.
 */
export function normalizeOrgName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')           // collapse internal whitespace
    .replace(/\b\w/g, c => c.toUpperCase()); // title case
}

/**
 * Derive a URL-safe slug from a display name.
 * Example: "UCSF Medical Center" → "ucsf-medical-center"
 */
export function deriveOrgSlug(name: string): string {
  return normalizeOrgName(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

// ── Domain validation ─────────────────────────────────────────────────────────

const PLACEHOLDER_DOMAINS = new Set([
  'example.com', 'example.org', 'example.net',
  'test.com', 'localhost', '127.0.0.1',
  'placeholder.com', 'fake.com', 'domain.com',
  'yourcompany.com', 'company.com',
]);

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\.example\.(com|org|net)$/,
  /^test\./,
  /^demo\./,
  /^localhost/,
  /^staging\.\w+\.example/,
];

export interface DomainValidationResult {
  valid:   boolean;
  reason?: string;
}

/**
 * Validate an employer domain.
 * Returns { valid: false, reason } if the domain looks fake or placeholder.
 */
export function validateOrgDomain(domain: string | null | undefined): DomainValidationResult {
  if (!domain) return { valid: true }; // no domain is fine — org may not have one

  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0] ?? '';

  if (PLACEHOLDER_DOMAINS.has(clean)) {
    return { valid: false, reason: `Placeholder domain: ${clean}` };
  }

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(clean)) {
      return { valid: false, reason: `Placeholder-looking domain: ${clean}` };
    }
  }

  // Must look like a real domain: at least one dot, no spaces
  if (!clean.includes('.') || clean.includes(' ')) {
    return { valid: false, reason: `Not a valid domain: ${clean}` };
  }

  return { valid: true };
}

// ── Duplicate detection ────────────────────────────────────────────────────────

/**
 * Generate a canonical key for deduplication.
 * Two org names with the same canonical key are considered duplicates.
 * Example: "UCSF Medical Center", "ucsf medical center", "UCSF  Medical  Center"
 *   → all produce "ucsf medical center"
 */
export function canonicalOrgKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')  // strip punctuation
    .replace(/\s+/g, ' ');
}

/**
 * Check if two org names are likely duplicates.
 */
export function areOrgsDuplicate(nameA: string, nameB: string): boolean {
  return canonicalOrgKey(nameA) === canonicalOrgKey(nameB);
}

// ── Validation summary ─────────────────────────────────────────────────────────

export interface OrgValidationResult {
  valid:          boolean;
  normalizedName: string;
  slug:           string;
  canonicalKey:   string;
  errors:         string[];
  warnings:       string[];
}

/**
 * Full org validation — name + domain + duplicate key.
 * Call before creating or updating OrganizationProfile / VcvEntity.
 */
export function validateOrg(input: {
  name:    string;
  domain?: string | null;
}): OrgValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (!input.name?.trim()) {
    errors.push('Organization name is required.');
  }

  const normalizedName = normalizeOrgName(input.name ?? '');
  const slug           = deriveOrgSlug(normalizedName);
  const canonicalKey   = canonicalOrgKey(normalizedName);

  if (normalizedName.length < 2) {
    errors.push('Organization name is too short.');
  }
  if (normalizedName.length > 200) {
    errors.push('Organization name is too long (max 200 chars).');
  }

  const domainResult = validateOrgDomain(input.domain);
  if (!domainResult.valid) {
    errors.push(domainResult.reason ?? 'Invalid domain.');
  }

  if (input.name && input.name !== normalizedName) {
    warnings.push(`Name normalized: "${input.name}" → "${normalizedName}"`);
  }

  return {
    valid:          errors.length === 0,
    normalizedName,
    slug,
    canonicalKey,
    errors,
    warnings,
  };
}
