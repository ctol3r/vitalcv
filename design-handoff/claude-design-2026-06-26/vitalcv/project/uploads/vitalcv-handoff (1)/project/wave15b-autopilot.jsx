// WAVE 15b · Portability Map + Drift Monitor + Trust Score panel

/* ---------- Portability Map ---------- */
function PortabilityMap({ items }) {
  const META = {
    licensed:         { label: 'Licensed',          pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-600' },
    compact_eligible: { label: 'Compact-eligible',  pill: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',    dot: 'bg-indigo-500' },
    enrolled_payer:   { label: 'Payer-enrolled',     pill: 'bg-slate-100 text-slate-700 ring-slate-300',         dot: 'bg-slate-500' },
    dormant:          { label: 'Dormant',            pill: 'bg-amber-50 text-amber-800 ring-amber-600/20',      dot: 'bg-amber-500' },
  };

  return (
    <div className="border border-slate-200 rounded-[3px] bg-white overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Network size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Portability · State-by-state coverage</span>
        </div>
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          IMLC · PA Compact · Nurse Compact tracked
        </div>
      </div>

      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/30">
            <th className="text-left mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium px-5 py-2.5 w-[80px]">State</th>
            <th className="text-left mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium py-2.5">Status</th>
            <th className="text-left mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium py-2.5">Note</th>
            <th className="text-right mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium py-2.5">Since</th>
            <th className="text-right mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium py-2.5">Payers</th>
            <th className="px-5 py-2.5 w-[110px]"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map(s => {
            const m = META[s.status];
            return (
              <tr key={s.state} className="lane-row">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[14px] font-semibold text-slate-900">{s.state}</span>
                    {s.primary && <span className="mono text-[9px] uppercase tracking-[0.14em] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-[2px]">home</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{s.name}</div>
                </td>
                <td className="py-3">
                  <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] ring-1 ring-inset text-[10.5px] font-medium uppercase tracking-[0.06em]', m.pill)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
                    {m.label}
                  </span>
                </td>
                <td className="py-3 text-[11.5px] text-slate-600 leading-[1.55] max-w-[360px]">{s.note}</td>
                <td className="py-3 text-right mono text-[11px] text-slate-700 tabular-nums">{s.since || '—'}</td>
                <td className="py-3 text-right mono text-[11px] text-slate-900 tabular-nums">{s.payers || '—'}</td>
                <td className="px-5 py-3 text-right">
                  {s.status === 'compact_eligible' && (
                    <button className="mono text-[10.5px] uppercase tracking-[0.08em] text-indigo-700 hover:underline">
                      Pre-stage →
                    </button>
                  )}
                  {s.status === 'dormant' && (
                    <button className="mono text-[10.5px] uppercase tracking-[0.08em] text-amber-800 hover:underline">
                      Reactivate →
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Drift Monitor ---------- */
function DriftMonitor({ fields }) {
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Gauge size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Drift Monitor · Verified vs. Attested</span>
        </div>
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          Two clocks · primary-source ≠ self-attestation
        </div>
      </div>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/30">
            <th className="text-left mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium px-5 py-2.5">Field</th>
            <th className="text-left mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium py-2.5">Authority</th>
            <th className="text-right mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium py-2.5">Last Verified</th>
            <th className="text-right mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium py-2.5">Last Attested</th>
            <th className="text-right mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium py-2.5">Δ</th>
            <th className="text-right mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium px-5 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {fields.map(f => {
            const m = DRIFT_META[f.status];
            return (
              <tr key={f.id} className="lane-row">
                <td className="px-5 py-3 text-[12.5px] font-medium text-slate-900">{f.label}</td>
                <td className="py-3 text-[11.5px] text-slate-600">{f.authority}</td>
                <td className="py-3 text-right mono text-[11px] text-slate-700 tabular-nums">{f.verifiedAt || <span className="text-rose-700">never</span>}</td>
                <td className="py-3 text-right mono text-[11px] text-slate-700 tabular-nums">{f.attestedAt}</td>
                <td className="py-3 text-right mono text-[11px] text-slate-500">{f.delta}</td>
                <td className="px-5 py-3 text-right">
                  <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] ring-1 ring-inset text-[10.5px] font-medium uppercase tracking-[0.06em]', m.pill)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
                    {m.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Trust Score Panel ---------- */
function TrustScorePanel({ factors }) {
  const composite = factors.reduce((s, f) => s + f.weight * f.score, 0);
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Shield size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Composite Trust Score</span>
        </div>
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 tabular-nums">
          {Math.round(composite * 100)} · weighted
        </div>
      </div>
      <ul className="divide-y divide-slate-100">
        {factors.map((f, i) => {
          const pct = Math.round(f.score * 100);
          return (
            <li key={i} className="px-5 py-3">
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <span className="text-[12.5px] text-slate-900 font-medium">{f.label}</span>
                <span className="mono text-[10.5px] text-slate-500 tabular-nums">w {(f.weight * 100).toFixed(0)}% · {pct}/100</span>
              </div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                <div
                  className={cn('h-full', pct >= 95 ? 'bg-emerald-600' : pct >= 85 ? 'bg-slate-700' : pct >= 70 ? 'bg-amber-500' : 'bg-rose-500')}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-600 leading-[1.5]">{f.note}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

window.PortabilityMap = PortabilityMap;
window.DriftMonitor = DriftMonitor;
window.TrustScorePanel = TrustScorePanel;
