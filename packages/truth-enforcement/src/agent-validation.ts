export interface SemanticCapability {
  hasCryptography: boolean;
  hasBlockchain: boolean;
  hasImmutableAudit: boolean;
}

export interface SemanticClaimIntent {
  impliesCryptography: boolean;
  impliesBlockchain: boolean;
  impliesImmutableAudit: boolean;
  isNegated: boolean;
}

/**
 * Placeholder for an AI/Semantic classifier.
 * In a real environment, this would call a fast local classifier or LLM to determine
 * the semantic intent of the text (e.g. "is this claiming cryptography?").
 */
export function extractClaimIntent(claim: string): SemanticClaimIntent {
  const c = claim.toLowerCase();
  
  // Simulated semantic extraction
  const impliesCrypto = c.includes('cryptograph') || c.includes('sha') || c.includes('hash');
  const impliesBlock = c.includes('blockchain');
  const impliesAudit = c.includes('immutable') || c.includes('audit');
  
  // Basic negation detection
  const isNegated = c.includes('not') || c.includes('no') || c.includes('without');

  return {
    impliesCryptography: impliesCrypto,
    impliesBlockchain: impliesBlock,
    impliesImmutableAudit: impliesAudit,
    isNegated
  };
}

export function validateSemanticAgentClaim(claim: string, actualCapability: SemanticCapability): boolean {
  const intent = extractClaimIntent(claim);

  // If the claim is negated ("we do NOT use cryptography"), it's safe even if we don't have the capability
  if (intent.isNegated) {
    return true; 
  }

  // Detect Overclaims
  if (intent.impliesCryptography && !actualCapability.hasCryptography) {
    return false; // Violation detected
  }
  if (intent.impliesBlockchain && !actualCapability.hasBlockchain) {
    return false; // Violation detected
  }
  if (intent.impliesImmutableAudit && !actualCapability.hasImmutableAudit) {
    return false; // Violation detected
  }

  return true;
}
