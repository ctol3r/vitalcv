import { describe, expect, it } from 'vitest';

import { validatePilotIntake } from '@/lib/pilot-intake/validate';

const baseValid = {
  fullName: 'Macie Miller',
  email: 'macie@example-cvo.com',
  organization: 'Example CVO',
  persona: 'cvo',
  description: 'We credential 200 clinicians/quarter and want a pilot.',
};

describe('validatePilotIntake — happy path', () => {
  it('returns ok with trimmed fields for valid input', () => {
    const result = validatePilotIntake({
      ...baseValid,
      fullName: '  Macie Miller  ',
      email: '  macie@example-cvo.com ',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.fullName).toBe('Macie Miller');
      expect(result.value.email).toBe('macie@example-cvo.com');
    }
  });
});

describe('validatePilotIntake — required fields', () => {
  it.each(['fullName', 'email', 'organization', 'persona', 'description'] as const)(
    'flags %s as required when missing',
    (field) => {
      const input = { ...baseValid, [field]: '' };
      const result = validatePilotIntake(input);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors[field]).toBeTruthy();
    },
  );

  it('returns errors for completely empty input', () => {
    const result = validatePilotIntake({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(
        ['description', 'email', 'fullName', 'organization', 'persona'].sort(),
      );
    }
  });

  it('returns errors for null input', () => {
    const result = validatePilotIntake(null);
    expect(result.ok).toBe(false);
  });
});

describe('validatePilotIntake — email shape', () => {
  it.each([
    'no-at-sign',
    '@no-local-part.com',
    'no-domain@',
    'no-dot@nodomain',
    'two@@signs.com',
  ])('rejects malformed email %s', (email) => {
    const result = validatePilotIntake({ ...baseValid, email });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.email).toBe('Enter a valid email address.');
  });

  it('accepts a plain valid email', () => {
    const result = validatePilotIntake({ ...baseValid, email: 'a@b.co' });
    expect(result.ok).toBe(true);
  });
});

describe('validatePilotIntake — persona enum', () => {
  it('rejects an unknown persona', () => {
    const result = validatePilotIntake({ ...baseValid, persona: 'astronaut' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.persona).toBe('Choose one of the listed options.');
  });

  it.each(['cvo', 'payer', 'staffing_exchange', 'health_system', 'individual_clinician', 'other'])(
    'accepts %s',
    (persona) => {
      const result = validatePilotIntake({ ...baseValid, persona });
      expect(result.ok).toBe(true);
    },
  );
});

describe('validatePilotIntake — length caps', () => {
  it('rejects fullName over 200 chars', () => {
    const result = validatePilotIntake({ ...baseValid, fullName: 'a'.repeat(201) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.fullName).toContain('200');
  });

  it('rejects description over 4000 chars', () => {
    const result = validatePilotIntake({ ...baseValid, description: 'a'.repeat(4001) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.description).toContain('4000');
  });
});
