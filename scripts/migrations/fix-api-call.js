const fs = require('fs');
const path = '/Users/christoler/vitalcv-consolidation-2/apps/web/app/p/[slug]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/\/api\/public\/profile\/npi\//g, '/api/passport/npi/');
code = code.replace(/\/api\/public\/profile\//g, '/api/passport/');

fs.writeFileSync(path, code);
console.log('Fixed API calls');