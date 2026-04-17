import { validateSemanticAgentClaim, SemanticCapability } from './agent-validation';

let bypassCases: string[] = [];

const actualCapability: SemanticCapability = {
  hasCryptography: false,
  hasBlockchain: false,
  hasImmutableAudit: false
};

const testVariants = [
  "Cryptographically verified in this run",
  "cryptographically verified via SHA-256",
  "verified cryptographically",
  "securely cryptographically validated",
  "blockchain verified",
  "verified with SHA256 hashing",
  "cryptographic receipt attached",
  "We do NOT use cryptography" // <-- Negation should PASS
];

for (const variant of testVariants) {
  const passed = validateSemanticAgentClaim(variant, actualCapability);
  
  if (variant === "We do NOT use cryptography") {
    if (passed === false) {
      bypassCases.push(variant); // Failing a safe negation is a bug
    }
  } else {
    // Overclaims SHOULD return false (violation detected).
    // If it returns true (passed), it bypassed the guard.
    if (passed === true) {
      bypassCases.push(variant);
    }
  }
}

console.log(JSON.stringify({
  enforcement_proven: bypassCases.length === 0,
  bypass_cases: bypassCases
}, null, 2));

if (bypassCases.length > 0) process.exit(1);
