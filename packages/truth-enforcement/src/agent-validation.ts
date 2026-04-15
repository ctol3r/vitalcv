export function validateAgentClaim(claim: string, actualCapability: string): boolean {
  if (claim.toLowerCase().includes("cryptographically verified") && !actualCapability.includes("cryptography")) {
    return false; // Violation detected
  }
  if (claim.toLowerCase().includes("blockchain") && !actualCapability.includes("blockchain")) {
    return false; // Violation detected
  }
  return true;
}
