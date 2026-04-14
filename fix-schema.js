const fs = require('fs');
const path = '/Users/christoler/vitalcv-consolidation-2/apps/api/backend/prisma/schema.prisma';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/programName\s+String\s+@map\("program_name"\)/, 'programName       String?  @map("program_name")');
code = code.replace(/institution\s+String/, 'institution       String?');

code = code.replace(/entityId\s+String\s+@map\("entity_id"\)\s+@db\.Uuid/, 'entityId     String?  @map("entity_id") @db.Uuid');
code = code.replace(/organization\s+String/, 'organization String?');

code = code.replace(/employerId\s+String\?\s+@map\("employer_id"\)/, 'employerId   String   @map("employer_id")');
code = code.replace(/clinicianNpi\s+String\?\s+@map\("clinician_npi"\)/, 'clinicianNpi String   @map("clinician_npi")');

code = code.replace(/organizationId\s+String\s+@map\("organization_id"\)\s+@db\.Uuid/, 'employerId     String   @map("employer_id") @db.Uuid');
code = code.replace(/organization\s+String\?/, 'employerName   String?');

code = code.replace(/entityId\s+String\s+@map\("entity_id"\)\s+@db\.Uuid/, 'acceptanceId String   @map("acceptance_id") @db.Uuid');

code = code.replace(/entityId\s+String\?\s+@map\("entity_id"\)/, 'employerId   String?  @map("employer_id")');
code = code.replace(/userId\s+String\?\s+@map\("user_id"\)/, 'status       String?');
code = code.replace(/referenceId\s+String\?\s+@map\("reference_id"\)/, 'stripeInvoiceItemId String? @map("stripe_invoice_item_id")');

fs.writeFileSync(path, code);
console.log('Patched schema.prisma');