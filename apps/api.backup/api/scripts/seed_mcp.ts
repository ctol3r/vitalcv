/**
 * Seed Script: Initialize MCP Box with starter workflows
 * Run with: npx ts-node scripts/seed_mcp.ts
 */

import { upsertMcp } from "../src/agent/store";
import { McpManifestT } from "../src/agent/types";

async function main() {
  console.log("🌱 Seeding MCP Box with starter workflows...\n");

  // 1. Medical License Verification Workflow
  const licenseVerificationMcp: McpManifestT = {
    name: "verify_medical_license_basic",
    description: "OCR license PDF, parse fields, query state board, cross-check name/status",
    inputs: [
      { name: "licensePdfId", type: "string", required: true },
      { name: "state", type: "string", required: true },
    ],
    outputs: [
      { name: "verificationStatus", type: "boolean" },
      { name: "licenseData", type: "json" },
    ],
    steps: [
      { tool: "ocr", params: { fileId: "{{licensePdfId}}" } },
      { tool: "verifyLicense", params: { state: "{{state}}" } },
    ],
    scope: "global",
    tags: ["verification", "license", "healthcare"],
  };

  const mcp1Id = await upsertMcp(licenseVerificationMcp);
  console.log(`✅ Created: ${licenseVerificationMcp.name} (${mcp1Id})`);

  // 2. Resume to Matches Workflow
  const resumeMatchMcp: McpManifestT = {
    name: "resume_to_matches_rulebased",
    description: "Parse resume text to profile, then produce job matches",
    inputs: [{ name: "resumeText", type: "string", required: true }],
    outputs: [{ name: "matches", type: "json" }],
    steps: [
      { tool: "parseResume", params: { text: "{{resumeText}}" } },
      { tool: "matcher", params: {} },
    ],
    scope: "global",
    tags: ["matching", "resume"],
  };

  const mcp2Id = await upsertMcp(resumeMatchMcp);
  console.log(`✅ Created: ${resumeMatchMcp.name} (${mcp2Id})`);

  // 3. NPI Lookup and Verification
  const npiVerificationMcp: McpManifestT = {
    name: "npi_lookup_and_verify",
    description: "Look up NPI number in NPPES registry and verify credentials",
    inputs: [{ name: "npi", type: "string", required: true }],
    outputs: [
      { name: "npiData", type: "json" },
      { name: "isValid", type: "boolean" },
    ],
    steps: [
      { tool: "npiLookup", params: { npi: "{{npi}}" } },
      { tool: "primarySourceVerify", params: { credentialType: "npi", identifier: "{{npi}}" } },
    ],
    scope: "global",
    tags: ["npi", "verification", "healthcare"],
  };

  const mcp3Id = await upsertMcp(npiVerificationMcp);
  console.log(`✅ Created: ${npiVerificationMcp.name} (${mcp3Id})`);

  // 4. Board Certification Verification
  const boardCertMcp: McpManifestT = {
    name: "verify_board_certification",
    description: "Verify physician board certification status",
    inputs: [
      { name: "name", type: "string", required: true },
      { name: "board", type: "string", required: true },
    ],
    outputs: [
      { name: "isCertified", type: "boolean" },
      { name: "certifications", type: "json" },
    ],
    steps: [
      { tool: "boardCheck", params: { name: "{{name}}", board: "{{board}}" } },
    ],
    scope: "global",
    tags: ["board", "certification", "physician"],
  };

  const mcp4Id = await upsertMcp(boardCertMcp);
  console.log(`✅ Created: ${boardCertMcp.name} (${mcp4Id})`);

  // 5. Full Credential Verification Pipeline
  const fullVerificationMcp: McpManifestT = {
    name: "full_credential_verification",
    description: "Complete credential verification: NPI, license, board certification",
    inputs: [
      { name: "npi", type: "string", required: true },
      { name: "licenseNumber", type: "string", required: true },
      { name: "state", type: "string", required: true },
      { name: "board", type: "string", required: false },
    ],
    outputs: [
      { name: "npiStatus", type: "json" },
      { name: "licenseStatus", type: "json" },
      { name: "boardStatus", type: "json" },
      { name: "overallValid", type: "boolean" },
    ],
    steps: [
      { tool: "npiLookup", params: { npi: "{{npi}}" } },
      { tool: "verifyLicense", params: { licenseNumber: "{{licenseNumber}}", state: "{{state}}" } },
      { tool: "boardCheck", params: {} },
    ],
    scope: "global",
    tags: ["verification", "comprehensive", "healthcare", "physician"],
  };

  const mcp5Id = await upsertMcp(fullVerificationMcp);
  console.log(`✅ Created: ${fullVerificationMcp.name} (${mcp5Id})`);

  console.log("\n🎉 MCP Box seeding complete!");
  console.log(`Total MCPs created: 5`);
  console.log("\nYou can now use these workflows via /api/agent/solve");

  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});

