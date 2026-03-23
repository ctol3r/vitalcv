import {
  normalizeOrgName,
  deriveOrgSlug,
  validateOrgDomain,
  canonicalOrgKey,
  areOrgsDuplicate,
  validateOrg,
} from '../../../services/entity/orgDataIntegrity';

describe('normalizeOrgName', () => {
  it('trims whitespace', () => {
    expect(normalizeOrgName('  UCSF  ')).toBe('UCSF');
  });
  it('collapses internal whitespace', () => {
    expect(normalizeOrgName('UCSF   Medical   Center')).toBe('UCSF Medical Center');
  });
  it('applies title case', () => {
    expect(normalizeOrgName('ucsf medical center')).toBe('Ucsf Medical Center');
  });
});

describe('deriveOrgSlug', () => {
  it('produces url-safe slug', () => {
    expect(deriveOrgSlug('UCSF Medical Center')).toBe('ucsf-medical-center');
  });
  it('strips punctuation', () => {
    // apostrophe removed, period removed, spaces become dashes
    const slug = deriveOrgSlug("St. Mary's Hospital");
    expect(slug).toMatch(/^st.*mary.*hospital$/);
  });
  it('limits to 80 chars', () => {
    const long = 'A'.repeat(200);
    expect(deriveOrgSlug(long).length).toBeLessThanOrEqual(80);
  });
});

describe('validateOrgDomain', () => {
  it('passes real domains', () => {
    expect(validateOrgDomain('ucsf.edu').valid).toBe(true);
    expect(validateOrgDomain('hca.com').valid).toBe(true);
  });
  it('rejects example.com', () => {
    expect(validateOrgDomain('example.com').valid).toBe(false);
  });
  it('rejects *.example.com', () => {
    expect(validateOrgDomain('org.example.com').valid).toBe(false);
  });
  it('rejects localhost', () => {
    expect(validateOrgDomain('localhost').valid).toBe(false);
  });
  it('rejects domains without dots', () => {
    expect(validateOrgDomain('notadomain').valid).toBe(false);
  });
  it('allows null/undefined (no domain required)', () => {
    expect(validateOrgDomain(null).valid).toBe(true);
    expect(validateOrgDomain(undefined).valid).toBe(true);
  });
  it('strips https:// prefix before validating', () => {
    expect(validateOrgDomain('https://example.com').valid).toBe(false);
    expect(validateOrgDomain('https://ucsf.edu').valid).toBe(true);
  });
});

describe('areOrgsDuplicate', () => {
  it('matches case-insensitive names', () => {
    expect(areOrgsDuplicate('UCSF Medical Center', 'ucsf medical center')).toBe(true);
  });
  it('matches names with extra whitespace', () => {
    expect(areOrgsDuplicate('UCSF  Medical  Center', 'UCSF Medical Center')).toBe(true);
  });
  it('distinguishes genuinely different orgs', () => {
    expect(areOrgsDuplicate('UCSF Medical Center', 'Stanford Health Care')).toBe(false);
  });
  it('ignores punctuation in comparison', () => {
    expect(areOrgsDuplicate("St. Mary's Hospital", 'St Marys Hospital')).toBe(true);
  });
});

describe('validateOrg', () => {
  it('valid org passes', () => {
    const r = validateOrg({ name: 'UCSF Medical Center', domain: 'ucsf.edu' });
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
    expect(r.normalizedName).toBe('UCSF Medical Center');
    expect(r.slug).toBe('ucsf-medical-center');
  });
  it('rejects empty name', () => {
    const r = validateOrg({ name: '' });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('required'))).toBe(true);
  });
  it('rejects placeholder domain', () => {
    const r = validateOrg({ name: 'Test Org', domain: 'example.com' });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('Placeholder'))).toBe(true);
  });
  it('warns on normalization', () => {
    const r = validateOrg({ name: 'ucsf medical center' });
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it('allows org without domain', () => {
    const r = validateOrg({ name: 'Private Practice LLC' });
    expect(r.valid).toBe(true);
  });
});
