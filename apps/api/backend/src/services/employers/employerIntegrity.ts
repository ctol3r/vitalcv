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

export function reconcileOpenRoleCount(storedCount: number | null | undefined, liveCount: number | null | undefined): number {
  if (typeof liveCount === 'number' && liveCount >= 0) {
    return liveCount;
  }
  return typeof storedCount === 'number' && storedCount >= 0 ? storedCount : 0;
}
