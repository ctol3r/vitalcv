const fs = require('fs');
const path = '/Users/christoler/vitalcv-consolidation-2/apps/web/app/p/[slug]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/function EmployerActionHooks\(\{ npi \}: \{ npi: string \}\) \{\s*return \(\s*<div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card\/95 backdrop-blur-sm">[\s\S]*?<\/div>\s*\);\s*\}/, '');

fs.writeFileSync(path, code);
console.log('Fixed duplicate');