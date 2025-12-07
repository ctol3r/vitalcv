/**
 * DC-005: Verifier Policy Layer
 * Maps verifier workflows to required credential types and claim sets
 */

export type CredentialType =
  | 'LicenseCredential'
  | 'BoardCertificationCredential'
  | 'IdentityProofCredential'
  | 'EducationCredential'
  | 'EmploymentCredential'
  | 'DEACredential';

export type VerifierWorkflow =
  | 'full_onboarding'
  | 'quick_privileges_check'
  | 'hospitalist_onboarding'
  | 'locums_assignment'
  | 'credentialing_renewal';

export interface RequiredCredential {
  type: CredentialType;
  requiredClaims?: string[]; // Specific claims that must be present
  optionalClaims?: string[]; // Claims that may be present but aren't required
}

export interface VerifierPolicy {
  workflow: VerifierWorkflow;
  requiredCredentials: RequiredCredential[];
  description?: string;
}

/**
 * Policy registry mapping workflows to required credentials
 */
const POLICIES: Record<VerifierWorkflow, VerifierPolicy> = {
  full_onboarding: {
    workflow: 'full_onboarding',
    description: 'Complete onboarding requiring all major credentials',
    requiredCredentials: [
      {
        type: 'IdentityProofCredential',
        requiredClaims: ['givenName', 'familyName', 'dateOfBirth'],
      },
      {
        type: 'LicenseCredential',
        requiredClaims: ['licenseNumber', 'state', 'status'],
      },
      {
        type: 'BoardCertificationCredential',
        optionalClaims: ['specialty', 'boardName', 'certificationDate'],
      },
      {
        type: 'EducationCredential',
        optionalClaims: ['degree', 'institution', 'graduationDate'],
      },
    ],
  },
  quick_privileges_check: {
    workflow: 'quick_privileges_check',
    description: 'Quick verification of active license for privileges',
    requiredCredentials: [
      {
        type: 'LicenseCredential',
        requiredClaims: ['licenseNumber', 'state', 'status'],
      },
    ],
  },
  hospitalist_onboarding: {
    workflow: 'hospitalist_onboarding',
    description: 'Onboarding for hospitalist positions',
    requiredCredentials: [
      {
        type: 'IdentityProofCredential',
        requiredClaims: ['givenName', 'familyName'],
      },
      {
        type: 'LicenseCredential',
        requiredClaims: ['licenseNumber', 'state', 'status'],
      },
      {
        type: 'BoardCertificationCredential',
        requiredClaims: ['specialty'],
        optionalClaims: ['boardName'],
      },
      {
        type: 'DEACredential',
        requiredClaims: ['deaNumber', 'status'],
      },
    ],
  },
  locums_assignment: {
    workflow: 'locums_assignment',
    description: 'Temporary assignment verification',
    requiredCredentials: [
      {
        type: 'LicenseCredential',
        requiredClaims: ['licenseNumber', 'state', 'status'],
      },
      {
        type: 'IdentityProofCredential',
        requiredClaims: ['givenName', 'familyName'],
      },
    ],
  },
  credentialing_renewal: {
    workflow: 'credentialing_renewal',
    description: 'Periodic credential renewal',
    requiredCredentials: [
      {
        type: 'LicenseCredential',
        requiredClaims: ['licenseNumber', 'state', 'status'],
      },
      {
        type: 'BoardCertificationCredential',
        optionalClaims: ['specialty', 'boardName'],
      },
    ],
  },
};

/**
 * Get policy for a workflow
 */
export function getPolicy(workflow: VerifierWorkflow): VerifierPolicy {
  return POLICIES[workflow];
}

/**
 * Get all available workflows
 */
export function getAvailableWorkflows(): VerifierWorkflow[] {
  return Object.keys(POLICIES) as VerifierWorkflow[];
}

/**
 * Generate a presentation_definition JSON from a policy
 */
export function generatePresentationDefinition(
  workflow: VerifierWorkflow,
  options?: {
    nonce?: string;
    state?: string;
    clientId?: string;
  }
): Record<string, any> {
  const policy = getPolicy(workflow);

  const inputDescriptors = policy.requiredCredentials.map((cred, index) => {
    const fields: any[] = [];

    // Add required claims
    if (cred.requiredClaims) {
      cred.requiredClaims.forEach((claim) => {
        fields.push({
          path: [`$.credentialSubject.${claim}`],
          filter: {
            type: 'string',
          },
        });
      });
    }

    // Add optional claims
    if (cred.optionalClaims) {
      cred.optionalClaims.forEach((claim) => {
        fields.push({
          path: [`$.credentialSubject.${claim}`],
          filter: {
            type: 'string',
          },
          optional: true,
        });
      });
    }

    return {
      id: `input_descriptor_${index + 1}`,
      name: `Requirement for ${cred.type}`,
      purpose: `Verify ${cred.type}`,
      constraints: {
        fields: fields.length > 0 ? fields : undefined,
      },
      format: {
        jwt_vc: {
          alg: ['EdDSA', 'ES256'],
        },
        jwt_vc_json: {
          alg: ['EdDSA', 'ES256'],
        },
      },
    };
  });

  const presentationDefinition: Record<string, any> = {
    id: `pd_${workflow}_${Date.now()}`,
    input_descriptors: inputDescriptors,
    format: {
      jwt_vc: {
        alg: ['EdDSA', 'ES256'],
      },
      jwt_vc_json: {
        alg: ['EdDSA', 'ES256'],
      },
    },
  };

  // Add nonce and state if provided
  if (options?.nonce) {
    presentationDefinition.nonce = options.nonce;
  }
  if (options?.state) {
    presentationDefinition.state = options.state;
  }
  if (options?.clientId) {
    presentationDefinition.client_id = options.clientId;
  }

  return presentationDefinition;
}

