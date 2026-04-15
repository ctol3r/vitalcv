const fs = require('fs');
const path = '/Users/christoler/vitalcv-consolidation-2/apps/web/app/p/[slug]/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Remove TrustBandCard, CrsRing, TrustBadges
code = code.replace(/function TrustBandCard[\s\S]*?^}/m, '');
code = code.replace(/function CrsRing[\s\S]*?^}/m, '');
code = code.replace(/function TrustBadges[\s\S]*?^}/m, '');

// 2. Add DecisionPostureCard
const decisionCard = `
function DecisionPostureCard({ decision }: { decision?: any }) {
  if (!decision) return null;

  const headerColor = 
    decision.status === 'DECISION_GRADE' ? 'bg-green-100 text-green-800 border-green-200' :
    decision.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
    decision.status === 'BLOCKED' ? 'bg-red-100 text-red-800 border-red-200' :
    'bg-gray-100 text-gray-800 border-gray-200';

  const label = 
    decision.status === 'DECISION_GRADE' ? 'PROCEED' :
    decision.status === 'PARTIAL' ? 'PROCEED WITH CAUTION' :
    decision.status === 'BLOCKED' ? 'DO NOT PROCEED' : 'INSUFFICIENT DATA';

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className={\`px-5 py-4 border-b font-bold tracking-wider \${headerColor}\`}>
        {label}
      </div>
      <div className="p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase text-muted-foreground mb-1">Rationale</p>
          <p className="text-foreground">{decision.headline || 'No decision rationale available.'}</p>
        </div>
        
        {decision.blockers && decision.blockers.length > 0 && (
          <div>
            <p className="text-sm font-semibold uppercase text-red-600 mb-1">Blockers</p>
            <ul className="list-disc pl-5 text-sm text-foreground">
              {decision.blockers.map((b: string) => <li key={b}>{b}</li>)}
            </ul>
          </div>
        )}

        {decision.nextAction && (
          <div>
            <p className="text-sm font-semibold uppercase text-blue-600 mb-1">Next Actions</p>
            <p className="text-sm text-foreground">{decision.nextAction}</p>
          </div>
        )}
      </div>
    </div>
  );
}
`;

code = code.replace('function EventTimeline', decisionCard + '\nfunction EventTimeline');

// 3. Update the page rendering to use the new card instead of the old ones
code = code.replace(/<TrustBandCard[^>]*\/>/g, '<DecisionPostureCard decision={(profile as any).decision} />');
code = code.replace(/<CrsRing[^>]*\/>/g, '<DecisionPostureCard decision={(profile as any).decision} />');
code = code.replace(/<TrustBadges[^>]*\/>/g, '');

// 4. Update Employer Hook to have actual actions
const newHook = `
function EmployerActionHooks({ npi }: { npi: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl items-center justify-end gap-3 px-6 py-4">
        <button className="rounded-md border border-red-200 bg-red-50 text-red-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-red-100">
          Flag Issue
        </button>
        <button className="rounded-md border border-amber-200 bg-amber-50 text-amber-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-amber-100">
          Request More Data
        </button>
        <button className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700">
          Accept Candidate
        </button>
      </div>
    </div>
  );
}
`;

code = code.replace(/function SlugEmployerHook[\s\S]*?^}/m, newHook);
code = code.replace(/function AcceptStartCta[\s\S]*?^}/m, '');

// Update sticky CTA references
code = code.replace(/<AcceptStartCta[^>]*\/>/g, '<EmployerActionHooks npi={profile.npi} />');
code = code.replace(/<SlugEmployerHook[^>]*\/>/g, '<EmployerActionHooks npi={profile.slug} />');

fs.writeFileSync(path, code);
console.log('Fixed UI');