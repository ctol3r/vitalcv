export function validateAgentClaim(claim: string, actualCapability: string): boolean {
  const c = claim.toLowerCase();
  
  const cryptographicTerms = [
    "cryptographically verified",
    "cryptographically validated",
    "verified cryptographically",
    "cryptographic",
    "sha-256",
    "sha256",
    "hash"
  ];
  
  if (cryptographicTerms.some(term => c.includes(term)) && !actualCapability.toLowerCase().includes("cryptograph")) {
    return false; // Violation detected
  }
  if (c.includes("blockchain") && !actualCapability.toLowerCase().includes("blockchain")) {
    return false; // Violation detected
  }
  return true;
}
