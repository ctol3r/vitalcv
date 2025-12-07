import { describe, expect, it } from 'vitest';
import { jobPostingToPractitionerRole } from '../../fhir/adapter/practitionerRoleAdapter';
import { validateResource } from '../../fhir/validator';

describe('jobPostingToPractitionerRole', () => {
  it('creates a PractitionerRole with telehealth metadata', () => {
    const resource = jobPostingToPractitionerRole(
      {
        id: 'job-123',
        partnerId: 'org-1',
        title: 'Telehealth Hospitalist',
        specialty: '208M00000X',
        requiredStates: ['CA', 'OR'],
        telehealth: true,
        modality: 'telehealth',
      },
      {
        practitionerId: 'clinician-1',
        telehealthUrl: 'https://telehealth.example.org',
      }
    );

    const validation = validateResource(resource, 'PractitionerRole');
    expect(validation.valid).toBe(true);
    expect(resource.virtualService).toBeDefined();
    expect(resource.organization?.reference).toBe('Organization/org-1');
  });
});

import { describe, expect, it } from 'vitest';
import { jobPostingToPractitionerRole } from '../../fhir/adapter/practitionerRoleAdapter';
import { validateResource } from '../../fhir/validator';

describe('jobPostingToPractitionerRole', () => {
  it('maps job posting into PractitionerRole with telehealth support', () => {
    const resource = jobPostingToPractitionerRole(
      {
        id: 'job-1',
        partnerId: 'org-1',
        title: 'Telehealth Hospitalist',
        specialty: '208M00000X',
        requiredStates: ['CA', 'OR'],
        telehealth: true,
        modality: 'telehealth',
      },
      {
        practitionerId: 'clinician-1',
        telehealthUrl: 'https://telehealth.example.org',
      }
    );

    expect(resource.organization?.reference).toBe('Organization/org-1');
    expect(resource.practitioner?.reference).toBe('Practitioner/clinician-1');
    expect(resource.virtualService).toBeDefined();

    const validation = validateResource(resource, 'PractitionerRole');
    expect(validation.valid).toBe(true);
  });
});


