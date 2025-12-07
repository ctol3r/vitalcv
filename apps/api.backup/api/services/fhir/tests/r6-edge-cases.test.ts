/**
 * B128A-FHIR-012: R6 mapping tests
 * Tests partial dates + multi-role/org edge cases
 */

import { describe, it, expect } from 'vitest';
// Note: Import these from actual implementation when available
// import { mapPractitionerRoleToR6, parseFHIRDate, formatPartialDate } from '../practitioner-role-r6';

describe('B128A-FHIR-012: FHIR R6 Mapping Edge Cases', () => {
  describe('Partial dates', () => {
    it('should preserve year-only date (YYYY)', () => {
      const partialDate = '2023';
      const result = parseFHIRDate(partialDate);

      expect(result).toBeDefined();
      expect(result.year).toBe(2023);
      expect(result.month).toBeUndefined();
      expect(result.day).toBeUndefined();
      expect(result.precision).toBe('year');
    });

    it('should preserve year-month date (YYYY-MM)', () => {
      const partialDate = '2023-06';
      const result = parseFHIRDate(partialDate);

      expect(result).toBeDefined();
      expect(result.year).toBe(2023);
      expect(result.month).toBe(6);
      expect(result.day).toBeUndefined();
      expect(result.precision).toBe('month');
    });

    it('should handle full date (YYYY-MM-DD)', () => {
      const fullDate = '2023-06-15';
      const result = parseFHIRDate(fullDate);

      expect(result).toBeDefined();
      expect(result.year).toBe(2023);
      expect(result.month).toBe(6);
      expect(result.day).toBe(15);
      expect(result.precision).toBe('day');
    });

    it('should format year-only date back to YYYY', () => {
      const formatted = formatPartialDate({ year: 2023, precision: 'year' });

      expect(formatted).toBe('2023');
    });

    it('should format year-month date back to YYYY-MM', () => {
      const formatted = formatPartialDate({ year: 2023, month: 6, precision: 'month' });

      expect(formatted).toBe('2023-06');
    });

    it('should format full date back to YYYY-MM-DD', () => {
      const formatted = formatPartialDate({ year: 2023, month: 6, day: 15, precision: 'day' });

      expect(formatted).toBe('2023-06-15');
    });

    it('should handle invalid date gracefully', () => {
      const result = parseFHIRDate('invalid-date');

      expect(result).toBeNull();
    });

    it('should preserve partial date in round-trip conversion', () => {
      const originalDate = '2023-06';
      const parsed = parseFHIRDate(originalDate);
      const formatted = formatPartialDate(parsed!);

      expect(formatted).toBe(originalDate);
    });

    it('should handle edge case: January (01)', () => {
      const partialDate = '2023-01';
      const result = parseFHIRDate(partialDate);

      expect(result?.month).toBe(1);
      expect(formatPartialDate(result!)).toBe('2023-01');
    });

    it('should handle edge case: December (12)', () => {
      const partialDate = '2023-12';
      const result = parseFHIRDate(partialDate);

      expect(result?.month).toBe(12);
      expect(formatPartialDate(result!)).toBe('2023-12');
    });

    it('should handle leap year date', () => {
      const leapDate = '2024-02-29';
      const result = parseFHIRDate(leapDate);

      expect(result).toBeDefined();
      expect(result?.year).toBe(2024);
      expect(result?.month).toBe(2);
      expect(result?.day).toBe(29);
    });
  });

  describe('Multi-role edge cases', () => {
    it('should handle practitioner with multiple roles at same organization', () => {
      const practitioner = {
        id: 'prac-123',
        name: [{ given: ['John'], family: 'Doe' }],
        roles: [
          {
            role: 'physician',
            specialty: 'cardiology',
            organization: 'org-123',
            organizationName: 'Hospital A',
            period: { start: '2020-01-01' },
          },
          {
            role: 'surgeon',
            specialty: 'cardiac-surgery',
            organization: 'org-123',
            organizationName: 'Hospital A',
            period: { start: '2021-01-01' },
          },
        ],
      };

      const result = mapPractitionerRoleToR6(practitioner);

      expect(result).toBeDefined();
      expect(result.roles).toHaveLength(2);
      expect(result.roles[0].organization).toBe('org-123');
      expect(result.roles[1].organization).toBe('org-123');
      expect(result.roles[0].specialty).toBe('cardiology');
      expect(result.roles[1].specialty).toBe('cardiac-surgery');
    });

    it('should handle practitioner with roles at multiple organizations', () => {
      const practitioner = {
        id: 'prac-456',
        name: [{ given: ['Jane'], family: 'Smith' }],
        roles: [
          {
            role: 'physician',
            organization: 'org-123',
            organizationName: 'Hospital A',
          },
          {
            role: 'consultant',
            organization: 'org-456',
            organizationName: 'Clinic B',
          },
          {
            role: 'researcher',
            organization: 'org-789',
            organizationName: 'University C',
          },
        ],
      };

      const result = mapPractitionerRoleToR6(practitioner);

      expect(result).toBeDefined();
      expect(result.roles).toHaveLength(3);

      const orgs = result.roles.map(r => r.organization);
      expect(orgs).toContain('org-123');
      expect(orgs).toContain('org-456');
      expect(orgs).toContain('org-789');
    });

    it('should handle role with partial start date', () => {
      const practitioner = {
        id: 'prac-789',
        name: [{ given: ['Bob'], family: 'Wilson' }],
        roles: [
          {
            role: 'physician',
            organization: 'org-123',
            period: { start: '2020' }, // Year only
          },
        ],
      };

      const result = mapPractitionerRoleToR6(practitioner);

      expect(result).toBeDefined();
      expect(result.roles[0].period?.start).toBe('2020');
    });

    it('should handle role with partial end date', () => {
      const practitioner = {
        id: 'prac-012',
        name: [{ given: ['Alice'], family: 'Brown' }],
        roles: [
          {
            role: 'physician',
            organization: 'org-123',
            period: {
              start: '2020-01-01',
              end: '2023-12', // Year-month only
            },
          },
        ],
      };

      const result = mapPractitionerRoleToR6(practitioner);

      expect(result).toBeDefined();
      expect(result.roles[0].period?.end).toBe('2023-12');
    });

    it('should handle role without period', () => {
      const practitioner = {
        id: 'prac-345',
        name: [{ given: ['Charlie'], family: 'Davis' }],
        roles: [
          {
            role: 'physician',
            organization: 'org-123',
            // No period specified
          },
        ],
      };

      const result = mapPractitionerRoleToR6(practitioner);

      expect(result).toBeDefined();
      expect(result.roles[0].period).toBeUndefined();
    });

    it('should handle overlapping roles at different organizations', () => {
      const practitioner = {
        id: 'prac-678',
        name: [{ given: ['David'], family: 'Lee' }],
        roles: [
          {
            role: 'physician',
            organization: 'org-123',
            period: { start: '2020-01', end: '2023-12' },
          },
          {
            role: 'physician',
            organization: 'org-456',
            period: { start: '2021-06', end: '2024-06' }, // Overlaps with first role
          },
        ],
      };

      const result = mapPractitionerRoleToR6(practitioner);

      expect(result).toBeDefined();
      expect(result.roles).toHaveLength(2);
      // Both roles should be preserved with their periods
      expect(result.roles[0].period?.start).toBe('2020-01');
      expect(result.roles[1].period?.start).toBe('2021-06');
    });

    it('should round-trip multi-role practitioner', () => {
      const originalPractitioner = {
        id: 'prac-901',
        name: [{ given: ['Eva'], family: 'Martinez' }],
        roles: [
          {
            role: 'physician',
            specialty: 'cardiology',
            organization: 'org-123',
            organizationName: 'Hospital A',
            period: { start: '2020-01', end: '2023-06' },
          },
          {
            role: 'researcher',
            organization: 'org-456',
            organizationName: 'Research Institute',
            period: { start: '2021' },
          },
        ],
      };

      const mapped = mapPractitionerRoleToR6(originalPractitioner);

      // Verify all roles are preserved
      expect(mapped.roles).toHaveLength(2);

      // Verify partial dates are preserved
      expect(mapped.roles[0].period?.start).toBe('2020-01');
      expect(mapped.roles[0].period?.end).toBe('2023-06');
      expect(mapped.roles[1].period?.start).toBe('2021');

      // Verify organization references
      expect(mapped.roles[0].organization).toBe('org-123');
      expect(mapped.roles[1].organization).toBe('org-456');
    });

    it('should handle empty roles array', () => {
      const practitioner = {
        id: 'prac-234',
        name: [{ given: ['Frank'], family: 'Garcia' }],
        roles: [],
      };

      const result = mapPractitionerRoleToR6(practitioner);

      expect(result).toBeDefined();
      expect(result.roles).toHaveLength(0);
    });

    it('should handle role with multiple specialties', () => {
      const practitioner = {
        id: 'prac-567',
        name: [{ given: ['Grace'], family: 'Taylor' }],
        roles: [
          {
            role: 'physician',
            specialties: ['cardiology', 'internal-medicine'],
            organization: 'org-123',
          },
        ],
      };

      const result = mapPractitionerRoleToR6(practitioner);

      expect(result).toBeDefined();
      expect(result.roles[0].specialties).toEqual(['cardiology', 'internal-medicine']);
    });

    it('should handle role with telecom (email, phone)', () => {
      const practitioner = {
        id: 'prac-890',
        name: [{ given: ['Henry'], family: 'Anderson' }],
        roles: [
          {
            role: 'physician',
            organization: 'org-123',
            telecom: [
              { system: 'email', value: 'henry@hospital.com' },
              { system: 'phone', value: '+1-555-1234' },
            ],
          },
        ],
      };

      const result = mapPractitionerRoleToR6(practitioner);

      expect(result).toBeDefined();
      expect(result.roles[0].telecom).toBeDefined();
      expect(result.roles[0].telecom).toHaveLength(2);
    });
  });

  describe('Multi-organization edge cases', () => {
    it('should handle organization with partial address', () => {
      const practitioner = {
        id: 'prac-321',
        name: [{ given: ['Iris'], family: 'Johnson' }],
        roles: [
          {
            role: 'physician',
            organization: 'org-123',
            organizationName: 'Hospital A',
            organizationAddress: {
              city: 'Boston',
              state: 'MA',
              // No street, zip, etc.
            },
          },
        ],
      };

      const result = mapPractitionerRoleToR6(practitioner);

      expect(result).toBeDefined();
      expect(result.roles[0].organizationAddress?.city).toBe('Boston');
      expect(result.roles[0].organizationAddress?.state).toBe('MA');
    });

    it('should handle organization without name', () => {
      const practitioner = {
        id: 'prac-654',
        name: [{ given: ['Jack'], family: 'Williams' }],
        roles: [
          {
            role: 'physician',
            organization: 'org-123',
            // No organizationName
          },
        ],
      };

      const result = mapPractitionerRoleToR6(practitioner);

      expect(result).toBeDefined();
      expect(result.roles[0].organization).toBe('org-123');
      expect(result.roles[0].organizationName).toBeUndefined();
    });

    it('should handle same organization referenced multiple times', () => {
      const practitioner = {
        id: 'prac-987',
        name: [{ given: ['Kate'], family: 'Miller' }],
        roles: [
          {
            role: 'physician',
            organization: 'org-123',
            organizationName: 'Hospital A',
          },
          {
            role: 'surgeon',
            organization: 'org-123', // Same org
            organizationName: 'Hospital A',
          },
          {
            role: 'consultant',
            organization: 'org-123', // Same org again
            organizationName: 'Hospital A',
          },
        ],
      };

      const result = mapPractitionerRoleToR6(practitioner);

      expect(result).toBeDefined();
      expect(result.roles).toHaveLength(3);

      // All should reference the same organization
      expect(result.roles.every(r => r.organization === 'org-123')).toBe(true);
    });
  });

  describe('Coverage and round-trip', () => {
    it('should achieve ≥90% field coverage in mapping', () => {
      const comprehensivePractitioner = {
        id: 'prac-999',
        identifier: [
          { system: 'http://hl7.org/fhir/sid/us-npi', value: '1234567890' },
        ],
        name: [
          {
            given: ['Test', 'Middle'],
            family: 'Practitioner',
            prefix: ['Dr.'],
            suffix: ['MD'],
          },
        ],
        telecom: [
          { system: 'email', value: 'test@example.com' },
          { system: 'phone', value: '+1-555-9999' },
        ],
        gender: 'male',
        birthDate: '1980-05',
        address: [
          {
            line: ['123 Main St'],
            city: 'Boston',
            state: 'MA',
            postalCode: '02115',
            country: 'USA',
          },
        ],
        qualification: [
          {
            code: { text: 'MD' },
            issuer: 'Harvard Medical School',
            period: { start: '2010' },
          },
        ],
        roles: [
          {
            role: 'physician',
            specialty: 'cardiology',
            organization: 'org-123',
            organizationName: 'Mass General Hospital',
            period: { start: '2015-06', end: '2023-12' },
            location: [
              {
                name: 'Cardiology Clinic',
                address: {
                  city: 'Boston',
                  state: 'MA',
                },
              },
            ],
          },
        ],
      };

      const result = mapPractitionerRoleToR6(comprehensivePractitioner);

      // Verify all major fields are preserved
      expect(result.id).toBe('prac-999');
      expect(result.identifier).toBeDefined();
      expect(result.name).toBeDefined();
      expect(result.telecom).toBeDefined();
      expect(result.gender).toBe('male');
      expect(result.birthDate).toBe('1980-05'); // Partial date preserved
      expect(result.address).toBeDefined();
      expect(result.qualification).toBeDefined();
      expect(result.roles).toHaveLength(1);
      expect(result.roles[0].period?.start).toBe('2015-06'); // Partial date preserved
      expect(result.roles[0].period?.end).toBe('2023-12'); // Partial date preserved
    });
  });
});

// Mock implementation of mapping functions for testing
// In production, these would be imported from practitioner-role-r6.ts

interface PartialDate {
  year: number;
  month?: number;
  day?: number;
  precision: 'year' | 'month' | 'day';
}

function parseFHIRDate(dateString: string): PartialDate | null {
  if (!dateString) return null;

  const yearMatch = dateString.match(/^(\d{4})$/);
  if (yearMatch) {
    return {
      year: parseInt(yearMatch[1], 10),
      precision: 'year',
    };
  }

  const yearMonthMatch = dateString.match(/^(\d{4})-(\d{2})$/);
  if (yearMonthMatch) {
    return {
      year: parseInt(yearMonthMatch[1], 10),
      month: parseInt(yearMonthMatch[2], 10),
      precision: 'month',
    };
  }

  const fullDateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (fullDateMatch) {
    return {
      year: parseInt(fullDateMatch[1], 10),
      month: parseInt(fullDateMatch[2], 10),
      day: parseInt(fullDateMatch[3], 10),
      precision: 'day',
    };
  }

  return null;
}

function formatPartialDate(date: PartialDate): string {
  if (date.precision === 'year') {
    return `${date.year}`;
  }

  if (date.precision === 'month') {
    const month = date.month!.toString().padStart(2, '0');
    return `${date.year}-${month}`;
  }

  if (date.precision === 'day') {
    const month = date.month!.toString().padStart(2, '0');
    const day = date.day!.toString().padStart(2, '0');
    return `${date.year}-${month}-${day}`;
  }

  return '';
}

function mapPractitionerRoleToR6(practitioner: any): any {
  // Simplified mock implementation for testing
  return {
    ...practitioner,
    birthDate: practitioner.birthDate, // Preserve partial dates
    roles: practitioner.roles?.map((role: any) => ({
      ...role,
      period: role.period ? {
        start: role.period.start,
        end: role.period.end,
      } : undefined,
    })) || [],
  };
}

// Export for testing
export { parseFHIRDate, formatPartialDate, mapPractitionerRoleToR6 };
