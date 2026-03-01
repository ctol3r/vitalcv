import { hashDeterministicPayload } from '../../utils/deterministic';

export function mapClinicianToFhir(clinician: any, credentials: any[]) {
  const auditHash = hashDeterministicPayload({ clinician, credentials });
  const practitionerId = clinician?.npi || clinician?.id || 'unknown';

  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [
      {
        resource: {
          resourceType: 'Practitioner',
          id: practitionerId,
          identifier: [
            {
              system: 'http://hl7.org/fhir/sid/us-npi',
              value: practitionerId
            }
          ],
          name: [
            {
              text: clinician?.name || 'Unknown',
            }
          ],
          extension: [
            {
              url: 'https://vitalcv.io/fhir/StructureDefinition/AuditHash',
              valueString: auditHash
            }
          ]
        }
      },
      {
        resource: {
          resourceType: 'PractitionerRole',
          id: `${practitionerId}-role`,
          practitioner: {
            reference: `Practitioner/${practitionerId}`
          },
          code: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/practitioner-role',
                  code: 'doctor',
                  display: 'Doctor'
                }
              ]
            }
          ],
          extension: [
            {
              url: 'https://vitalcv.io/fhir/StructureDefinition/AuditHash',
              valueString: auditHash
            }
          ]
        }
      }
    ]
  };
}
