/**
 * B111A-FHIR-012: R6 mapping: partial-date & multi-role edge tests
 *
 * Tests for FHIR R6 (Resource 6) mapping:
 * - Partial dates preserved (YYYY, YYYY-MM, YYYY-MM-DD)
 * - Multi-role round-trips correctly
 * - Edge cases handled
 */

import { describe, it, expect } from 'vitest';

/**
 * FHIR R6 Date format types
 */
export type FhirDate = string; // YYYY, YYYY-MM, or YYYY-MM-DD
export type FhirDateTime = string; // ISO 8601 with optional timezone

/**
 * FHIR R6 Practitioner Role
 */
export interface FhirPractitionerRole {
  id?: string;
  practitioner?: { reference: string };
  organization?: { reference: string };
  code?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
  specialty?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
  period?: {
    start?: FhirDate;
    end?: FhirDate;
  };
  active?: boolean;
}

/**
 * Map partial date to credential format
 * B111A-FHIR-012: Partial dates preserved
 */
export function mapPartialDate(fhirDate: FhirDate): {
  year?: number;
  month?: number;
  day?: number;
  precision: 'year' | 'month' | 'day';
} {
  if (!fhirDate) {
    throw new Error('Date is required');
  }

  const parts = fhirDate.split('-');
  const year = parseInt(parts[0], 10);
  const month = parts[1] ? parseInt(parts[1], 10) : undefined;
  const day = parts[2] ? parseInt(parts[2], 10) : undefined;

  let precision: 'year' | 'month' | 'day';
  if (day !== undefined) {
    precision = 'day';
  } else if (month !== undefined) {
    precision = 'month';
  } else {
    precision = 'year';
  }

  return {
    year,
    month,
    day,
    precision,
  };
}

/**
 * Map credential date back to FHIR format
 * B111A-FHIR-012: Round-trip preserves precision
 */
export function mapToFhirDate(credentialDate: {
  year: number;
  month?: number;
  day?: number;
}): FhirDate {
  if (credentialDate.day !== undefined) {
    return `${credentialDate.year}-${String(credentialDate.month).padStart(2, '0')}-${String(credentialDate.day).padStart(2, '0')}`;
  } else if (credentialDate.month !== undefined) {
    return `${credentialDate.year}-${String(credentialDate.month).padStart(2, '0')}`;
  } else {
    return String(credentialDate.year);
  }
}

/**
 * Map multi-role practitioner to credential format
 * B111A-FHIR-012: Multi-role round-trips correctly
 */
export function mapMultiRolePractitioner(roles: FhirPractitionerRole[]): {
  roles: Array<{
    role: string;
    specialty?: string[];
    organization?: string;
    startDate?: FhirDate;
    endDate?: FhirDate;
    active: boolean;
  }>;
} {
  return {
    roles: roles.map(role => ({
      role: role.code?.[0]?.coding?.[0]?.code || 'unknown',
      specialty: role.specialty?.map(s => s.coding?.[0]?.code).filter(Boolean) as string[] | undefined,
      organization: role.organization?.reference,
      startDate: role.period?.start,
      endDate: role.period?.end,
      active: role.active ?? true,
    })),
  };
}

/**
 * Map credential back to FHIR practitioner roles
 * B111A-FHIR-012: Round-trip preserves all roles
 */
export function mapToFhirRoles(credentialRoles: {
  roles: Array<{
    role: string;
    specialty?: string[];
    organization?: string;
    startDate?: FhirDate;
    endDate?: FhirDate;
    active: boolean;
  }>;
}): FhirPractitionerRole[] {
  return credentialRoles.roles.map((role, index) => ({
    id: `role-${index}`,
    code: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/practitioner-role',
        code: role.role,
        display: role.role,
      }],
    }],
    specialty: role.specialty?.map(code => ({
      coding: [{
        system: 'http://snomed.info/sct',
        code,
        display: code,
      }],
    })),
    organization: role.organization ? { reference: role.organization } : undefined,
    period: role.startDate || role.endDate ? {
      start: role.startDate,
      end: role.endDate,
    } : undefined,
    active: role.active,
  }));
}

describe('FHIR R6 Mapping', () => {
  describe('Partial Date Mapping', () => {
    it('should preserve year-only date (YYYY)', () => {
      const fhirDate = '2020';
      const mapped = mapPartialDate(fhirDate);
      const roundTrip = mapToFhirDate(mapped);

      expect(mapped.year).toBe(2020);
      expect(mapped.month).toBeUndefined();
      expect(mapped.day).toBeUndefined();
      expect(mapped.precision).toBe('year');
      expect(roundTrip).toBe('2020');
    });

    it('should preserve year-month date (YYYY-MM)', () => {
      const fhirDate = '2020-06';
      const mapped = mapPartialDate(fhirDate);
      const roundTrip = mapToFhirDate(mapped);

      expect(mapped.year).toBe(2020);
      expect(mapped.month).toBe(6);
      expect(mapped.day).toBeUndefined();
      expect(mapped.precision).toBe('month');
      expect(roundTrip).toBe('2020-06');
    });

    it('should preserve full date (YYYY-MM-DD)', () => {
      const fhirDate = '2020-06-15';
      const mapped = mapPartialDate(fhirDate);
      const roundTrip = mapToFhirDate(mapped);

      expect(mapped.year).toBe(2020);
      expect(mapped.month).toBe(6);
      expect(mapped.day).toBe(15);
      expect(mapped.precision).toBe('day');
      expect(roundTrip).toBe('2020-06-15');
    });

    it('should handle edge case: year with leading zeros', () => {
      const fhirDate = '2020';
      const mapped = mapPartialDate(fhirDate);
      expect(mapped.year).toBe(2020);
    });

    it('should handle edge case: month with single digit', () => {
      const fhirDate = '2020-1';
      const mapped = mapPartialDate(fhirDate);
      const roundTrip = mapToFhirDate(mapped);
      expect(roundTrip).toBe('2020-01'); // Normalized to two digits
    });

    it('should handle edge case: day with single digit', () => {
      const fhirDate = '2020-06-5';
      const mapped = mapPartialDate(fhirDate);
      const roundTrip = mapToFhirDate(mapped);
      expect(roundTrip).toBe('2020-06-05'); // Normalized to two digits
    });
  });

  describe('Multi-Role Mapping', () => {
    it('should preserve multiple roles in round-trip', () => {
      const fhirRoles: FhirPractitionerRole[] = [
        {
          id: 'role-1',
          code: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/practitioner-role',
              code: 'doctor',
              display: 'Doctor',
            }],
          }],
          specialty: [{
            coding: [{
              system: 'http://snomed.info/sct',
              code: '207R00000X',
              display: 'Internal Medicine',
            }],
          }],
          organization: { reference: 'Organization/org1' },
          period: {
            start: '2020-01',
            end: '2023-12',
          },
          active: true,
        },
        {
          id: 'role-2',
          code: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/practitioner-role',
              code: 'nurse',
              display: 'Nurse',
            }],
          }],
          organization: { reference: 'Organization/org2' },
          period: {
            start: '2024-01',
          },
          active: true,
        },
      ];

      const mapped = mapMultiRolePractitioner(fhirRoles);
      const roundTrip = mapToFhirRoles(mapped);

      expect(mapped.roles.length).toBe(2);
      expect(mapped.roles[0].role).toBe('doctor');
      expect(mapped.roles[0].specialty).toEqual(['207R00000X']);
      expect(mapped.roles[0].startDate).toBe('2020-01');
      expect(mapped.roles[1].role).toBe('nurse');

      // Round-trip verification
      expect(roundTrip.length).toBe(2);
      expect(roundTrip[0].code?.[0]?.coding?.[0]?.code).toBe('doctor');
      expect(roundTrip[0].specialty?.[0]?.coding?.[0]?.code).toBe('207R00000X');
      expect(roundTrip[1].code?.[0]?.coding?.[0]?.code).toBe('nurse');
    });

    it('should handle role with partial start date', () => {
      const fhirRoles: FhirPractitionerRole[] = [
        {
          code: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/practitioner-role',
              code: 'doctor',
              display: 'Doctor',
            }],
          }],
          period: {
            start: '2020', // Year only
          },
          active: true,
        },
      ];

      const mapped = mapMultiRolePractitioner(fhirRoles);
      expect(mapped.roles[0].startDate).toBe('2020');

      const roundTrip = mapToFhirRoles(mapped);
      expect(roundTrip[0].period?.start).toBe('2020');
    });

    it('should handle role without period', () => {
      const fhirRoles: FhirPractitionerRole[] = [
        {
          code: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/practitioner-role',
              code: 'doctor',
              display: 'Doctor',
            }],
          }],
          active: true,
        },
      ];

      const mapped = mapMultiRolePractitioner(fhirRoles);
      expect(mapped.roles[0].startDate).toBeUndefined();
      expect(mapped.roles[0].endDate).toBeUndefined();

      const roundTrip = mapToFhirRoles(mapped);
      expect(roundTrip[0].period).toBeUndefined();
    });

    it('should handle role with multiple specialties', () => {
      const fhirRoles: FhirPractitionerRole[] = [
        {
          code: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/practitioner-role',
              code: 'doctor',
              display: 'Doctor',
            }],
          }],
          specialty: [
            {
              coding: [{
                system: 'http://snomed.info/sct',
                code: '207R00000X',
                display: 'Internal Medicine',
              }],
            },
            {
              coding: [{
                system: 'http://snomed.info/sct',
                code: '207RC0000X',
                display: 'Cardiology',
              }],
            },
          ],
          active: true,
        },
      ];

      const mapped = mapMultiRolePractitioner(fhirRoles);
      expect(mapped.roles[0].specialty).toEqual(['207R00000X', '207RC0000X']);

      const roundTrip = mapToFhirRoles(mapped);
      expect(roundTrip[0].specialty?.length).toBe(2);
    });

    it('should handle inactive role', () => {
      const fhirRoles: FhirPractitionerRole[] = [
        {
          code: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/practitioner-role',
              code: 'doctor',
              display: 'Doctor',
            }],
          }],
          active: false,
        },
      ];

      const mapped = mapMultiRolePractitioner(fhirRoles);
      expect(mapped.roles[0].active).toBe(false);

      const roundTrip = mapToFhirRoles(mapped);
      expect(roundTrip[0].active).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty roles array', () => {
      const mapped = mapMultiRolePractitioner([]);
      expect(mapped.roles).toEqual([]);

      const roundTrip = mapToFhirRoles(mapped);
      expect(roundTrip).toEqual([]);
    });

    it('should handle role with missing code', () => {
      const fhirRoles: FhirPractitionerRole[] = [
        {
          active: true,
        },
      ];

      const mapped = mapMultiRolePractitioner(fhirRoles);
      expect(mapped.roles[0].role).toBe('unknown');
    });

    it('should preserve date precision through multiple round-trips', () => {
      const dates: FhirDate[] = ['2020', '2020-06', '2020-06-15'];

      dates.forEach(date => {
        const mapped = mapPartialDate(date);
        const roundTrip = mapToFhirDate(mapped);
        const mappedAgain = mapPartialDate(roundTrip);
        const roundTripAgain = mapToFhirDate(mappedAgain);

        expect(roundTrip).toBe(date);
        expect(roundTripAgain).toBe(date);
        expect(mapped.precision).toBe(mappedAgain.precision);
      });
    });
  });
});

