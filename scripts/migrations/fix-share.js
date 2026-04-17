const fs = require('fs');
const path = '/Users/christoler/vitalcv-consolidation-2/apps/web/app/p/[slug]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add server-side view tracking — fire-and-forget POST to telemetry when page loads
const viewTracker = `
  // Server-side: log page view (fire-and-forget)
  if (profile.mode === 'npi') {
    fetch(\\\`http://\\\${process.env.NEXT_PUBLIC_BACKEND_URL || ''}/api/pilot/telemetry\\\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npi: profile.npi, actionTaken: 'view' }),
    }).catch(() => {});
  }
`;

code = code.replace(
  '  if (!profile) notFound();',
  '  if (!profile) notFound();\n' + viewTracker
);

// 2. Add a "Copy Link" share button next to ApplyWithVitalCV
const shareButton = `
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => {
                    const url = window.location.href;
                    navigator.clipboard.writeText(url);
                    const btn = document.getElementById('copy-link-btn');
                    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy Link'; }, 2000); }
                  }}
                  id="copy-link-btn"
                  className="rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-border"
                >Copy Link</button>
                <ApplyWithVitalCV npi={profile.npi} label="Apply with VitalCV" />
              </div>
`;

code = code.replace(
  `<ApplyWithVitalCV npi={profile.npi} label="Apply with VitalCV" />`,
  shareButton.trim()
);

fs.writeFileSync(path, code);
console.log('Done');