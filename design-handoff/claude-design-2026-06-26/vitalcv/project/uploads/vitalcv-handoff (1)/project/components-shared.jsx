// Shared components for Mega Wave: Timeline, Modal, etc.

/* ---------- Application Lifecycle Timeline ---------- */
function LifecycleTimeline({ stages, currentId, waitingOnClinician, waitingLanes = [] }) {
  const currentIdx = stages.findIndex(s => s.id === currentId);
  return (
    <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Activity size={14} className="text-slate-500" />
          <span className="text-[13px] font-semibold text-slate-900">Application lifecycle</span>
        </div>
        <div className="flex items-center gap-3 text-[11.5px] text-slate-500">
          <span>Req <span className="mono text-slate-700">{EMPLOYER.reqId}</span></span>
          <span className="h-3 w-px bg-slate-200" />
          {waitingOnClinician ? (
            <span className="inline-flex items-center gap-1.5 text-amber-800">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 pulse-soft" />
              <span className="mono text-[10.5px] uppercase tracking-[0.12em]">Waiting on clinician</span>
            </span>
          ) : (
            <span className="mono text-[10.5px] uppercase tracking-[0.12em] text-slate-400">Live</span>
          )}
        </div>
      </div>

      <div className="px-5 pt-6 pb-5">
        <div className="relative">
          {/* Connector line */}
          <div className="absolute top-[11px] left-0 right-0 h-px bg-slate-200" />
          <div
            className="absolute top-[11px] left-0 h-px bg-slate-900 transition-all"
            style={{ width: `${(currentIdx / (stages.length - 1)) * 100}%` }}
          />

          <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
            {stages.map((s, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              const pending = i > currentIdx;
              return (
                <li key={s.id} className="flex flex-col items-start pr-4">
                  <div className="flex items-center w-full">
                    <span className={cn(
                      'h-[22px] w-[22px] rounded-full flex items-center justify-center ring-[3px] ring-white z-10',
                      done && 'bg-slate-900 text-white',
                      active && 'bg-slate-900 text-white',
                      pending && 'bg-white border border-slate-300 text-slate-400'
                    )}>
                      {done && <Icon.Check size={11} strokeWidth={3} />}
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      {pending && <span className="mono text-[9px]">{String(i+1).padStart(2,'0')}</span>}
                    </span>
                    {active && waitingOnClinician && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[10px] mono uppercase tracking-[0.1em] text-amber-700">
                        <span className="h-1 w-1 rounded-full bg-amber-500 pulse-soft" />
                        wait
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <div className={cn('text-[12.5px] font-semibold leading-tight',
                      (done || active) ? 'text-slate-900' : 'text-slate-400')}>
                      {s.label}
                    </div>
                    <div className={cn('text-[11px] leading-snug mt-0.5',
                      (done || active) ? 'text-slate-500' : 'text-slate-400')}>
                      {s.sub}
                    </div>
                    {s.at && (done || active) && (
                      <div className="mono text-[10.5px] text-slate-500 mt-1.5">{s.at}</div>
                    )}
                    {!s.at && pending && (
                      <div className="mono text-[10.5px] text-slate-300 mt-1.5">— — — — — —</div>
                    )}
                    {active && waitingOnClinician && (
                      <div className="mt-2 text-[10.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                        Waiting on clinician · {waitingLanes.length} item{waitingLanes.length !== 1 && 's'}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

/* ---------- Modal ---------- */
function Modal({ open, onClose, title, eyebrow, children, footer, width = 'md' }) {
  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  const w = width === 'lg' ? 'max-w-[720px]' : width === 'sm' ? 'max-w-[440px]' : 'max-w-[580px]';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn('relative w-full bg-white border border-slate-200 rounded-md shadow-sm', w)}
           role="dialog" aria-modal="true">
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            {eyebrow && (
              <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1">{eyebrow}</div>
            )}
            <div className="text-[15px] font-semibold text-slate-900 tracking-tightish">{title}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900">
            <Icon.X size={16} />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-md flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Velocity Metrics panel ---------- */
function VelocityMetrics({ saved = 45, estimateLow = 14, estimateHigh = 21, industry = 90 }) {
  // saved represents days. Normalize bars relative to industry.
  const ourPct = Math.max(8, Math.round((estimateHigh / industry) * 100));
  return (
    <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Gauge size={14} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Velocity metrics</span>
        </div>
        <span className="mono text-[10.5px] uppercase tracking-[0.12em] text-slate-400">Time-to-Start Engine</span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-slate-200">
        <div className="p-5">
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">Estimated Time to Start</div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="mono text-[30px] font-semibold text-slate-900 tracking-tightish leading-none">{estimateLow}–{estimateHigh}</span>
            <span className="mono text-[13px] text-slate-500">days</span>
          </div>
          <div className="text-[11.5px] text-slate-500 mt-2">From this packet to first shift on unit.</div>
        </div>
        <div className="p-5">
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">VitalCV Head Start</div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="mono text-[30px] font-semibold tracking-tightish leading-none text-emerald-700">−{saved}</span>
            <span className="mono text-[13px] text-emerald-700/80">days saved</span>
          </div>
          <div className="text-[11.5px] text-slate-500 mt-2">Vs. cold-start credentialing baseline.</div>
        </div>
      </div>

      {/* Bar comparison */}
      <div className="px-5 py-4 border-t border-slate-200 bg-slate-50">
        <div className="mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500 mb-3">Relative to industry median ({industry}d)</div>
        <div className="space-y-2.5">
          <VelBar label="Industry baseline" value={industry} max={industry} mono="90d" tone="slate" />
          <VelBar label="With VitalCV"       value={estimateHigh} max={industry} mono={`${estimateLow}–${estimateHigh}d`} tone="emerald" />
        </div>
      </div>

      {/* Network trust row */}
      <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-md bg-emerald-50 ring-1 ring-inset ring-emerald-600/20 flex items-center justify-center flex-shrink-0">
            <Icon.Network size={14} className="text-emerald-700" />
          </div>
          <div>
            <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">VitalCV Network Trust</div>
            <div className="text-[13.5px] font-semibold text-slate-900 mt-0.5">
              Passport verified across <span className="text-emerald-700">3 partner facilities</span>
            </div>
            <div className="text-[11.5px] text-slate-500 mt-0.5">Source-backed evidence has already survived scrutiny at peer institutions.</div>
          </div>
        </div>
        <div className="flex -space-x-1.5">
          {['SH', 'OR', 'KP'].map((l, i) => (
            <div key={i} className="h-7 w-7 rounded-full bg-white border border-slate-300 flex items-center justify-center mono text-[9.5px] uppercase tracking-[0.1em] text-slate-700" title={`Partner facility ${i + 1}`}>
              {l}
            </div>
          ))}
        </div>
      </div>

      {/* Pilot ROI · economic translation layer */}
      <div className="px-5 py-4 border-t border-slate-200 bg-slate-900 text-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-400">Pilot Value · Economic Translation</div>
          <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500 bg-slate-800 border border-slate-700 rounded px-1.5 py-[1px]">Pilot Tier</span>
        </div>
        <dl className="grid grid-cols-3 gap-px bg-slate-700 border border-slate-700 rounded-sm overflow-hidden">
          <div className="bg-slate-900 px-3 py-2.5">
            <dt className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">Labor_Hours_Saved</dt>
            <dd className="mono text-[15px] font-semibold text-emerald-300 mt-1 tracking-tight">2.5 <span className="text-[10.5px] text-slate-400 font-normal">hrs</span></dd>
          </div>
          <div className="bg-slate-900 px-3 py-2.5">
            <dt className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">Days_to_Start_Accelerated</dt>
            <dd className="mono text-[15px] font-semibold text-emerald-300 mt-1 tracking-tight">14 <span className="text-[10.5px] text-slate-400 font-normal">days</span></dd>
          </div>
          <div className="bg-slate-900 px-3 py-2.5">
            <dt className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">Cost_to_Verify</dt>
            <dd className="mono text-[15px] font-semibold text-slate-100 mt-1 tracking-tight">$50.00</dd>
          </div>
        </dl>
        <div className="mono text-[10px] text-slate-500 mt-2 leading-snug">
          // Projected net savings vs. cold-start credentialing baseline. Per-packet, exclusive of licensure PSV fees.
        </div>
      </div>
    </div>
  );
}

function VelBar({ label, value, max, mono, tone }) {
  const pct = Math.max(6, Math.round((value / max) * 100));
  const fill = tone === 'emerald' ? 'bg-emerald-600' : 'bg-slate-400';
  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px] mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="mono text-slate-700">{mono}</span>
      </div>
      <div className="h-2 rounded-sm bg-slate-200 overflow-hidden">
        <div className={cn('h-full', fill)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

window.LifecycleTimeline = LifecycleTimeline;
window.Modal = Modal;
window.VelocityMetrics = VelocityMetrics;
