import type { FusionPipelineResult } from './types';

export interface FhirBundle {
  resourceType: 'Bundle';
  type: 'collection';
  timestamp: string;
  entry: Array<{
    fullUrl: string;
    resource: Record<string, unknown>;
  }>;
}

export function buildFusionBundle(result: FusionPipelineResult): FhirBundle {
  const practitioner = buildPractitionerResource(result);
  const verificationEntries = result.fused.components.map((component) => ({
    fullUrl: `VerificationResult/${component.id}`,
    resource: {
      resourceType: 'VerificationResult',
      id: component.id,
      status: mapVerificationStatus(component.status),
      date: result.generatedAt,
      target: [
        {
          reference: `Practitioner/${result.clinicianId}`,
          display: component.label,
        },
      ],
      primarySource: component.sources.map((source) => ({
        who: { display: source.issuer ?? source.issuerDid ?? 'unknown' },
        validationDate: source.updatedAt ?? result.generatedAt,
        canPushUpdates: source.anchor ? true : false,
      })),
      need: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/need',
            code: component.type,
            display: component.label,
          },
        ],
      },
      validationProcess: [
        {
          text: `Trust ${Math.round(component.metrics.trust * 100)}%`,
        },
        {
          text: `Recency ${Math.round(component.metrics.recency * 100)}%`,
        },
      ],
      failureAction: component.status === 'revoked' ? 'stop' : 'none',
      statusDate: result.generatedAt,
    },
  }));

  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: result.generatedAt,
    entry: [
      {
        fullUrl: `Practitioner/${result.clinicianId}`,
        resource: practitioner,
      },
      ...verificationEntries,
    ],
  };
}

function buildPractitionerResource(result: FusionPipelineResult): Record<string, unknown> {
  const summary = result.fused.summary;
  return {
    resourceType: 'Practitioner',
    id: result.clinicianId,
    active: true,
    meta: {
      lastUpdated: result.generatedAt,
      profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-practitioner'],
    },
    extension: [
      {
        url: 'http://vitalcv.health/fhir/StructureDefinition/component-count',
        valueInteger: summary.componentCount,
      },
      {
        url: 'http://vitalcv.health/fhir/StructureDefinition/fusion-root-hash',
        valueString: result.fused.rootHash,
      },
    ],
  };
}

function mapVerificationStatus(
  status: FusionPipelineResult['fused']['components'][number]['status'],
): 'validated' | 'pending' | 'revoked' | 'req-revalid' {
  switch (status) {
    case 'active':
      return 'validated';
    case 'revoked':
      return 'revoked';
    case 'expired':
      return 'req-revalid';
    default:
      return 'pending';
  }
}









