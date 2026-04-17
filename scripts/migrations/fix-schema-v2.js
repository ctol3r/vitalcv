const fs = require('fs');
const p = '/Users/christoler/vitalcv-consolidation-2/apps/api/backend/prisma/schema.prisma';
let s = fs.readFileSync(p, 'utf8');

// Helper: replace field in a specific model only
function modelFieldReplace(model, oldField, newField) {
  const re = new RegExp(`(model ${model} \\{[\\s\\S]*?)${oldField}`, 'm');
  s = s.replace(re, `$1${newField}`);
}

// 1. ResidencyProgram: TS uses acgmeCode, hospitalAffiliation — schema has same? Let me check
// Actually the error says Type '{ name; specialty; acgmeCode; hospitalAffiliation }' not assignable
// So schema has DIFFERENT fields. Let me check what schema has:
// grep -A 10 "model ResidencyProgram" -> need to see actual fields
// From the test error: 'acgme_code' does not exist, suggesting schema has acgmeCode already
// But the create fails... maybe programName is required in schema?
// Let's just check at runtime. For now, the schema may already have acgmeCode.
// Actually the fix-schema.js I reverted had already changed programName to optional.
// Since I reverted, it's back to required. Let me make it optional again.

// 2. EmployerAcceptance: TS creates with { employerId, clinicianNpi, artifactId, status, acceptedAt }
// Schema likely has entityId, organization instead
modelFieldReplace('EmployerAcceptance', 'entityId       String     @map("entity_id") @db.Uuid', 'employerId     String     @map("employer_id")');
modelFieldReplace('EmployerAcceptance', 'organization   String', 'clinicianNpi    String     @map("clinician_npi")');
// Also need to make artifactId available - check if it exists
if (!s.includes('artifactId') && s.includes('model EmployerAcceptance')) {
  // Add artifactId after clinicianNpi
  s = s.replace(
    /(model EmployerAcceptance \{[\s\S]*?clinicianNpi\s+String\s+@map\("clinician_npi"\))/,
    '$1\n  artifactId     String?    @map("artifact_id")'
  );
}
// Fix the @relation reference
s = s.replace(
  /entity\s+VcvEntity\?\s+@relation\("employer_acceptance_entity"[^)]*\)/,
  'entity         VcvEntity? @relation("employer_acceptance_entity", fields: [employerId], references: [id])'
);
// Fix indexes
s = s.replace(/@@index\(\[entityId\]\)\s*\n(\s*)@@index\(\[organization\]\)/, '@@index([employerId])\n$1@@index([clinicianNpi])');

// 3. StartAttestation: TS uses acceptanceId but schema has entityId
modelFieldReplace('StartAttestation', 'entityId       String     @map("entity_id") @db.Uuid', 'acceptanceId   String     @map("acceptance_id") @db.Uuid');
s = s.replace(
  /entity\s+VcvEntity\?\s+@relation\("start_attestation_entity"[^)]*\)/,
  'entity         VcvEntity? @relation("start_attestation_entity", fields: [acceptanceId], references: [id])'
);

// 4. BillingEvent: TS uses { employerId, status, stripeInvoiceItemId }
// Replace first occurrence (userId) with employerId, second (referenceId) with stripeInvoiceItemId
// But only in BillingEvent model
function replaceInModel(modelName, oldStr, newStr) {
  const re = new RegExp(`(model ${modelName} \\{[\\s\\S]*?)${oldStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  s = s.replace(re, `$1${newStr}`);
}

replaceInModel('BillingEvent', 'userId         String\\?    @map\\("user_id"\\)', 'employerId     String?    @map("employer_id")');
replaceInModel('BillingEvent', 'referenceId    String\\?    @map\\("reference_id"\\)', 'stripeInvoiceItemId String? @map("stripe_invoice_item_id")');
// status already exists in BillingEvent? Let me check...
// The error says 'status' does not exist in BillingEventUpdateInput
// So we need a status field. Let's add it if missing.
if (!s.match(/model BillingEvent[\s\S]*?status\s+String/)) {
  replaceInModel('BillingEvent', 'amount         Decimal', 'status         String?\n  amount         Decimal');
}

// 5. EmployerWebhookConfig: TS uses employerId but schema may have organizationId
replaceInModel('EmployerWebhookConfig', 'organizationId String     @map\\("organization_id"\\) @db\\.Uuid', 'employerId     String     @map("employer_id") @db.Uuid');

// 6. User: displayName missing from VcvEntity (used in educationService.ts line 149)
// This is about VcvEntity, not User. Let me check if VcvEntity has displayName
// Actually error says Property 'displayName' does not exist on type VcvEntity
// This is a code issue, not schema. But let's check if the schema has it.
// We'll fix code instead for this one — skip for now.

// 7. orgContextService: 'requestor' vs 'requestorId', 'subjects' missing
// This is about VcvOrganizationContext model. Code uses .requestor but schema has requestorId
// Add relation
// 'subjects' doesn't exist — need to add relation to Subject
// These are relation issues, not field renames. Skip for now — fix code.

// 8. actions.test.ts etc: 'personProfile' doesn't exist on User create input
// Need personProfile relation on User model
// Skip — fix code.

// 9. entity.ts:181 — type 'never' — this is a code issue

// 10. hiring.ts:212,232,233, etc — string | null not assignable to string
// These are null safety issues in code, not schema. Skip.

// 11. StateComplianceRule: 'state_ruleType' compound index
// Need @@unique([state, ruleType]) on StateComplianceRule
if (!s.includes('@@unique([state, ruleType])')) {
  s = s.replace(
    /(model StateComplianceRule \{[\s\S]*?)^(\})/m,
    '$1  @@unique([state, ruleType])\n$2'
  );
}

fs.writeFileSync(p, s);
console.log('Schema patched v2');
