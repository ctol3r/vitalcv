import { describe, it, expect } from '@jest/globals';
import { TefcaPurposeOfUse } from '../models/QhinConfig.js';
import { applyPouRedaction, getAllowedFields } from '../pouMatrix.js';

describe('TEFCA PoU matrix', () => {
  it('returns broader field set for Treatment than Directory', () => {
    const treatmentFields = new Set(getAllowedFields('Practitioner', TefcaPurposeOfUse.TREATMENT));
    const directoryFields = new Set(getAllowedFields('Practitioner', TefcaPurposeOfUse.DIRECTORY));

    expect(treatmentFields.size).toBeGreaterThan(directoryFields.size);
    expect(directoryFields.has('birthDate')).toBe(false);
    expect(treatmentFields.has('birthDate')).toBe(true);
  });

  it('redacts disallowed PractitionerRole fields for Directory PoU', () => {
    const practitionerRole = {
      resourceType: 'PractitionerRole',
      id: 'role-1',
      identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1234567890' }],
      practitioner: { reference: 'Practitioner/pract-1' },
      organization: { reference: 'Organization/org-1' },
      code: [{ text: 'Cardiology' }],
      specialty: [{ text: 'Interventional Cardiology' }],
      telecom: [{ system: 'phone', value: '555-111-2222' }],
      location: [{ display: 'Main Campus' }],
      availability: [{ description: 'Weekdays' }],
      endpoint: [{ reference: 'Endpoint/ep-1' }],
      period: { start: '2025-01-01' },
    };

    const directoryView = applyPouRedaction(practitionerRole, TefcaPurposeOfUse.DIRECTORY);
    expect(directoryView.specialty).toBeUndefined();
    expect(directoryView.location).toBeUndefined();
    expect(directoryView.availability).toBeUndefined();
    expect(directoryView.endpoint).toBeDefined();
    expect(directoryView.identifier).toBeDefined();
  });

  it('preserves contained resources while redacting Practitioner fields', () => {
    const practitioner = {
      resourceType: 'Practitioner',
      id: 'p-1',
      meta: {},
      contained: [{
        resourceType: 'PractitionerRole',
        id: 'role-1',
        practitioner: { reference: 'Practitioner/p-1' },
        location: [{ display: 'Hidden' }],
      }],
      identifier: [{ value: '123' }],
      name: [{ family: 'Doe' }],
      birthDate: '1990-01-01',
    };

    const directoryView = applyPouRedaction(practitioner, TefcaPurposeOfUse.DIRECTORY);
    expect(directoryView.birthDate).toBeUndefined();
    expect(directoryView.contained).toHaveLength(1);
  });
});
import { applyPouMatrix, getPouMatrix } from '../pouMatrix';
import { TefcaPurposeOfUse } from '../models/QhinConfig';

describe('PoU matrix redaction', () => {
  it('keeps telecom for Treatment but strips for Directory', () => {
    const practitioner = {
      resourceType: 'Practitioner',
      id: 'practitioner-1',
      identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1234567890' }],
      name: [{ text: 'Dr. Alice Carter' }],
      telecom: [{ system: 'phone', value: '555-1234' }],
    };

    const treatmentView = applyPouMatrix(practitioner, TefcaPurposeOfUse.TREATMENT);
    expect(treatmentView.telecom).toBeDefined();

    const directoryView = applyPouMatrix(practitioner, TefcaPurposeOfUse.DIRECTORY);
    expect(directoryView.telecom).toBeUndefined();
    expect(directoryView.identifier).toBeDefined();
  });

  it('exposes organization endpoints for directory but hides telecom', () => {
    const organization = {
      resourceType: 'Organization',
      id: 'org-1',
      name: 'Sunrise Medical Center',
      telecom: [{ system: 'phone', value: '555-0000' }],
      endpoint: [{ reference: 'Endpoint/endpoint-1' }],
    };

    const directoryView = applyPouMatrix(organization, TefcaPurposeOfUse.DIRECTORY);
    expect(directoryView.endpoint).toBeDefined();
    expect(directoryView.telecom).toBeUndefined();
  });

  it('publishes matrix metadata for ops tooling', () => {
    const matrix = getPouMatrix();
    expect(Object.keys(matrix)).toEqual(
      expect.arrayContaining(['Practitioner', 'PractitionerRole', 'Organization', 'Endpoint'])
    );
  });
});


