const fs = require('fs');
const path = '/Users/christoler/vitalcv-consolidation-2/apps/web/app/p/[slug]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  '>Flag Issue</button>',
  '>Reject Candidate</button>'
);

code = code.replace(
  '>Accept Candidate</button>',
  '>Hire Candidate</button>'
);

code = code.replace(
  "handleAction('flag', 'Issue flagged for review.')",
  "handleAction('flag', 'Candidate rejected. Reason logged.')"
);

code = code.replace(
  "handleAction('accept', 'Candidate accepted.')",
  "handleAction('accept', 'Candidate approved for hire.')"
);

fs.writeFileSync(path, code);
console.log('Fixed Action Pressure');