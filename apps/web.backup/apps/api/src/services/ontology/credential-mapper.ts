/**
 * Credential-to-ontology mapper v3
 * Maps all credentials → ontology primitives
 */

export interface CredentialOntologyMapping {
  credentialId: string;
  credentialType: string;
  ontologyPrimitives: {
    specialty?: string;
    role?: string;
    privilege?: string[];
    trainingLevel?: string;
    jurisdiction?: string;
  };
  confidence: number;
}

const CREDENTIAL_TYPE_MAP: Record<string, any> = {
  license: {
    specialty: (data: any) => data.specialty || data.taxonomyCode,
    role: (data: any) => data.role || 'CLINICIAN',
    trainingLevel: (data: any) => data.level || 'LICENSED',
    jurisdiction: (data: any) => data.state || data.country,
  },
  board_certification: {
    specialty: (data: any) => data.specialty,
    role: (data: any) => 'BOARD_CERTIFIED',
    trainingLevel: (data: any) => 'CERTIFIED',
  },
  privilege: {
    privilege: (data: any) => data.procedures || data.codes || [],
    role: (data: any) => 'PRIVILEGED',
  },
  training: {
    specialty: (data: any) => data.specialty,
    role: (data: any) => data.role || 'TRAINEE',
    trainingLevel: (data: any) => data.level || 'TRAINING',
  },
};

export function credentialToOntologyMapper(credentialId: string, credentialData: any): CredentialOntologyMapping {
  const type = credentialData.type || credentialData.credentialType || 'unknown';
  const mapper = CREDENTIAL_TYPE_MAP[type] || {};

  const primitives: CredentialOntologyMapping['ontologyPrimitives'] = {};

  if (mapper.specialty) {
    const specialty = mapper.specialty(credentialData);
    if (specialty) primitives.specialty = specialty;
  }

  if (mapper.role) {
    const role = mapper.role(credentialData);
    if (role) primitives.role = role;
  }

  if (mapper.privilege) {
    const privilege = mapper.privilege(credentialData);
    if (privilege) primitives.privilege = Array.isArray(privilege) ? privilege : [privilege];
  }

  if (mapper.trainingLevel) {
    const level = mapper.trainingLevel(credentialData);
    if (level) primitives.trainingLevel = level;
  }

  if (mapper.jurisdiction) {
    const jurisdiction = mapper.jurisdiction(credentialData);
    if (jurisdiction) primitives.jurisdiction = jurisdiction;
  }

  // Calculate confidence based on data completeness
  const fields = Object.keys(primitives);
  const confidence = fields.length > 0 ? Math.min(0.9, 0.5 + fields.length * 0.1) : 0.3;

  return {
    credentialId,
    credentialType: type,
    ontologyPrimitives: primitives,
    confidence,
  };
}








