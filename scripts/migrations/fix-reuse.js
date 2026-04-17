const fs = require('fs');
const path = '/Users/christoler/vitalcv-consolidation-2/apps/web/app/p/[slug]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

const reuseBadge = `
function ReuseSignalBadge({ npi }: { npi: string }) {
  const [signal, setSignal] = React.useState<any>(null);
  React.useEffect(() => {
    fetch(\\\`/api/pilot/reuse-signal/\\\${npi}\\\`)
      .then(r => r.json())
      .then(setSignal)
      .catch(() => {});
  }, [npi]);

  if (!signal || signal.total_actions === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 mt-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Employer Activity</p>
      <div className="flex flex-wrap gap-4 text-sm text-foreground">
        {signal.accepted_count > 0 && (
          <span className="flex items-center gap-1">
            <span className="text-green-600">✓</span> {signal.accepted_count} accepted
          </span>
        )}
        {signal.request_data_count > 0 && (
          <span className="flex items-center gap-1">
            <span className="text-amber-500">⏳</span> {signal.request_data_count} requested data
          </span>
        )}
        {signal.flagged_count > 0 && (
          <span className="flex items-center gap-1">
            <span className="text-red-500">⚠</span> {signal.flagged_count} flagged
          </span>
        )}
      </div>
    </div>
  );
}
`;

code = code.replace('function LimitationsCard', reuseBadge + '\nfunction LimitationsCard');

// Add the badge below LimitationsCard in NPI mode
code = code.replace(
  '<LimitationsCard missing={(profile as any).decision?.missing || []} />\n              </section>',
  '<LimitationsCard missing={(profile as any).decision?.missing || []} />\n                <ReuseSignalBadge npi={profile.npi} />\n              </section>'
);

fs.writeFileSync(path, code);
console.log('Done');