const fs = require('fs');
const file = '/Users/christoler/vitalcv/apps/web/components/ui/trust-status-badge.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("case 'access required':", "");
content = content.replace("case 'not decision-grade':", "case 'not_decision_grade':");
content = content.replace("case 'review required':", "");

fs.writeFileSync(file, content);
