export interface PractitionerQualificationResource {
  resourceType: 'PractitionerQualification';
  id: string;
  code?: { text?: string };
  issuer?: { display?: string };
  period?: { start?: string; end?: string };
}

export type FhirResource = PractitionerQualificationResource | Record<string, unknown>;

export interface FhirTransformResult {
  resource: FhirResource;
  sourceCredentialId?: string;
}

export interface FhirTransformer {
  transform(input: Record<string, unknown>): FhirTransformResult;
}
