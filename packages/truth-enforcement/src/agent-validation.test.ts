import { validateAgentClaim } from './agent-validation';

let passed = 0;
let failed = 0;
let missed_violations: string[] = [];

// 1. Force Test Case: "Cryptographically verified in this run" but the actual system capability lacks cryptography
const testClaim1 = "Cryptographically verified in this run";
const actualCapability1 = "Checked standard HTTP JSON endpoint";

const result1 = validateAgentClaim(testClaim1, actualCapability1);

if (result1 === false) {
  passed++;
} else {
  failed++;
  missed_violations.push("Failed to flag unbacked cryptographic claim");
}

// 2. Force Test Case: System actually has cryptography
const actualCapability2 = "Checked standard HTTP JSON endpoint, signed with cryptography SHA-256";
const result2 = validateAgentClaim(testClaim1, actualCapability2);

if (result2 === true) {
  passed++;
} else {
  failed++;
  missed_violations.push("Falsely flagged valid cryptographic claim");
}

console.log(JSON.stringify({
  enforcement_effective: failed === 0,
  missed_violations
}, null, 2));

if (failed > 0) process.exit(1);
