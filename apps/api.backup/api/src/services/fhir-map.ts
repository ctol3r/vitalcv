/**
 * FHIR Bundle → VC 2.0 mapping service
 * Implements HL7 SMART 2.0 IG + OIDC4VCI flows
 */

import crypto from 'crypto';
import { VerifiableCredential } from '../crypto/ed25519';

export interface FHIRBundle {
  resourceType: 'Bundle';
  type: string;
  entry: Array<{
    resource: any;
  }>;
}

/**
 * Map FHIR Bundle to VC 2.0 structure
 */
export async function mapFhirToVC(
  bundle: FHIRBundle,
  type?: string
): Promise<VerifiableCredential> {
  const issuer = process.env.ISSUER_DID || 'did:key:vitalcv-issuer';
  const now = new Date().toISOString();

  // Extract relevant FHIR resources from bundle
  const practitioners = bundle.entry
    ?.filter((e) => e.resource?.resourceType === 'Practitioner')
    .map((e) => e.resource) || [];

  const licenses = bundle.entry
    ?.filter((e) => e.resource?.resourceType === 'PractitionerQualification')
    .map((e) => e.resource) || [];

  // Build credential subject from FHIR resources
  const credentialSubject: Record<string, any> = {
    id: practitioners[0]?.id || `fhir:${bundle.entry?.[0]?.resource?.id || 'unknown'}`,
  };

  if (practitioners[0]) {
    const p = practitioners[0];
    if (p.name) {
      credentialSubject.name = p.name[0]?.text || p.name[0]?.family;
    }
    if (p.identifier) {
      credentialSubject.identifier = p.identifier;
    }
  }

  if (licenses.length > 0) {
    credentialSubject.qualification = licenses.map((l) => ({
      code: l.code,
      issuer: l.issuer,
      period: l.period,
    }));
  }

  return {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://www.w3.org/ns/credentials/v2',
    ],
    id: `urn:uuid:${crypto.randomUUID()}`,
    type: ['VerifiableCredential', type || 'FHIRPractitionerCredential'],
    issuer,
    issuanceDate: now,
    credentialSubject,
  };
}

