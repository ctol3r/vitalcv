// ALLOWED_EMAIL_DOMAINS: comma-separated list, e.g. "hospital.org,clinic.com"
// Default: empty → no restriction (prevents accidental lockout at foundation tier).
// When populated, only emails from listed domains may sign up.
export function getAllowedEmailDomains(): readonly string[] {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS ?? '';
  if (!raw.trim()) return [];
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export type DomainCheckResult =
  | { allowed: true }
  | { allowed: false; reason: 'domain_not_allowed' };

// Pure domain check. Empty allowedDomains → always allowed (open gate).
// Does NOT reveal whether an email address is registered (no enumeration).
export function checkEmailDomain(
  email: string,
  allowedDomains: readonly string[],
): DomainCheckResult {
  if (allowedDomains.length === 0) return { allowed: true };
  const atIdx = email.indexOf('@');
  if (atIdx < 0) return { allowed: false, reason: 'domain_not_allowed' };
  const domain = email.slice(atIdx + 1).toLowerCase();
  if (!domain) return { allowed: false, reason: 'domain_not_allowed' };
  if (allowedDomains.includes(domain)) return { allowed: true };
  return { allowed: false, reason: 'domain_not_allowed' };
}

// Safe message for denied signups — does not reveal the domain restriction list.
export const DOMAIN_DENIED_MESSAGE =
  'Sign-up is not available for this email address. Contact your administrator if you believe this is an error.';
