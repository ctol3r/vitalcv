import * as React from 'react';

export function KnowledgeTrustGraphPanel() {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/20">
        <h3 className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
          Knowledge Trust Graph
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          The structural flow of evidence and truth within this profile.
        </p>
      </div>
      <div className="p-6 overflow-x-auto">
        <div className="flex items-center gap-4 min-w-[800px] pb-4">
          {['Clinician', 'NPI', 'Source Checks', 'PSV Receipts', 'Passport', 'Proof Pack'].map((node, i) => (
            <React.Fragment key={node}>
              <div className="px-3 py-1.5 rounded border border-border bg-background text-xs font-medium text-foreground whitespace-nowrap shadow-sm">
                {node}
              </div>
              {i < 5 && <div className="text-muted-foreground/40 text-xs">→</div>}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-muted-foreground">
          <ul className="space-y-1.5 list-disc pl-4">
            <li>NPPES is identity, not licensure proof.</li>
            <li>Partial proof stays partial.</li>
          </ul>
          <ul className="space-y-1.5 list-disc pl-4">
            <li>Trust container does not upgrade proof tier.</li>
            <li>Audit events prove action history, not clinical truth.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
