import { describe, it, expect, beforeEach } from '@jest/globals';
import { applyDirectoryConsent, getDirectoryConsent, resetDirectoryConsents, setDirectoryConsent } from '../consent.js';

describe('TEFCA directory consent', () => {
  beforeEach(() => {
    resetDirectoryConsents();
  });

  it('defaults to sharing enabled', () => {
    expect(getDirectoryConsent('practitioner-1')).toBe(true);
  });

  it('stores opt-out preference and hides locations', () => {
    setDirectoryConsent('practitioner-1', false);

    const role = {
      resourceType: 'PractitionerRole',
      id: 'role-1',
      practitioner: { reference: 'Practitioner/practitioner-1' },
      location: [{ display: 'Main Campus' }],
    };

    const redacted = applyDirectoryConsent(role);

    expect(redacted.location).toBeUndefined();
  });

  it('keeps locations when consent is enabled', () => {
    setDirectoryConsent('practitioner-2', true);

    const role = {
      resourceType: 'PractitionerRole',
      id: 'role-2',
      practitioner: { reference: 'Practitioner/practitioner-2' },
      location: [{ display: 'Clinic A' }],
    };

    const untouched = applyDirectoryConsent(role);
    expect(untouched.location).toBeDefined();
  });
});

