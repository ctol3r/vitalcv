// W245 · D5 — Career Health Card (reusable).
// One component that answers "how healthy is my career?" — evidence completeness,
// trust strength, readiness, and risk — composed at read time, never stored.
// Used on the Home hero (variant="full") and can drop anywhere (variant="compact").

function HealthMeter({ label, value, suffix, sub, Icon: I, tone = 'slate' }) {
  const barTone = { slate: 'bg-slate-900', emerald: 'bg-emerald-600', amber: 'bg-amber-500', indigo: 'bg-indigo-600' }[tone] || 'bg-slate-900';
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-1.5">
        {I && <I size={13} className="text-slate-400 flex-shrink-0" />}
        <span className="mono text-[9.5px] uppercase tracking-[0.13em] text-slate-500 truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[26px] font-semibold text-slate-900 tracking-[-0.02em] leading-none tabular-nums">{value}</span>
        {suffix && <span className="mono text-[11px] text-slate-400">{suffix}</span>}
      </div>
      <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', barTone)} style={{ width: `${typeof value === 'number' ? value : 100}%` }} />
      </div>
      <p className="text-[10.5px] text-slate-500 leading-tight mt-1.5">{sub}</p>
    </div>
  );
}

function CareerHealthCard({ entity, variant = 'full', onOpen }) {
  const h = computeHealth();
  const ring = h.overall;
  const C = 2 * Math.PI * 34; // circumference for r=34
  const dash = (ring / 100) * C;

  const risks = window.RISK_FACTORS || [];

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      {/* Header band */}
      <div className="px-5 py-3 bg-slate-950 text-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon.Pulse size={15} className="text-emerald-400 flex-shrink-0" />
          <span className="text-[13px] font-semibold truncate">Career Health</span>
          <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500 hidden sm:inline">composed at read time</span>
        </div>
        <span className="mono text-[10px] uppercase tracking-[0.12em] text-slate-400 flex-shrink-0">/career</span>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-5 flex-wrap">
          {/* Radial overall */}
          <div className="relative flex-shrink-0" style={{ width: 96, height: 96 }}>
            <svg viewBox="0 0 80 80" className="w-24 h-24 -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" strokeWidth="7" />
              <circle cx="40" cy="40" r="34" fill="none" stroke="#0f172a" strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${dash} ${C}`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[24px] font-semibold text-slate-900 tracking-[-0.02em] leading-none tabular-nums">{h.overall}</span>
              <span className="mono text-[8px] uppercase tracking-[0.1em] text-slate-400 mt-0.5">/ 100</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[19px] font-semibold text-slate-900 tracking-tightish">{h.band}</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 ring-1 ring-inset ring-emerald-600/20 rounded-full px-2 py-0.5">
                <Icon.ShieldCheck size={11} /> Owned · portable
              </span>
            </div>
            <p className="text-[12.5px] text-slate-600 leading-snug mt-1.5 max-w-[52ch]">
              {entity.fullName.split(' ')[0].charAt(0) + entity.fullName.split(' ')[0].slice(1).toLowerCase()} is a well-evidenced, market-ready clinician.
              {' '}<span className="text-slate-900 font-medium">{h.readinessReady} of {h.readinessTotal}</span> readiness dimensions clear,
              {' '}<span className="text-slate-900 font-medium">{h.verifiedSources} of {h.totalSources}</span> evidence lanes open,
              {' '}and <span className="text-slate-900 font-medium">{h.riskCount}</span> open items to manage.
            </p>
          </div>
        </div>

        {/* Four meters */}
        <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-5">
          <HealthMeter label="Evidence" value={h.evidenceComplete} suffix="% complete" Icon={Icon.FileText}
            sub={`${h.verifiedSources}/${h.totalSources} source lanes verified`} />
          <HealthMeter label="Trust" value={h.trustStrength} suffix="strength" Icon={Icon.ShieldCheck} tone="emerald"
            sub="All facts current · 1 re-query queued" />
          <HealthMeter label="Readiness" value={h.readiness} suffix="market-ready" Icon={Icon.Gauge}
            sub={`${h.readinessReady}/${h.readinessTotal} dimensions clear`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon.AlertTri size={13} className="text-slate-400 flex-shrink-0" />
              <span className="mono text-[9.5px] uppercase tracking-[0.13em] text-slate-500 truncate">Risk factors</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[26px] font-semibold text-slate-900 tracking-[-0.02em] leading-none tabular-nums">{h.riskCount}</span>
              <span className="mono text-[11px] text-slate-400">open</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {risks.map(r => {
                const sv = RISK_SEV[r.sev];
                return <span key={r.id} className={cn('h-1.5 flex-1 min-w-[16px] rounded-full', sv.dot)} title={r.label} />;
              })}
            </div>
            <p className="text-[10.5px] text-slate-500 leading-tight mt-1.5">1 gate · 1 watch · 1 disclosed</p>
          </div>
        </div>
      </div>

      {variant === 'full' && (
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <span className="mono text-[9.5px] uppercase tracking-[0.12em] text-slate-500">
            Every figure dereferences to verified evidence — none is stored
          </span>
          {onOpen && (
            <button onClick={onOpen} className="text-[12px] font-medium text-slate-900 inline-flex items-center gap-1 hover:gap-1.5 transition-all">
              See what to do next <Icon.ArrowRight size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

window.CareerHealthCard = CareerHealthCard;
window.HealthMeter = HealthMeter;
