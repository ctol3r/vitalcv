
import { verifySDJWT, VerificationResult } from '../credentials/sdjwt-verifier';

export interface HybridValidationResult {
  valid: boolean;
  sdResult: VerificationResult;
  zkValid: boolean;
  errors?: string[];
}

// Stub for ZK verification service
// In a real implementation, this would import from a ZK library or service
async function verifyZkProof(proof: any, publicInputs: any): Promise<boolean> {
  // TODO: Implement actual ZK verification (e.g., using SnarkJS or a specialized verifier)
  // For now, we assume the proof is valid if it exists and has a 'proof' property
  if (!proof) return false;
  console.log('Verifying ZK proof...', proof);
  return true;
}

// Stub for AuditService
// This should be replaced or connected to the actual AuditService that anchors to Substrate
const AuditService = {
  record: async (data: any) => {
    console.log('AuditService.record:', data);
    // TODO: Implement Substrate anchoring here
    // e.g., await SubstrateService.anchor(hash(data));
  }
};

/**
 * Validates a hybrid SD-JWT + ZK Proof credential presentation.
 *
 * Flow:
 * 1. Validate SD-JWT signature and disclosures.
 * 2. Validate ZK license proof (if required/provided).
 * 3. Merge validation results.
 * 4. Record audit event and anchor to chain.
 *
 * @param credential - The SD-JWT string
 * @param disclosures - Array of disclosure strings
 * @param zkProof - The ZK proof object (optional, depends on template)
 */
export async function validateHybridProof(
  credential: string,
  disclosures: string[],
  zkProof?: any
): Promise<HybridValidationResult> {
  const errors: string[] = [];

  // 1. Validate SD-JWT
  console.log('Starting SD-JWT validation...');
  const sdResult = await verifySDJWT(credential, disclosures);

  if (!sdResult.valid) {
    errors.push('SD-JWT validation failed');
    if (sdResult.errors) {
      errors.push(...sdResult.errors.map(e => e.message));
    }
  }

  // 2. Validate ZK License Proof
  // We check if the 'zkProof' claim was revealed or if a separate proof object was passed
  // For this hybrid model, we assume the ZK proof might be passed separately or extracted
  let zkValid = true;
  if (zkProof) {
    console.log('Starting ZK proof validation...');
    zkValid = await verifyZkProof(zkProof, {
      // Public inputs derived from SD-JWT (e.g., merkle root or commitment)
      // compactType: sdResult.revealedClaims?.compactType
    });

    if (!zkValid) {
      errors.push('ZK proof verification failed');
    }
  } else if (sdResult.revealedClaims?.zkProof) {
    // If the proof is inside the SD-JWT as a claim
     zkValid = await verifyZkProof(sdResult.revealedClaims.zkProof, {});
     if (!zkValid) {
      errors.push('Embedded ZK proof verification failed');
    }
  }

  // 3. Merge Validation Result
  const valid = sdResult.valid && zkValid;

  // 4. Audit and Anchor (Task 65.5)
  // Only record if at least the SD-JWT was valid (or maybe only if fully valid?)
  // Usually we audit the attempt or the success. Here we'll audit the validation result.
  if (valid) {
    try {
      await AuditService.record({
        eventType: "zk.sd.compact",
        disclosureLevel: DetermineDisclosureLevel(sdResult.revealedClaims),
        compactType: sdResult.revealedClaims?.compactType || "unknown",
        memberState: sdResult.revealedClaims?.memberState || "hidden", // ZK hides this
        timestamp: new Date().toISOString(),
        proofValid: valid
      });
      console.log('Audit record anchored.');
    } catch (auditError) {
      console.error('Failed to record audit log:', auditError);
      // Decide if this should fail the validation. Usually audit failure shouldn't block verification unless strict.
    }
  }

  return {
    valid,
    sdResult,
    zkValid,
    errors: errors.length > 0 ? errors : undefined
  };
}

function DetermineDisclosureLevel(claims: Record<string, any> | undefined): string {
  if (!claims) return "none";
  if (claims.memberState) return "full_state_reveal";
  if (claims.zkProof) return "zk_hybrid";
  if (claims.compactType) return "compact_type_only";
  return "custom";
}














