// WAVE 15 · Career Autopilot components

/* ---------- Trust Header ---------- */
function AutopilotHeader({ clinician }) {
  const pct = Math.round(clinician.trustScore * 100);
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white p-6">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-1">Career Autopilot · Trust Mode</div>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight">
            We watch your credentials so you don't have to.
          </h1>
          <p className="mt-2 text-[13px] text-slate-600 leading-[1.55] max-w-[64ch]">
            Continuous monitoring across {clinician.enrollmentsActive} active payer panels, your home state board, DEA, NPDB, and {clinician.primaryFacility}. We surface what needs attention; we don't manufacture authorization.
          </p>
        </div>
        <div className="flex items-stretch gap-4">
          <div className="border-l border-slate-200 pl-4">
            <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Trust Level</div>
            <div className="text-[28px] font-semibold tracking-tightish text-slate-900 leading-none mt-1 mb-1">{clinician.trustLevel}</div>
            <div className="mono text-[10.5px] text-slate-600">Verified · Active</div>
          </div>
          <div className="border-l border-slate-200 pl-4">
            <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Composite Score</div>
            <div className="text-[28px] font-semibold tracking-tightish text-slate-900 leading-none mt-1 mb-1 tabular-nums">{pct}<span className="text-[16px] text-slate-400">/100</span></div>
            <div className="mono text-[10.5px] text-slate-600">7 source factors</div>
          </div>
          <div className="border-l border-slate-200 pl-4">
            <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Last Full Sync</div>
            <div className="mono text-[14px] text-slate-900 mt-1 mb-1">{clinician.lastFullSync.split(' ')[1]}</div>
            <div className="mono text-[10.5px] text-slate-600">{clinician.lastFullSync.split(' ')[0]}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Renewal Radar ---------- */
function RenewalRadar({ items }) {
  // Plot on a 540-day horizon. Items past expiration anchored to 0.
  const HORIZON = 540;
  const sorted = [...items].sort((a, b) => a.daysToExpire - b.daysToExpire);

  return (
    <div className="border border-slate-200 rounded-[3px] bg-white overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Activity size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Renewal Radar · 18-month horizon</span>
        </div>
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 flex items-center gap-3">
          {Object.entries(ACTION_META).map(([k, m]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
              <span>{m.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Time axis */}
      <div className="px-5 pt-4 pb-2">
        <div className="relative h-7 border-b border-slate-200">
          {[0, 90, 180, 270, 360, 450, 540].map(d => {
            const left = (d / HORIZON) * 100;
            const label = d === 0 ? 'Today' : `${Math.round(d / 30)}mo`;
            return (
              <div key={d} className="absolute top-0" style={{ left: `${left}%` }}>
                <div className="h-3 w-px bg-slate-300" />
                <div className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500 mt-1 -translate-x-1/2">{label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lanes by kind */}
      <div className="px-5 pb-4 space-y-1.5">
        {sorted.map(item => {
          const left = Math.max(0, Math.min(100, (item.daysToExpire / HORIZON) * 100));
          const meta = ACTION_META[item.action];
          const kindMeta = KIND_META[item.kind];
          return (
            <div key={item.id} className="relative h-9 flex items-center group">
              <div className="w-[160px] flex items-center gap-2 mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500 shrink-0">
                <span className="w-4 text-center text-slate-400">{kindMeta.glyph}</span>
                <span className="truncate">{kindMeta.label}</span>
              </div>
              <div className="flex-1 relative h-full">
                {/* Track */}
                <div className="absolute inset-y-3 left-0 right-0 bg-slate-50 rounded-[2px]" />
                {/* Marker */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                  style={{ left: `${left}%` }}
                >
                  <div className={cn('inline-flex items-center gap-2 px-2.5 py-1 rounded-[2px] ring-1 ring-inset bg-white text-[11.5px] font-medium', meta.pill, meta.text)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot, item.action === 'urgent' && 'pulse-soft')} />
                    <span className="text-slate-900">{item.label}</span>
                    <span className="mono text-[10px] text-slate-500">{item.daysToExpire}d</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail rows */}
      <div className="border-t border-slate-200 divide-y divide-slate-100">
        {sorted.slice(0, 4).map(item => {
          const meta = ACTION_META[item.action];
          return (
            <div key={item.id} className="px-5 py-3 grid grid-cols-12 gap-4 items-center lane-row">
              <div className="col-span-3">
                <div className="text-[12.5px] font-medium text-slate-900">{item.label}</div>
                <div className="mono text-[10.5px] text-slate-500 mt-0.5">{item.authority}</div>
              </div>
              <div className="col-span-2">
                <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] ring-1 ring-inset text-[10.5px] font-medium uppercase tracking-[0.06em]', meta.pill, meta.text)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                  {meta.label}
                </span>
              </div>
              <div className="col-span-3 mono text-[11px] text-slate-600 leading-[1.55]">
                {item.protocol}
              </div>
              <div className="col-span-2 mono text-[11px] text-slate-600 tabular-nums">
                <div className="text-slate-500 uppercase tracking-[0.1em] text-[9.5px]">Expires</div>
                <div className="text-slate-900 mt-0.5">{item.expires}</div>
              </div>
              <div className="col-span-2 text-right">
                {item.cmeRequired && (
                  <div className="mono text-[10.5px] text-slate-600 tabular-nums">
                    CME <span className="text-slate-900">{item.cmeOnFile}/{item.cmeRequired}</span>
                  </div>
                )}
                {item.fee && (
                  <div className="mono text-[10.5px] text-slate-500 tabular-nums">{item.fee}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- NBA Queue ---------- */
function NBAQueue({ items }) {
  const sevMeta = {
    high:   { pill: 'bg-rose-50 text-rose-700 ring-rose-600/20',     dot: 'bg-rose-500' },
    medium: { pill: 'bg-amber-50 text-amber-800 ring-amber-600/20', dot: 'bg-amber-500' },
    low:    { pill: 'bg-slate-100 text-slate-700 ring-slate-300',   dot: 'bg-slate-500' },
  };
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Sparkles size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Next Best Actions</span>
        </div>
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">Ranked · explainable</div>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map(a => {
          const m = sevMeta[a.severity];
          return (
            <li key={a.id} className="px-5 py-4 grid grid-cols-12 gap-4">
              <div className="col-span-1">
                <div className={cn('h-7 w-7 rounded-full inline-flex items-center justify-center mono text-[12px] font-semibold ring-1 ring-inset', m.pill)}>
                  {a.rank}
                </div>
              </div>
              <div className="col-span-7">
                <div className="text-[14px] font-semibold text-slate-900">{a.title}</div>
                <div className="text-[12px] text-slate-600 mt-0.5">{a.subtitle}</div>
                <div className="mt-2 text-[12px] text-slate-700 leading-[1.55] border-l-2 border-slate-200 pl-3">
                  {a.impact}
                </div>
                <div className="mono text-[10.5px] text-slate-500 mt-2">↳ {a.receipt}</div>
              </div>
              <div className="col-span-4 flex flex-col items-end justify-center gap-2">
                <button className="inline-flex items-center gap-1.5 mono text-[11px] uppercase tracking-[0.08em] bg-slate-900 text-white px-3 h-8 rounded-[2px] hover:bg-black">
                  {a.ctaLabel}
                  <Icon.ArrowRight size={11} />
                </button>
                <button className="mono text-[10.5px] uppercase tracking-[0.08em] text-slate-500 hover:text-slate-900">{a.ctaSecondary}</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

window.AutopilotHeader = AutopilotHeader;
window.RenewalRadar = RenewalRadar;
window.NBAQueue = NBAQueue;
