import { exportProviderAsFHIR } from '../../apps/api/backend/src/services/fhir/fhirExporter';
import { buildLicenseClaims, createClinicianFixture } from '../fixtures/clinician';

describe('FHIR export', () => {
  test('exports practitioner, practitioner role, qualifications, and audit hash', () => {
    const clinician = createClinicianFixture(124);
    const bundle = exportProviderAsFHIR({
      npi: clinician.npi,
      firstName: clinician.firstName,
      lastName: clinician.lastName,
      credential: 'MD',
      organization: 'Wave 124 Health System',
      licenses: [],
      boardCerts: [],
      educations: [],
      taxonomies: [{
        code: clinician.taxonomyCode,
        description: clinician.taxonomyDescription,
        primary: true,
        state: clinician.state,
        license: clinician.licenseNumber,
      }],
      credentials: [{
        credentialId: 'cred-wave124',
        type: 'MedicalLicense',
        issuer: 'did:vitalcv:issuer:wave124',
        status: 'ACTIVE',
        issuedAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2030-01-01T00:00:00.000Z',
        licenseNumber: buildLicenseClaims(clinician).licenseNumber as string,
        state: clinician.state,
      }],
      trustBand: 'L3',
      auditHash: 'sha256:wave124-audit-hash',
    });

    const practitioner = bundle.entry.find((entry) => entry.resource.resourceType === 'Practitioner')?.resource;
    const practitionerRole = bundle.entry.find((entry) => entry.resource.resourceType === 'PractitionerRole')?.resource;

    expect(practitioner).toBeDefined();
    expect(practitionerRole).toBeDefined();

    const practitionerResource = practitioner as {
      identifier: Array<{ system: string; value: string }>;
      qualification: Array<{ code: { text: string } }>;
      extension: Array<{ url: string; valueString?: string }>;
    };
    expect(practitionerResource.identifier).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          system: 'http://hl7.org/fhir/sid/us-npi',
          value: clinician.npi,
        }),
      ]),
    );
    expect(practitionerResource.qualification).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: expect.objectContaining({
            text: 'MedicalLicense (CA)',
          }),
        }),
      ]),
    );
    expect(practitionerResource.extension).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: 'https://vitalcv.io/fhir/StructureDefinition/trust-band',
          valueString: 'L3',
        }),
        expect.objectContaining({
          url: 'https://vitalcv.io/fhir/StructureDefinition/audit-hash',
          valueString: 'sha256:wave124-audit-hash',
        }),
      ]),
    );

    const practitionerRoleResource = practitionerRole as {
      specialty: Array<{ coding: Array<{ code: string; display: string }> }>;
    };
    expect(practitionerRoleResource.specialty).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          coding: expect.arrayContaining([
            expect.objectContaining({
              code: clinician.taxonomyCode,
              display: clinician.taxonomyDescription,
            }),
          ]),
        }),
      ]),
    );
  });
});
