import { slugifyEmployerName } from './employerCatalog';

const RESERVED_PLACEHOLDER_HOSTS = new Set([
  'example.com',
  'www.example.com',
]);

const LEGAL_SUFFIXES = new Set([
  'inc',
  'incorporated',
  'llc',
  'ltd',
  'limited',
  'corp',
  'corporation',
  'co',
  'company',
  'pllc',
]);

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function stripLegalSuffixes(tokens: string[]): string[] {
  const cleaned = [...tokens];
  while (cleaned.length > 1) {
    const last = cleaned[cleaned.length - 1];
    if (!LEGAL_SUFFIXES.has(last)) {
      break;
    }
    cleaned.pop();
  }
  return cleaned;
}

export function normalizeOrganizationDisplayName(value: string): string {
  return collapseWhitespace(value);
}

export function normalizeOrganizationName(value: string): string {
  const normalized = collapseWhitespace(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ');
  const tokens = normalized.split(' ').filter(Boolean);
  return stripLegalSuffixes(tokens).join(' ').trim();
}

export function normalizeOrganizationWebsite(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const candidate = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }

  url.hostname = url.hostname.toLowerCase();
  return url.toString();
}

export function extractOrganizationDomain(value: string | null | undefined): string | null {
  const normalized = normalizeOrganizationWebsite(value);
  if (!normalized) {
    return null;
  }

  const hostname = new URL(normalized).hostname.toLowerCase();
  return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
}

export function isPlaceholderOrganizationDomain(value: string | null | undefined): boolean {
  const domain = value?.trim().toLowerCase();
  if (!domain) {
    return false;
  }

  return RESERVED_PLACEHOLDER_HOSTS.has(domain) || domain.endsWith('.example.com');
}

export function hasPublicSafeOrganizationDomain(value: string | null | undefined): boolean {
  const domain = extractOrganizationDomain(value);
  return Boolean(domain) && !isPlaceholderOrganizationDomain(domain);
}

export function buildCanonicalOrganizationIdentity(input: {
  name: string;
  website?: string | null;
}): {
  displayName: string;
  normalizedName: string;
  website: string | null;
  domain: string | null;
  canonicalKey: string;
  slug: string;
} {
  const displayName = normalizeOrganizationDisplayName(input.name);
  const normalizedName = normalizeOrganizationName(displayName);
  const website = normalizeOrganizationWebsite(input.website);
  const domain = extractOrganizationDomain(website);
  const canonicalKey = domain && !isPlaceholderOrganizationDomain(domain)
    ? `domain:${domain}`
    : `name:${normalizedName}`;
  const slugBase = slugifyEmployerName(normalizedName || displayName || 'organization');

  return {
    displayName,
    normalizedName,
    website,
    domain,
    canonicalKey,
    slug: slugBase || 'organization',
  };
}

/**
 * Free/consumer mailbox providers. An address at one of these proves the person
 * controls that mailbox — never that they may administer an organization, so it
 * can never satisfy the work-domain authority check.
 */
const PUBLIC_EMAIL_PROVIDERS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'pm.me',
  'duck.com',
]);

export function isPublicEmailProvider(domain: string | null | undefined): boolean {
  const d = domain?.trim().toLowerCase();
  return Boolean(d) && PUBLIC_EMAIL_PROVIDERS.has(d!);
}

export function extractEmailDomain(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();
  if (!trimmed) return null;
  // Whitespace ANYWHERE (not just the domain) means malformed — fail closed
  // rather than parse a domain out of it.
  if (/\s/.test(trimmed)) return null;
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return null;
  const domain = trimmed.slice(at + 1);
  if (!domain.includes('.')) return null;
  return domain.startsWith('www.') ? domain.slice(4) : domain;
}

export type OrganizationAuthorityReason =
  | 'work_domain_match'
  | 'no_org_domain'
  | 'public_email_provider'
  | 'placeholder_domain'
  | 'domain_mismatch'
  | 'no_account_email';

/**
 * Decide whether a signed-in account may be granted administrative access to an
 * organization WITHOUT human review.
 *
 * The only self-serve authority signal VitalCV currently has is a work email at
 * the organization's own domain. NPPES existence is NOT authority: it proves the
 * organization exists, never that this person may act for it — which is exactly
 * the takeover hole this closes. Everything that isn't a clean work-domain match
 * routes to manual review rather than being granted.
 *
 * Residual risk (deliberately not overclaimed): a domain match proves control of
 * THAT domain, not that the name belongs to you. Name↔domain binding and the
 * pending-request/approval model are separate follow-ups.
 */
export function resolveOrganizationAuthority(input: {
  accountEmail: string | null | undefined;
  organizationDomain: string | null | undefined;
}): { authorized: boolean; reason: OrganizationAuthorityReason; emailDomain: string | null } {
  const emailDomain = extractEmailDomain(input.accountEmail);
  if (!emailDomain) return { authorized: false, reason: 'no_account_email', emailDomain: null };

  const orgDomain = input.organizationDomain?.trim().toLowerCase() || null;
  if (!orgDomain) return { authorized: false, reason: 'no_org_domain', emailDomain };
  if (isPlaceholderOrganizationDomain(orgDomain)) {
    return { authorized: false, reason: 'placeholder_domain', emailDomain };
  }
  if (isPublicEmailProvider(emailDomain)) {
    return { authorized: false, reason: 'public_email_provider', emailDomain };
  }
  if (emailDomain !== orgDomain) return { authorized: false, reason: 'domain_mismatch', emailDomain };

  return { authorized: true, reason: 'work_domain_match', emailDomain };
}

/** Honest, non-leaky explanation shown when self-serve access is refused. */
export function describeOrganizationAuthorityRefusal(reason: OrganizationAuthorityReason): string {
  switch (reason) {
    case 'no_org_domain':
      return 'Add the organization’s website so we can match it to your work email, or request access for manual review.';
    case 'public_email_provider':
      return 'A personal email address can’t establish authority over an organization. Sign in with your work email at the organization’s domain, or request access for manual review.';
    case 'placeholder_domain':
      return 'That website isn’t a real organization domain. Use the organization’s own domain, or request access for manual review.';
    case 'domain_mismatch':
      return 'Your work email domain doesn’t match this organization’s domain. Request access and a VitalCV reviewer will verify your authority.';
    case 'no_account_email':
      return 'We couldn’t read a verified email for your account. Request access for manual review.';
    default:
      return 'Request access and a VitalCV reviewer will verify your authority.';
  }
}

export function reconcileOpenRoleCount(storedCount: number | null | undefined, liveCount: number | null | undefined): number {
  if (typeof liveCount === 'number' && liveCount >= 0) {
    return liveCount;
  }
  return typeof storedCount === 'number' && storedCount >= 0 ? storedCount : 0;
}
