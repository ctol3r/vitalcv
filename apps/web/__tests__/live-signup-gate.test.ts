import { describe, expect, it } from 'vitest';
import {
  checkEmailDomain,
  getAllowedEmailDomains,
  DOMAIN_DENIED_MESSAGE,
} from '@/lib/auth/signupGate';

// Case 1 — default (ALLOWED_EMAIL_DOMAINS unset): no restriction
describe('getAllowedEmailDomains — default config', () => {
  it('returns empty array when ALLOWED_EMAIL_DOMAINS is not set', () => {
    // process.env.ALLOWED_EMAIL_DOMAINS is not set in the test environment
    expect(getAllowedEmailDomains()).toEqual([]);
  });
});

// Case 2 — empty allow-list passes all emails through
describe('checkEmailDomain — empty allow-list (open gate)', () => {
  it('allows any email when allow-list is empty', () => {
    const result = checkEmailDomain('anyone@any-domain.com', []);
    expect(result.allowed).toBe(true);
  });
});

// Case 3 — matching domain is allowed
describe('checkEmailDomain — matching domain', () => {
  it('allows email whose domain is in the allow-list', () => {
    const result = checkEmailDomain('clinician@hospital.org', ['hospital.org', 'clinic.com']);
    expect(result.allowed).toBe(true);
  });
});

// Case 4 — non-matching domain is blocked; message does not reveal domain list
describe('checkEmailDomain — domain not in allow-list', () => {
  it('blocks email whose domain is not in the allow-list', () => {
    const result = checkEmailDomain('attacker@outside.example.com', ['hospital.org']);
    expect(result.allowed).toBe(false);
  });

  it('safe denial message does not enumerate allowed domains', () => {
    // The message must NOT contain "hospital.org" or any domain name
    expect(DOMAIN_DENIED_MESSAGE).not.toContain('hospital.org');
    expect(DOMAIN_DENIED_MESSAGE).not.toContain('@');
    // Must be a safe generic message
    expect(DOMAIN_DENIED_MESSAGE.length).toBeGreaterThan(20);
  });
});

// Case 5 — malformed email (no @) is rejected
describe('checkEmailDomain — malformed email', () => {
  it('blocks email with no @ character', () => {
    const result = checkEmailDomain('notanemail', ['hospital.org']);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe('domain_not_allowed');
    }
  });
});
