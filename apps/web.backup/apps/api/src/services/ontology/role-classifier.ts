/**
 * Credential→role classifier
 * Maps credentials → role eligibility
 */

export interface RoleClassification {
  credentialId: string;
  eligibleRoles: Array<{
    role: string;
    confidence: number;
    requirements: string[];
  }>;
  primaryRole: string;
}

const ROLE_REQUIREMENTS: Record<string, { credentials: string[]; specialties?: string[] }> = {
  'ATTENDING': {
    credentials: ['license', 'board_certification'],
    specialties: ['INTERNAL_MEDICINE', 'FAMILY_MEDICINE', 'EMERGENCY_MEDICINE'],
  },
  'RESIDENT': {
    credentials: ['training', 'residency'],
  },
  'FELLOW': {
    credentials: ['training', 'fellowship'],
  },
  'NURSE_PRACTITIONER': {
    credentials: ['license', 'nurse_practitioner'],
  },
  'PHYSICIAN_ASSISTANT': {
    credentials: ['license', 'physician_assistant'],
  },
  'PRIVILEGED_CLINICIAN': {
    credentials: ['license', 'privilege'],
  },
};

export function credentialRoleClassifier(credentialId: string, credentialData: any): RoleClassification {
  const type = credentialData.type || credentialData.credentialType || 'unknown';
  const specialty = credentialData.specialty || credentialData.taxonomyCode;

  const eligibleRoles: RoleClassification['eligibleRoles'] = [];

  Object.entries(ROLE_REQUIREMENTS).forEach(([role, requirements]) => {
    const hasRequiredCred = requirements.credentials.some(req =>
      type.toLowerCase().includes(req.toLowerCase())
    );

    const hasRequiredSpecialty = !requirements.specialties ||
      requirements.specialties.some(spec =>
        specialty && specialty.toUpperCase().includes(spec)
      );

    if (hasRequiredCred && hasRequiredSpecialty) {
      const confidence = hasRequiredCred && hasRequiredSpecialty ? 0.9 : 0.6;
      eligibleRoles.push({
        role,
        confidence,
        requirements: [...requirements.credentials, ...(requirements.specialties || [])],
      });
    }
  });

  // Determine primary role (highest confidence)
  const primaryRole = eligibleRoles.length > 0
    ? eligibleRoles.sort((a, b) => b.confidence - a.confidence)[0].role
    : 'UNKNOWN';

  return {
    credentialId,
    eligibleRoles,
    primaryRole,
  };
}








