const fs = require('fs');
const path = '/Users/christoler/vitalcv-consolidation-2/apps/web/app/p/[slug]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. We want to update the EmployerActivity badge text to be less abstract, more active.
// E.g., 'Employer Activity' -> 'Prior Employer Verification Decisions'
code = code.replace(
  '<p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Employer Activity</p>',
  '<p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Prior Employer Decisions</p>'
);

// 2. We want to update the Limitations card to be more assertive about risk.
// E.g., 'What We Did NOT Verify' -> 'Critical Verification Gaps (Unverified Risk)'
// 'The following sources are excluded...' -> 'The following required sources have NOT been verified yet:'
code = code.replace(
  'What We Did NOT Verify',
  'Verification Gaps (Unverified Risk)'
);
code = code.replace(
  'The following sources are excluded from this trust snapshot:',
  'The following required sources have NOT been verified yet:'
);

// 3. We want to tighten the Decision Posture card language.
// Instead of just PROCEED, let's use:
// DECISION_GRADE -> "CLEARED TO HIRE"
// PARTIAL -> "PARTIAL DATA (RISK PRESENT)"
// BLOCKED -> "BLOCKER DETECTED (DO NOT HIRE)"
// INSUFFICIENT DATA -> "INSUFFICIENT DATA"
code = code.replace(
  "decision.status === 'DECISION_GRADE' ? 'PROCEED' :",
  "decision.status === 'DECISION_GRADE' ? 'CLEARED TO HIRE' :"
);
code = code.replace(
  "decision.status === 'PARTIAL' ? 'PROCEED WITH CAUTION' :",
  "decision.status === 'PARTIAL' ? 'PARTIAL DATA (RISK PRESENT)' :"
);
code = code.replace(
  "decision.status === 'BLOCKED' ? 'DO NOT PROCEED' : 'INSUFFICIENT DATA';",
  "decision.status === 'BLOCKED' ? 'BLOCKER DETECTED (DO NOT HIRE)' : 'INSUFFICIENT DATA';"
);

// Rationale -> "Decision Rationale"
code = code.replace(
  '<p className="text-sm font-semibold uppercase text-muted-foreground mb-1">Rationale</p>',
  '<p className="text-sm font-semibold uppercase text-muted-foreground mb-1">Decision Rationale</p>'
);

fs.writeFileSync(path, code);
console.log('Fixed Language Pressure');
