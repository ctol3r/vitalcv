// WAVE 14 · Start-Activation Console (Credentialing Mode)
// Day-1 Readiness — what happens AFTER acceptance: privileging · payer · onboarding.

/* ---------- Critical Path strip (top) ---------- */
function CriticalPathStrip({ stages }) {
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Activity size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Critical Path · Start Activation</span>
        </div>
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          Hospital protocol · MS-08
        </div>
      </div>

      <div className="grid grid-cols-4 divide-x divide-slate-200">
        {stages.map((s, i) => {
          const isDone = s.state === 'done';
          const isActive = s.state === 'in_progress';
          const isPending = s.state === 'pending';
          return (
            <div key={s.id} className="px-5 py-4 relative">
              {/* Stage number + connector */}
              <div className="flex items-center gap-2 mb-2">
                <span className={cn(
                  'mono text-[10.5px] tracking-[0.14em] uppercase',
                  isDone ? 'text-emerald-700' : isActive ? 'text-amber-800' : 'text-slate-400'
                )}>
                  Stage {String(i + 1).padStart(2, '0')}
                </span>
                {isDone && <Icon.Check size={12} className="text-emerald-600" />}
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 pulse-soft" />}
                {isPending && <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
              </div>

              <div className="text-[15px] font-semibold tracking-tightish text-slate-900 mb-0.5">
                {s.label}
              </div>
              <div className="text-[11.5px] text-slate-600 leading-[1.5] mb-3">
                {s.sub}
              </div>

              {/* Progress bar */}
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-2">
                <div
                  className={cn(
                    'h-full transition-all',
                    isDone ? 'bg-emerald-600' : isActive ? 'bg-amber-500' : 'bg-slate-300'
                  )}
                  style={{ width: isDone ? '100%' : `${Math.round((s.progress || 0) * 100)}%` }}
                />
              </div>

              {/* Meta */}
              <div className="flex items-center justify-between mono text-[10.5px]">
                <span className="text-slate-500 uppercase tracking-[0.1em]">
                  {isDone ? 'Completed' : isActive ? 'ETA' : 'Targets'}
                </span>
                <span className="text-slate-900 tabular-nums">
                  {isDone ? s.completedAt?.split(' ')[0] : (s.eta || '—')}
                </span>
              </div>
              <div className="mono text-[10.5px] text-slate-500 mt-1 truncate">
                Owner: <span className="text-slate-900">{s.owner}</span>
              </div>

              {/* Stage→Stage arrow */}
              {i < stages.length - 1 && (
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 hidden md:block">
                  <div className={cn(
                    'h-4 w-4 rounded-full border-2 flex items-center justify-center',
                    isDone ? 'bg-white border-emerald-300' : 'bg-white border-slate-200'
                  )}>
                    <Icon.ChevronRight size={10} className={isDone ? 'text-emerald-600' : 'text-slate-400'} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Burn-down card ---------- */
function BurnDownCard({ caseData }) {
  const { dtsEstimate, dtsTrend, daysSinceAccept, startDateLabel } = caseData;
  const delta = dtsEstimate.baseline - dtsEstimate.p50;
  const deltaPct = Math.round((delta / dtsEstimate.baseline) * 100);

  // Sparkline geometry
  const sparkW = 220, sparkH = 44;
  const max = Math.max(...dtsTrend), min = Math.min(...dtsTrend);
  const span = Math.max(1, max - min);
  const pts = dtsTrend.map((v, i) => {
    const x = (i / (dtsTrend.length - 1)) * (sparkW - 4) + 2;
    const y = sparkH - 4 - ((v - min) / span) * (sparkH - 8);
    return [x, y];
  });
  const polyline = pts.map(p => p.join(',')).join(' ');
  const last = pts[pts.length - 1];

  return (
    <div className="border border-slate-200 rounded-[3px] bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-0.5">Burn-down · DTS</div>
          <div className="text-[13px] font-semibold text-slate-900">Days to first paid shift</div>
        </div>
        <Chip state="pending" size="sm">Tracking</Chip>
      </div>

      {/* Headline */}
      <div className="flex items-end gap-3 mb-2">
        <div className="text-[40px] font-semibold tracking-[-0.025em] text-slate-900 leading-none tabular-nums">
          {dtsEstimate.p50}
        </div>
        <div className="text-[14px] text-slate-600 mb-1">days remaining</div>
      </div>
      <div className="mono text-[11px] text-slate-500 mb-4">
        Range <span className="text-slate-900">P10 {dtsEstimate.p10}d</span> · <span className="text-slate-900">P90 {dtsEstimate.p90}d</span> · model <span className="text-slate-900">vc-dts-2.4</span>
      </div>

      {/* Sparkline */}
      <div className="border border-slate-200 rounded-[3px] bg-slate-50/40 p-3 mb-3">
        <div className="flex items-center justify-between mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500 mb-2">
          <span>Estimate · last {dtsTrend.length} days</span>
          <span className="text-emerald-700">↓ {dtsTrend[0] - dtsTrend[dtsTrend.length - 1]}d</span>
        </div>
        <svg width={sparkW} height={sparkH} className="overflow-visible">
          <polyline fill="none" stroke="#0f172a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" points={polyline} />
          <circle cx={last[0]} cy={last[1]} r="2.5" fill="#0f172a" />
          {pts.slice(0, -1).map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r="1.3" fill="#94a3b8" />
          ))}
        </svg>
      </div>

      {/* Baseline delta */}
      <div className="border-t border-slate-200 pt-3 grid grid-cols-3 gap-3">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500">Cedar baseline</div>
          <div className="text-[14px] font-semibold text-slate-900 mt-0.5">{dtsEstimate.baseline}d</div>
        </div>
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500">VitalCV est.</div>
          <div className="text-[14px] font-semibold text-slate-900 mt-0.5">{dtsEstimate.p50}d</div>
        </div>
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500">Compression</div>
          <div className="text-[14px] font-semibold text-emerald-700 mt-0.5">−{delta}d ({deltaPct}%)</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-[11.5px] text-slate-600">
        <span>Target start: <span className="text-slate-900 font-medium">{startDateLabel}</span></span>
        <span className="mono text-[10.5px]">Day {daysSinceAccept} of activation</span>
      </div>
    </div>
  );
}

/* ---------- Privilege Tracker ---------- */
function PrivilegeTracker({ privileges }) {
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Stethoscope size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Clinical Privileges · Cedar Surgical Pavilion</span>
        </div>
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 inline-flex items-center gap-2">
          <Icon.Book size={11} />
          Bylaws §IV · FPPE Plan v2.4
        </div>
      </div>

      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/30">
            <th className="text-left mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium px-5 py-2.5">Privilege</th>
            <th className="text-left mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium py-2.5">Status</th>
            <th className="text-left mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium py-2.5">Proctoring / Requirement</th>
            <th className="text-left mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium py-2.5">Authority</th>
            <th className="text-right mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium px-5 py-2.5">Next</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {privileges.map(p => {
            const meta = PRIV_STATUS_META[p.status];
            const pct = p.counter ? Math.round((p.counter.current / p.counter.required) * 100) : 0;
            return (
              <tr key={p.id} className="lane-row align-top">
                <td className="px-5 py-3">
                  <div className="text-[13px] font-medium text-slate-900">{p.name}</div>
                  <div className="mono text-[10.5px] text-slate-500 mt-0.5">{p.category}</div>
                </td>
                <td className="py-3">
                  <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] ring-1 ring-inset text-[11px] font-medium uppercase tracking-[0.06em]', meta.cls)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                    {meta.label}
                  </span>
                </td>
                <td className="py-3 max-w-[280px]">
                  {p.counter && (
                    <div className="mb-1.5">
                      <div className="flex items-center justify-between mono text-[10.5px] text-slate-500 mb-1">
                        <span>{p.counter.unit}</span>
                        <span className="text-slate-900 tabular-nums">{p.counter.current}/{p.counter.required}</span>
                      </div>
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full', p.status === 'granted' ? 'bg-emerald-600' : p.status === 'denied' ? 'bg-slate-300' : 'bg-amber-500')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="text-[11.5px] text-slate-600 leading-[1.5]">{p.note}</div>
                </td>
                <td className="py-3 text-[11.5px] text-slate-600">
                  <div className="text-slate-900">{p.proctor || '—'}</div>
                  <div className="mono text-[10.5px] text-slate-500 mt-0.5">{p.bylaws}</div>
                  <div className="mono text-[10.5px] text-slate-500">{p.fppe}</div>
                </td>
                <td className="px-5 py-3 text-right mono text-[11px] text-slate-700 tabular-nums">
                  {p.nextProctored || (p.grantedAt ? `Granted ${p.grantedAt}` : '—')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Payer Enrollment Matrix ---------- */
function PayerMatrix({ payers }) {
  const grouped = {
    Federal: payers.filter(p => p.kind === 'Federal'),
    State: payers.filter(p => p.kind === 'State'),
    Commercial: payers.filter(p => p.kind === 'Commercial'),
  };

  const completed = payers.filter(p => p.status === 'enrolled').length;
  const inFlight = payers.filter(p => ['submitted', 'waiting_carrier', 'preparing'].includes(p.status)).length;
  const blocked = payers.filter(p => p.status === 'rejected').length;

  return (
    <div className="border border-slate-200 rounded-[3px] bg-white overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.CreditCard size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Payer Enrollment</span>
          <span className="mono text-[10.5px] text-slate-500">· {completed}/{payers.length} effective</span>
        </div>
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 flex items-center gap-3">
          <span><span className="h-1.5 w-1.5 rounded-full bg-emerald-600 inline-block mr-1.5 align-middle" />{completed} effective</span>
          <span><span className="h-1.5 w-1.5 rounded-full bg-indigo-500 inline-block mr-1.5 align-middle" />{inFlight} in flight</span>
          {blocked > 0 && <span><span className="h-1.5 w-1.5 rounded-full bg-rose-500 inline-block mr-1.5 align-middle" />{blocked} blocked</span>}
        </div>
      </div>

      {Object.entries(grouped).map(([kind, list]) => list.length > 0 && (
        <div key={kind}>
          <div className="px-5 py-1.5 border-b border-slate-100 bg-slate-50/30 mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
            {kind} · {list.length}
          </div>
          <div className="divide-y divide-slate-100">
            {list.map(p => {
              const meta = PAYER_STATUS_META[p.status];
              return (
                <div key={p.id} className="px-5 py-3 grid grid-cols-12 gap-4 items-center lane-row">
                  <div className="col-span-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-slate-900">{p.name}</span>
                      {p.sor && <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-emerald-700 bg-emerald-50 ring-1 ring-emerald-600/20 px-1.5 py-0.5 rounded-[2px]">SOR</span>}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] ring-1 ring-inset text-[10.5px] font-medium uppercase tracking-[0.06em]', meta.cls)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                      {meta.label}
                    </span>
                  </div>
                  <div className="col-span-2 mono text-[10.5px] text-slate-600 tabular-nums">
                    <div className="text-slate-500 uppercase tracking-[0.1em] text-[9.5px]">Submitted</div>
                    <div className="text-slate-900 mt-0.5">{p.submittedAt || '—'}</div>
                  </div>
                  <div className="col-span-2 mono text-[10.5px] text-slate-600 tabular-nums">
                    <div className="text-slate-500 uppercase tracking-[0.1em] text-[9.5px]">Effective</div>
                    <div className="text-slate-900 mt-0.5">{p.effectiveAt || '—'}</div>
                  </div>
                  <div className="col-span-2 mono text-[10.5px] text-slate-600 truncate">
                    <div className="text-slate-500 uppercase tracking-[0.1em] text-[9.5px]">PTAN</div>
                    <div className="text-slate-900 mt-0.5 truncate">{p.ptan}</div>
                  </div>
                  <div className="col-span-12 text-[11.5px] text-slate-600 leading-[1.55] pl-0">
                    {p.note}
                    {p.actionable && (
                      <button className="ml-2 mono text-[10.5px] uppercase tracking-[0.14em] text-rose-700 hover:underline">
                        Resolve →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

window.CriticalPathStrip = CriticalPathStrip;
window.BurnDownCard = BurnDownCard;
window.PrivilegeTracker = PrivilegeTracker;
window.PayerMatrix = PayerMatrix;
