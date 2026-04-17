const fs = require('fs');
const file = '/Users/christoler/vitalcv/apps/web/lib/trust/status-language.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("label: getTrustStatusLabel('pending'),", "label: 'Pending',");
content = content.replace("label: getTrustStatusLabel('stale'),", "label: 'Stale',");
content = content.replace("label: getTrustStatusLabel('unavailable'),", "label: 'Unavailable',");
content = content.replace("label: getTrustStatusLabel('access_required'),", "label: 'Access required',");
content = content.replace("label: getTrustStatusLabel('review_required'),", "label: 'Review required',");

fs.writeFileSync(file, content);
