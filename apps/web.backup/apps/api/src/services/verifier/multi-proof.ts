export interface MultiProofBundle {
  vc?: Record<string, unknown>;
  sdJwt?: string;
  eudi?: Record<string, unknown>;
  bundleHash: string;
}

export interface MultiProofValidationResult {
  valid: boolean;
  proofTypes: string[];
  confidence: number;
  errors: string[];
}

/**
 * Handle VC + SD-JWT + EUDI proofs in one payload
 */
export function validateMultiProofBundle(bundle: MultiProofBundle): MultiProofValidationResult {
  const proofTypes: string[] = [];
  const errors: string[] = [];

  // Validate VC
  if (bundle.vc) {
    proofTypes.push('VC');
    if (!bundle.vc.type || !bundle.vc.proof) {
      errors.push('VC proof incomplete');
    }
  }

  // Validate SD-JWT
  if (bundle.sdJwt) {
    proofTypes.push('SD-JWT');
    if (!bundle.sdJwt.includes('~')) {
      errors.push('SD-JWT format invalid');
    }
  }

  // Validate EUDI
  if (bundle.eudi) {
    proofTypes.push('EUDI');
    if (!bundle.eudi.iss || !bundle.eudi.sub) {
      errors.push('EUDI proof incomplete');
    }
  }

  const valid = errors.length === 0 && proofTypes.length > 0;
  const confidence = valid ? 1.0 : Math.max(0, 1.0 - errors.length * 0.3);

  return {
    valid,
    proofTypes,
    confidence,
    errors,
  };
}

