import type {
  VerificationResultResource,
  FhirCodeableConcept,
  FhirReference,
} from '../../../../../services/fhir/types/r6';

const STATUS_MAP: Record<string, VerificationResultResource['status']> = {
  completed: 'validated',
  validated: 'validated',
  attested: 'attested',
  failed: 'failed',
  revoked: 'revoked',
  pending: 'in-process',
};

export interface VerificationMapperInput {
  id: string;
  status: string;
  targetId: string;
  targetDisplay?: string;
  method?: string;
  need?: string;
  source?: {
    who?: string;
    display?: string;
    type?: string;
    validationStatus?: string;
    validationDate?: string;
  };
  attester?: {
    who?: string;
    organizationId?: string;
    timestamp?: string;
    proxySignature?: string;
  };
}

export function mapVerificationResult(input: VerificationMapperInput): VerificationResultResource {
  return {
    resourceType: 'VerificationResult',
    id: input.id,
    status: STATUS_MAP[input.status] ?? 'in-process',
    date: new Date().toISOString(),
    target: [
      {
        reference: input.targetId,
        display: input.targetDisplay,
      },
    ],
    need: input.need ? buildCodeableConcept('need', input.need) : undefined,
    validationType: input.method ? buildCodeableConcept('method', input.method) : undefined,
    primarySource: input.source
      ? [
          {
            who: input.source.who
              ? {
                  reference: input.source.who,
                  display: input.source.display,
                }
              : undefined,
            type: input.source.type ? [buildCodeableConcept('source-type', input.source.type)] : undefined,
            validationStatus: input.source.validationStatus
              ? buildCodeableConcept('validation-status', input.source.validationStatus)
              : undefined,
            validationDate: input.source.validationDate,
          },
        ]
      : undefined,
    attestation: input.attester
      ? {
          who: input.attester.who
            ? {
                reference: input.attester.who,
              }
            : undefined,
          onBehalfOf: input.attester.organizationId
            ? ({
                reference: `Organization/${input.attester.organizationId}`,
              } satisfies FhirReference)
            : undefined,
          date: input.attester.timestamp,
          proxySignature: input.attester.proxySignature,
        }
      : undefined,
  };
}

function buildCodeableConcept(code: string, display: string): FhirCodeableConcept {
  return {
    coding: [
      {
        system: 'https://vitalcv.health/fhir/codes',
        code,
        display,
      },
    ],
    text: display,
  };
}










