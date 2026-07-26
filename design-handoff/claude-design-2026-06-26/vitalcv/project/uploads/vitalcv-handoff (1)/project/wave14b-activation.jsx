// WAVE 14b · Onboarding tasks + Handoff timeline + main view

/* ---------- Onboarding Task List ---------- */
function OnboardingTasks({ tasks }) {
  const done = tasks.filter(t => t.state === 'done').length;
  const total = tasks.length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="border border-slate-200 rounded-[3px] bg-white overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.ClipboardCheck size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Onboarding · Cleared-to-Schedule track</span>
        </div>
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 tabular-nums">
          {done}/{total} complete · {pct}%
        </div>
      </div>

      <div className="px-5 pt-3">
        <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-slate-900 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ul className="divide-y divide-slate-100">
        {tasks.map(t => {
          const meta = ONBOARD_STATUS_META[t.state];
          return (
            <li key={t.id} className="px-5 py-3 grid grid-cols-12 gap-4 items-center lane-row">
              <div className="col-span-1">
                <span className={cn('inline-flex h-5 w-5 rounded-full items-center justify-center', t.state === 'done' ? 'bg-emerald-600' : t.state === 'in_progress' ? 'bg-amber-50 ring-1 ring-amber-300' : 'bg-slate-100')}>
                  {t.state === 'done' && <Icon.Check size={11} className="text-white" strokeWidth={3} />}
                  {t.state === 'in_progress' && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 pulse-soft" />}
                </span>
              </div>
              <div className="col-span-5">
                <div className="text-[13px] font-medium text-slate-900">{t.label}</div>
                <div className="mono text-[10.5px] text-slate-500 mt-0.5">{t.standard}</div>
              </div>
              <div className="col-span-2 mono text-[10.5px] text-slate-600">
                <div className="text-slate-500 uppercase tracking-[0.1em] text-[9.5px]">Owner</div>
                <div className="text-slate-900 mt-0.5">{t.owner}</div>
              </div>
              <div className="col-span-2">
                <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] ring-1 ring-inset text-[10.5px] font-medium uppercase tracking-[0.06em]', meta.cls)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                  {meta.label}
                </span>
                {t.subprogress && (
                  <div className="mono text-[10px] text-slate-500 mt-1 tabular-nums">{t.subprogress.collected}/{t.subprogress.required} collected</div>
                )}
              </div>
              <div className="col-span-2 text-right mono text-[10.5px] text-slate-600 tabular-nums">
                <div className="text-slate-500 uppercase tracking-[0.1em] text-[9.5px]">{t.state === 'done' ? 'Completed' : 'Due'}</div>
                <div className="text-slate-900 mt-0.5">{t.completedAt || t.dueAt}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Handoff Timeline ---------- */
function HandoffTimeline({ handoffs }) {
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.GitBranch size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Chain of Custody · Owner Handoffs</span>
        </div>
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          Tamper-evident · VC 2.0 receipts
        </div>
      </div>
      <div className="px-5 py-4 space-y-3">
        {handoffs.map((h, i) => (
          <div key={i} className={cn('grid grid-cols-12 gap-4 py-2 border-l-2 pl-4', h.isCurrent ? 'border-emerald-500' : 'border-slate-200')}>
            <div className="col-span-3">
              <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">From</div>
              <div className="text-[12.5px] font-medium text-slate-900 mt-0.5">{h.from.name}</div>
              <div className="text-[11px] text-slate-600">{h.from.role}</div>
            </div>
            <div className="col-span-1 flex items-center justify-center">
              <Icon.ArrowRight size={14} className="text-slate-400" />
            </div>
            <div className="col-span-3">
              <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">To</div>
              <div className="text-[12.5px] font-medium text-slate-900 mt-0.5 inline-flex items-center gap-1.5">
                {h.to.name}
                {h.isCurrent && <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-emerald-700 bg-emerald-50 ring-1 ring-emerald-600/20 px-1.5 py-0.5 rounded-[2px]">current</span>}
              </div>
              <div className="text-[11px] text-slate-600">{h.to.role}</div>
            </div>
            <div className="col-span-3">
              <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">Artifact</div>
              <div className="text-[11.5px] text-slate-700 mt-0.5">{h.artifact}</div>
            </div>
            <div className="col-span-2 text-right">
              <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">Receipt</div>
              <div className="mono text-[10.5px] text-slate-900 mt-0.5 truncate">{h.receipt}</div>
              <div className="mono text-[10px] text-slate-500 mt-0.5">{h.at.split(' ')[0]}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.OnboardingTasks = OnboardingTasks;
window.HandoffTimeline = HandoffTimeline;
