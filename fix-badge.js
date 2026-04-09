const fs = require('fs');
const file = '/Users/christoler/vitalcv/apps/web/components/ui/trust-status-badge.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const VDS_STATUS_META: Record<SupplementalVdsTrustStatus, \{ className: string; label: string \}> = \{[\s\S]*?\n\};\n\nconst CANONICAL_TRUST_BADGE_STATUSES/;

const replacement = `const VDS_STATUS_META: Record<SupplementalVdsTrustStatus, { className: string; label: string }> = {
  enrolled: {
    className:
      'border-transparent bg-[var(--vt-badge-checked-bg)] text-[var(--vt-badge-checked-text)]',
    label: getVdsTrustStatusLabel('enrolled'),
  },
  access_required: {
    className:
      'border-transparent bg-[var(--vt-badge-access-bg)] text-[var(--vt-badge-access-text)]',
    label: getVdsTrustStatusLabel('access_required'),
  },
  not_decision_grade: {
    className:
      'border-transparent bg-[var(--vt-badge-access-bg)] text-[var(--vt-badge-access-text)]',
    label: getVdsTrustStatusLabel('not_decision_grade'),
  },
  blocked: {
    className:
      'border-transparent bg-[var(--vt-badge-unavailable-bg)] text-[var(--vt-badge-unavailable-text)]',
    label: getVdsTrustStatusLabel('blocked'),
  },
};

const CANONICAL_TRUST_BADGE_STATUSES`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
