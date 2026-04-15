import { validateAgentClaim } from './agent-validation';

let bypassCases: string[] = [];

const actualCapability = "Checked standard HTTP JSON endpoint (no special hashing)";

const testVariants = [
  "Cryptographically verified in this run",
  "cryptographically verified via SHA-256",
  "verified cryptographically",
  "securely cryptographically validated",
  "blockchain verified",
  "verified with SHA256 hashing",
  "cryptographic receipt attached"
];

for (const variant of testVariants) {
  const passed = validateAgentClaim(variant, actualCapability);
  // It SHOULD return false (violation detected).
  // If it returns true (passed), it bypassed the guard.
  if (passed === true) {
    bypassCases.push(variant);
  }
}

console.log(JSON.stringify({
  enforcement_proven: bypassCases.length === 0,
  bypass_cases: bypassCases
}, null, 2));

if (bypassCases.length > 0) process.exit(1);
