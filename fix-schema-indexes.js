const fs = require('fs');
const path = '/Users/christoler/vitalcv-consolidation-2/apps/api/backend/prisma/schema.prisma';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/fields: \[entityId\]/g, 'fields: [acceptanceId]');
code = code.replace(/@@index\(\[organizationId\]\)/g, '@@index([employerId])');
code = code.replace(/@@index\(\[organization\]\)/g, '@@index([employerId])');
code = code.replace(/@@index\(\[entityId\]\)/g, '@@index([acceptanceId])');
code = code.replace(/@@index\(\[userId\]\)/g, '@@index([status])');

fs.writeFileSync(path, code);
console.log('Fixed indexes');