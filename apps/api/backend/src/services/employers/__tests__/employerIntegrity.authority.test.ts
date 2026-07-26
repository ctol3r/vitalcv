/**
 * Employer organization authority — the gate that stops org takeover.
 *
 * Before this, creating an organization required only a signed-in account and a
 * self-typed name: an NPPES lookup proves the org EXISTS, never that the caller
 * may act for it. These cases pin the rule that ONLY a work email at the
 * organization's own domain grants self-serve access; everything else refuses
 * and routes to manual review.
 */
import {
  describeOrganizationAuthorityRefusal,
  extractEmailDomain,
  isPublicEmailProvider,
  resolveOrganizationAuthority,
} from '../employerIntegrity';

describe('extractEmailDomain', () => {
  it('reads the domain, lowercased, www-stripped', () => {
    expect(extractEmailDomain('Chris@Kp.ORG')).toBe('kp.org');
    expect(extractEmailDomain('a@www.kp.org')).toBe('kp.org');
  });

  it('rejects malformed addresses', () => {
    for (const bad of ['', '   ', 'nope', '@kp.org', 'chris@', 'chris@localhost', 'a b@kp.org', null, undefined]) {
      expect(extractEmailDomain(bad as string)).toBeNull();
    }
  });
});

describe('isPublicEmailProvider', () => {
  it('flags consumer mailboxes', () => {
    for (const d of ['gmail.com', 'outlook.com', 'icloud.com', 'proton.me', 'yahoo.com']) {
      expect(isPublicEmailProvider(d)).toBe(true);
    }
  });

  it('does not flag a real employer domain', () => {
    expect(isPublicEmailProvider('kp.org')).toBe(false);
  });
});

describe('resolveOrganizationAuthority — the takeover gate', () => {
  it('GRANTS only on a work-email domain match', () => {
    const r = resolveOrganizationAuthority({ accountEmail: 'chris@kp.org', organizationDomain: 'kp.org' });
    expect(r.authorized).toBe(true);
    expect(r.reason).toBe('work_domain_match');
  });

  it('REFUSES the core takeover: a stranger claiming an org they have no email at', () => {
    const r = resolveOrganizationAuthority({ accountEmail: 'attacker@evil.com', organizationDomain: 'kp.org' });
    expect(r.authorized).toBe(false);
    expect(r.reason).toBe('domain_mismatch');
  });

  it('REFUSES a personal mailbox even when the org domain is echoed back', () => {
    // The pre-fix hole: self-typed website + any signed-in account = granted.
    const r = resolveOrganizationAuthority({ accountEmail: 'someone@gmail.com', organizationDomain: 'gmail.com' });
    expect(r.authorized).toBe(false);
    expect(r.reason).toBe('public_email_provider');
  });

  it('REFUSES when no org domain was supplied (NPPES existence is not authority)', () => {
    const r = resolveOrganizationAuthority({ accountEmail: 'chris@kp.org', organizationDomain: null });
    expect(r.authorized).toBe(false);
    expect(r.reason).toBe('no_org_domain');
  });

  it('REFUSES placeholder domains', () => {
    const r = resolveOrganizationAuthority({ accountEmail: 'a@example.com', organizationDomain: 'example.com' });
    expect(r.authorized).toBe(false);
    expect(r.reason).toBe('placeholder_domain');
  });

  it('REFUSES when the account has no readable email (fails closed)', () => {
    const r = resolveOrganizationAuthority({ accountEmail: null, organizationDomain: 'kp.org' });
    expect(r.authorized).toBe(false);
    expect(r.reason).toBe('no_account_email');
  });

  it('is case/format insensitive on the match', () => {
    expect(resolveOrganizationAuthority({ accountEmail: 'C@KP.org', organizationDomain: 'kp.org' }).authorized).toBe(true);
  });

  it('every refusal explains a next step and never leaks internals', () => {
    for (const reason of [
      'no_org_domain',
      'public_email_provider',
      'placeholder_domain',
      'domain_mismatch',
      'no_account_email',
    ] as const) {
      const msg = describeOrganizationAuthorityRefusal(reason);
      expect(msg.length).toBeGreaterThan(20);
      expect(msg).toMatch(/request access|work email|website|domain/i);
    }
  });
});
