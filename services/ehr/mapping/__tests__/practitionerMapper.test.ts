/**
 * Unit tests for FHIR Practitioner/PractitionerRole mapper
 */

import { describe, it, expect } from '@jest/globals';
import {
  mapPractitionerToProvider,
  mapPractitionerRoleToProvider,
  mapEpicPractitioner,
  mapCernerPractitioner,
  FhirPractitioner,
  FhirPractitionerRole,
} from '../practitionerMapper.js';

describe('practitionerMapper', () => {
  describe('mapPractitionerToProvider', () => {
    it('should map complete FHIR Practitioner to VitalCV Provider', () => {
      const fhirPractitioner: FhirPractitioner = {
        resourceType: 'Practitioner',
        id: 'prac-123',
        identifier: [
          {
            system: 'http://hl7.org/fhir/sid/us-npi',
            value: '1234567890',
          },
        ],
        name: [
          {
            use: 'official',
            family: 'Smith',
            given: ['John', 'Robert'],
            prefix: ['Dr.'],
            suffix: ['MD'],
          },
        ],
        telecom: [
          { system: 'email', value: 'john.smith@hospital.org' },
          { system: 'phone', value: '555-1234' },
        ],
        address: [
          {
            use: 'work',
            line: ['123 Medical Plaza', 'Suite 100'],
            city: 'Boston',
            state: 'MA',
            postalCode: '02115',
            country: 'US',
          },
        ],
        gender: 'male',
        birthDate: '1980-05-15',
        qualification: [
          {
            code: {
              coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0360', code: 'MD', display: 'Doctor of Medicine' }],
              text: 'Doctor of Medicine',
            },
            issuer: { display: 'Harvard Medical School' },
            period: { start: '2005-06-01' },
          },
        ],
      };

      const provider = mapPractitionerToProvider(fhirPractitioner, 'epic');

      expect(provider.npi).toBe('1234567890');
      expect(provider.ehrId).toBe('prac-123');
      expect(provider.firstName).toBe('John');
      expect(provider.lastName).toBe('Smith');
      expect(provider.middleName).toBe('Robert');
      expect(provider.prefix).toBe('Dr.');
      expect(provider.suffix).toBe('MD');
      expect(provider.displayName).toBe('Dr. John Smith MD');
      expect(provider.email).toBe('john.smith@hospital.org');
      expect(provider.phone).toBe('555-1234');
      expect(provider.address).toEqual({
        line1: '123 Medical Plaza',
        line2: 'Suite 100',
        city: 'Boston',
        state: 'MA',
        zip: '02115',
        country: 'US',
      });
      expect(provider.gender).toBe('male');
      expect(provider.birthDate).toBe('1980-05-15');
      expect(provider.qualifications).toHaveLength(1);
      expect(provider.qualifications![0].type).toBe('Doctor of Medicine');
      expect(provider.qualifications![0].issuer).toBe('Harvard Medical School');
      expect(provider.source).toBe('ehr');
      expect(provider.sourceSystem).toBe('epic');
    });

    it('should handle missing fields gracefully', () => {
      const fhirPractitioner: FhirPractitioner = {
        resourceType: 'Practitioner',
        id: 'prac-456',
      };

      const provider = mapPractitionerToProvider(fhirPractitioner);

      expect(provider.ehrId).toBe('prac-456');
      expect(provider.npi).toBeUndefined();
      expect(provider.firstName).toBeUndefined();
      expect(provider.lastName).toBeUndefined();
      expect(provider.email).toBeUndefined();
      expect(provider.active).toBe(true);
      expect(provider.source).toBe('ehr');
    });

    it('should extract NPI from identifiers', () => {
      const fhirPractitioner: FhirPractitioner = {
        resourceType: 'Practitioner',
        id: 'prac-789',
        identifier: [
          { system: 'http://example.org/internal-id', value: 'INT-123' },
          { system: 'http://hl7.org/fhir/sid/us-npi', value: '9876543210' },
        ],
      };

      const provider = mapPractitionerToProvider(fhirPractitioner);

      expect(provider.npi).toBe('9876543210');
      expect(provider.externalId).toBe('INT-123');
    });
  });

  describe('mapPractitionerRoleToProvider', () => {
    it('should map PractitionerRole with specialty and organization', () => {
      const fhirRole: FhirPractitionerRole = {
        resourceType: 'PractitionerRole',
        id: 'role-123',
        practitioner: { reference: 'Practitioner/prac-123', display: 'Dr. Smith' },
        organization: { reference: 'Organization/org-456', display: 'General Hospital' },
        code: [
          {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/practitioner-role', code: 'doctor', display: 'Doctor' }],
            text: 'Doctor',
          },
        ],
        specialty: [
          {
            coding: [{ system: 'http://nucc.org/provider-taxonomy', code: '207R00000X', display: 'Internal Medicine' }],
            text: 'Internal Medicine',
          },
        ],
        period: { start: '2020-01-01', end: '2025-12-31' },
        active: true,
      };

      const provider = mapPractitionerRoleToProvider(fhirRole, undefined, 'epic');

      expect(provider.ehrId).toBe('prac-123');
      expect(provider.role).toBe('Doctor');
      expect(provider.roleCode).toBe('doctor');
      expect(provider.specialty).toBe('Internal Medicine');
      expect(provider.specialtyCode).toBe('207R00000X');
      expect(provider.organization).toBe('General Hospital');
      expect(provider.organizationId).toBe('org-456');
      expect(provider.active).toBe(true);
      expect(provider.effectiveStart).toBe('2020-01-01');
      expect(provider.effectiveEnd).toBe('2025-12-31');
    });

    it('should combine Practitioner and PractitionerRole data', () => {
      const fhirPractitioner: FhirPractitioner = {
        resourceType: 'Practitioner',
        id: 'prac-123',
        name: [{ family: 'Jones', given: ['Sarah'] }],
        identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1112223333' }],
      };

      const fhirRole: FhirPractitionerRole = {
        resourceType: 'PractitionerRole',
        id: 'role-456',
        practitioner: { reference: 'Practitioner/prac-123' },
        specialty: [
          {
            coding: [{ system: 'http://nucc.org/provider-taxonomy', code: '208D00000X', display: 'General Practice' }],
          },
        ],
        active: true,
      };

      const provider = mapPractitionerRoleToProvider(fhirRole, fhirPractitioner, 'cerner');

      expect(provider.npi).toBe('1112223333');
      expect(provider.firstName).toBe('Sarah');
      expect(provider.lastName).toBe('Jones');
      expect(provider.specialty).toBe('General Practice');
      expect(provider.specialtyCode).toBe('208D00000X');
    });
  });

  describe('Epic-specific mapping', () => {
    it('should extract Epic-specific identifier', () => {
      const fhirPractitioner: FhirPractitioner = {
        resourceType: 'Practitioner',
        id: 'prac-epic-1',
        identifier: [
          { system: 'urn:oid:1.2.840.114350.1.13.0.1.7.2.836982', value: 'EPIC-12345' },
          { system: 'http://hl7.org/fhir/sid/us-npi', value: '1234567890' },
        ],
      };

      const provider = mapEpicPractitioner(fhirPractitioner);

      expect(provider.externalId).toBe('EPIC-12345');
      expect(provider.sourceSystem).toBe('epic');
    });
  });

  describe('Cerner-specific mapping', () => {
    it('should extract Cerner-specific identifier', () => {
      const fhirPractitioner: FhirPractitioner = {
        resourceType: 'Practitioner',
        id: 'prac-cerner-1',
        identifier: [
          { system: 'https://fhir.cerner.com/practitioner-id', value: 'CERNER-67890' },
          { system: 'http://hl7.org/fhir/sid/us-npi', value: '9876543210' },
        ],
      };

      const provider = mapCernerPractitioner(fhirPractitioner);

      expect(provider.externalId).toBe('CERNER-67890');
      expect(provider.sourceSystem).toBe('cerner');
    });
  });
});

