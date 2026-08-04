// WAVE 19 · Confidence Doctrine — Showcase + supplemental components
//
// This file holds:
//   • ConfidenceDoctrineCallout — section explaining the doctrine, suitable for an
//     "About" or "How we render confidence" page
//   • ConfidenceShowcase — full demo surface rendering every tier × every size,
//     the legend, the field-help affordance, and the contradiction inspector

function ConfidenceDoctrineCallout({ className = '' }) {
  const n = window.confidenceDoctrineNarrative;
  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-start gap-3 mb-4">
        <Icon.Info size={18} className="text-slate-700 mt-0.5" />
        <div>
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1">{n.headline}</div>
          <h3 className="text-[16px] font-semibold text-slate-900 tracking-tightish">{n.principle}</h3>
        </div>
      </div>
      <ul className="space-y-2.5 text-[13px] text-slate-700 leading-relaxed">
        {n.rules.map((r, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="mono text-[11px] text-slate-400 mt-0.5 tabular-nums">{String(i+1).padStart(2,'0')}</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 pt-4 border-t border-slate-100 text-[11.5px] text-slate-500">
        {n.footer}
      </div>
    </Card>
  );
}

/* ---------- ConfidenceShowcase ----------
 * Wired demo of every tier across every size, plus the legend, field help, and
 * the contradiction inspector. Used by wave19 surface only — do not hot-link from
 * production views.
 */
function ConfidenceShowcase() {
  const tiers = ['verified', 'inferred', 'unknown', 'contradicted'];
  const sizes = ['xs', 'sm', 'md', 'lg'];

  // Sample contradiction
  const contradiction = {
    field: 'NPI taxonomy',
    sources: [
      { source: 'NPPES (CMS)',          value: 'Physician Assistant · 363A00000X', badge: 'verified', fetchedAt: '2 days ago' },
      { source: 'CAQH self-attestation', value: 'Physician Assistant · 363AM0700X', badge: 'inferred', fetchedAt: '14 hours ago' },
    ],
  };

  // Sample fields with mixed confidence
  const fields = [
    { id: 'name',    label: 'Legal name',         value: 'MACIE MILLER',                         confidence: 'verified',     hint: 'Matched against NPPES + state board record.' },
    { id: 'dob',     label: 'Date of birth',      value: '198x · partial match',                 confidence: 'inferred',     hint: 'Year-of-birth provided; full DOB not yet attested.' },
    { id: 'address', label: 'Practice address',   value: '— pending uploads',                    confidence: 'unknown',      hint: 'No source has supplied this field.' },
    { id: 'tax',     label: 'NPI taxonomy code',  value: '363A00000X · 363AM0700X (split)',      confidence: 'contradicted', hint: 'Two sources disagree.' },
  ];

  return (
    <div className="space-y-8">
      {/* Tier × Size matrix */}
      <Card className="p-6">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1">19.1 · Tier × Size</div>
            <h3 className="text-[15px] font-semibold text-slate-900 tracking-tightish">All four tiers, all four sizes</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="text-[12.5px] w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 pr-4 mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500 font-medium">Tier</th>
                {sizes.map(s => (
                  <th key={s} className="text-left py-2 pr-4 mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500 font-medium">size: {s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tiers.map(t => {
                const m = window.CONFIDENCE_META[t];
                return (
                  <tr key={t} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-3 pr-4 align-middle">
                      <div className="text-slate-900 font-medium">{m.label}</div>
                      <div className="text-[11px] text-slate-500">{m.short}</div>
                    </td>
                    {sizes.map(s => (
                      <td key={s} className="py-3 pr-4 align-middle">
                        <ConfidenceBadge tier={t} size={s} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Field help — hover, focus, click-pinned */}
      <Card className="p-6">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1">19.2 · Field help</div>
            <h3 className="text-[15px] font-semibold text-slate-900 tracking-tightish">Why is this field at this tier?</h3>
            <p className="text-[12.5px] text-slate-600 mt-1">Hover, keyboard-focus, or click the help button next to a field to read the doctrine for that tier.</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {fields.map(f => (
            <div key={f.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.08em] text-slate-500">{f.label}</div>
                <div className="text-[14px] text-slate-900">{f.value}</div>
                <div className="text-[11.5px] text-slate-500 mt-0.5">{f.hint}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ConfidenceBadge tier={f.confidence} size="sm" />
                <ConfidenceFieldHelp tier={f.confidence} label={f.label} source={f.confidence === 'verified' ? 'NPPES (CMS)' : 'mixed'} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Contradiction inspector */}
      <Card className="p-6">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1">19.3 · Contradiction inspector</div>
            <h3 className="text-[15px] font-semibold text-slate-900 tracking-tightish">When sources disagree</h3>
            <p className="text-[12.5px] text-slate-600 mt-1">A contradiction is a recall-scope problem, not a doctrine change. Both sources stay visible; resolution requires explicit human reconciliation.</p>
          </div>
        </div>
        <ContradictionInspector contradiction={contradiction} />
      </Card>

      {/* Legend */}
      <Card className="p-6">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1">19.4 · Legend</div>
            <h3 className="text-[15px] font-semibold text-slate-900 tracking-tightish">Page-footer doctrine legend</h3>
            <p className="text-[12.5px] text-slate-600 mt-1">Place once per surface that renders confidence badges.</p>
          </div>
        </div>
        <ConfidenceLegend />
      </Card>
    </div>
  );
}

window.ConfidenceDoctrineCallout = ConfidenceDoctrineCallout;
window.ConfidenceShowcase = ConfidenceShowcase;
