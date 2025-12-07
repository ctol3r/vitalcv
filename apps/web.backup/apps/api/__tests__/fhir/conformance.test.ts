import { mapPractitioner } from '../src/services/fhir/mappers/practitioner';
import { mapPractitionerRole } from '../src/services/fhir/mappers/role';
import { mapVerificationResult } from '../src/services/fhir/mappers/verification';

describe('FHIR mapper conformance', () => {
  it('builds Practitioner resources with NPI identifiers and qualifications', () => {
    const practitioner = mapPractitioner({
      id: 'cln-123',
      npi: '1234567890',
      name: { first: 'Ada', last: 'Lovelace' },
      telecom: { email: 'ada@example.org', phone: '555-555-1212' },
      addresses: [{ line1: '100 Code Ln', city: 'San Jose', state: 'CA', postalCode: '94088' }],
      specialties: [{ code: '207R00000X', display: 'Internal Medicine' }],
      qualifications: [{ code: 'ABIM', display: 'ABIM Board Cert', issuer: 'ABIM' }],
    });

    expect(practitioner.resourceType).toBe('Practitioner');
    expect(practitioner.identifier?.[0]?.value).toBe('1234567890');
    expect(practitioner.qualification?.length).toBeGreaterThan(0);
    expect(practitioner.address?.[0]?.state).toBe('CA');
  });

  it('includes compact eligibility extension on PractitionerRole', () => {
    const role = mapPractitionerRole({
      id: 'role-1',
      practitionerId: 'cln-123',
      organization: { id: 'org-9', name: 'General Hospital' },
      specialty: { code: '207R00000X', display: 'Internal Medicine' },
      compactEligible: true,
      locations: [{ state: 'CA' }],
    });

    expect(role.resourceType).toBe('PractitionerRole');
    expect(role.extension?.[0]?.url).toContain('compact-eligibility');
    expect(role.extension?.[0]?.valueBoolean).toBe(true);
  });

  it('maps verification results with primary source metadata', () => {
    const verification = mapVerificationResult({
      id: 'vr-1',
      status: 'validated',
      targetId: 'Practitioner/cln-123',
      method: 'license-check',
      source: {
        who: 'Organization/CA-BOARD',
        display: 'CA Medical Board',
        type: 'state-board',
        validationStatus: 'successful',
        validationDate: '2025-01-01T00:00:00Z',
      },
      attester: {
        who: 'Practitioner/reviewer-1',
        organizationId: 'org-9',
        timestamp: '2025-01-02T00:00:00Z',
      },
    });

    expect(verification.resourceType).toBe('VerificationResult');
    expect(verification.primarySource?.[0]?.who?.reference).toBe('Organization/CA-BOARD');
    expect(verification.attestation?.onBehalfOf?.reference).toBe('Organization/org-9');
  });
});










