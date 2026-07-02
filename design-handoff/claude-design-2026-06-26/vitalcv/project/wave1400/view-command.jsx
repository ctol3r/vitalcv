// WAVE 1400 · D3 — /command · COMMAND CENTER (the operational workspace)
// Where work actually gets done. Open any record and you can assign it, resolve
// its blockers, approve its evidence, escalate it, or advance it down the
// pipeline. Every one of those actions calls into Ops.* which mutates the
// record AND writes an immutable event — the same events the Timeline replays.
// The drawer is global: any surface can call window.openRecord(id).

/* ---------- tiny external store for the drawer + acting operator ---------- */
const Drawer = {
  pid: null, actor: 'u1', listeners: new Set(),
  sub(fn) { Drawer.listeners.add(fn); return () => Drawer.listeners.delete(fn); },
  snap() { return Drawer; },
  open(pid) { Drawer.pid = pid; Drawer.emit(); },
  close() { Drawer.pid = null; Drawer.emit(); },
  setActor(id) { Drawer.actor = id; Drawer.emit(); },
  emit() { Drawer._v = (Drawer._v || 0) + 1; Drawer.listeners.forEach(f => f()); },
  _v: 0,
};
window.openRecord = (pid) => Drawer.open(pid);
function useDrawer() { React.useSyncExternalStore(Drawer.sub, () => Drawer._v); return Drawer; }

/* ======================= THE RECORD DRAWER ======================= */
function RecordDrawer() {
  const d = useDrawer();
  const { def, roster, events } = useWorkspace();
  const p = roster.find(x => x.id === d.pid);
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') Drawer.close(); };
    if (d.pid) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [d.pid]);
  if (!d.pid || !p) return null;

  const stage = def.stages[p.stageIdx];
  const isLast = p.stageIdx === def.stages.length - 1;
  const recEvents = events.filter(e => e.subjectId === p.id).slice(0, 8);
  const act = (fn) => fn();

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={() => Drawer.close()} />
      <div className="relative w-full max-w-[480px] bg-[#0e131b] border-l border-white/10 h-full overflow-y-auto scroll-thin shadow-2xl" style={{ animation: 'slideIn .28s cubic-bezier(.2,.7,.2,1)' }}>
        {/* header */}
        <div className="sticky top-0 z-10 bg-[#0e131b]/95 backdrop-blur border-b border-white/[0.07] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <RiskDot risk={p.risk} size={9} />
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-slate-50 truncate">{p.name}</div>
                <div className="text-[11px] text-slate-500 truncate">{p.specialty} · {p.group} · NPI {p.npi}</div>
              </div>
            </div>
            <button onClick={() => Drawer.close()} className="text-slate-500 hover:text-white transition-colors flex-shrink-0"><Icon.X size={18} /></button>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Pill tone={p.risk === 'high' ? 'rose' : p.risk === 'med' ? 'amber' : 'emerald'}>{RISK[p.risk].label} risk</Pill>
            <Pill tone="accent">{stage.label}</Pill>
            {p.overdue && <Pill tone="amber">{p.daysInStage - p.sla}d past SLA</Pill>}
            {p.flagged && <Pill tone="rose">escalated</Pill>}
            {p.isActive && p.licenseDays != null && p.licenseDays <= 90 && <Pill tone="amber">license {p.licenseDays}d</Pill>}
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* readiness + stage progress */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="mono uppercase tracking-[0.12em] text-slate-500">Credential readiness</span>
              <span className="mono tabular-nums font-semibold" style={{ color: p.readiness >= 75 ? '#5ed6a4' : '#f0a93a' }}>{p.readiness}%</span>
            </div>
            <Bar value={p.readiness} color={p.readiness >= 75 ? '#5ed6a4' : p.readiness >= 50 ? '#f0a93a' : '#ec7a9b'} h={6} />
            <div className="flex items-center gap-1 mt-3 overflow-x-auto scroll-thin">
              {def.stages.map((s, i) => (
                <React.Fragment key={s.id}>
                  <div className={cn('flex-shrink-0 h-1.5 rounded-full transition-colors', i < p.stageIdx ? 'accent-bg' : i === p.stageIdx ? 'bg-white' : 'bg-white/10')} style={{ width: i === p.stageIdx ? 22 : 14 }} title={s.label} />
                </React.Fragment>
              ))}
            </div>
            <div className="mono text-[9.5px] text-slate-600 mt-1.5">stage {p.stageIdx + 1} of {def.stages.length} · {stage.label}</div>
          </div>

          {/* primary actions */}
          <div>
            <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">Actions — each writes an event</div>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="primary" iconLeft={<Icon.CheckCircle size={14} />} onClick={() => act(() => Ops.approveEvidence(p, Drawer.actor))} disabled={isLast}>Approve evidence</Button>
              <Button size="sm" variant="dark" iconLeft={<Icon.ArrowRight size={14} />} onClick={() => act(() => Ops.advanceStage(p, def, Drawer.actor))} disabled={isLast}>{isLast ? 'Active' : 'Advance stage'}</Button>
              <Button size="sm" variant="dark" iconLeft={<Icon.ChevronsUp size={14} />} onClick={() => act(() => Ops.escalate(p, Drawer.actor))} disabled={p.flagged}>{p.flagged ? 'Escalated' : 'Escalate'}</Button>
              <Button size="sm" variant="dark" iconLeft={<Icon.Bell size={14} />} onClick={() => act(() => Store.log({ type: 'org_notified', actor: Drawer.actor, subjectId: p.id, subject: p.name, group: p.group, detail: `${def.short} notified of current status` }))}>Notify org</Button>
            </div>
          </div>

          {/* blockers */}
          <div>
            <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">Blockers ({p.blockers.length})</div>
            {p.blockers.length === 0 ? (
              <div className="rounded-lg bg-emerald-500/8 ring-1 ring-inset ring-emerald-400/20 px-3.5 py-2.5 text-[11.5px] text-emerald-300 flex items-center gap-2"><Icon.CheckCircle size={14} /> No active blockers on this record.</div>
            ) : (
              <div className="space-y-2">
                {p.blockers.map(bid => {
                  const b = BLOCKERS.find(x => x.id === bid) || { label: bid, sev: 'med' };
                  return (
                    <div key={bid} className="flex items-center gap-2.5 rounded-lg bg-white/[0.03] border border-white/[0.07] px-3 py-2">
                      <RiskDot risk={b.sev === 'high' ? 'high' : b.sev === 'med' ? 'med' : 'low'} size={6} />
                      <span className="text-[11.5px] text-slate-300 flex-1 min-w-0 truncate">{b.label}</span>
                      <Button size="xs" variant="emerald" iconLeft={<Icon.Unlock size={11} />} onClick={() => Ops.resolveBlocker(p, bid, Drawer.actor)}>Resolve</Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* assignment */}
          <div>
            <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">Assigned to</div>
            <div className="flex flex-wrap gap-1.5">
              {TEAM.filter(t => t.role === stage.owner || t.role === 'cmo').slice(0, 5).map(u => (
                <button key={u.id} onClick={() => Ops.assignWork(p, u.id, Drawer.actor)}
                  className={cn('flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 border transition-colors', p.assignee === u.id ? 'accent-border bg-white/[0.05]' : 'border-white/10 hover:border-white/25')}>
                  <Avatar userId={u.id} size={18} />
                  <span className="text-[11px] text-slate-300">{u.name.split(' ')[0]}</span>
                  {p.assignee === u.id && <Icon.Check size={11} className="accent-text" />}
                </button>
              ))}
            </div>
          </div>

          {/* record event history */}
          <div>
            <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">Record history</div>
            <div className="space-y-0">
              {recEvents.length === 0 && <div className="text-[11.5px] text-slate-500">No events yet for this record.</div>}
              {recEvents.map((e, i) => {
                const ET = EVENT_TYPES[e.type] || {}; const EI = Icon[ET.icon] || Icon.Dot;
                return (
                  <div key={e.id} className="flex gap-2.5 pb-3 last:pb-0">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <span className="h-5 w-5 rounded-full flex items-center justify-center accent-soft-bg accent-text"><EI size={11} /></span>
                      {i < recEvents.length - 1 && <span className="w-px flex-1 bg-white/10 my-0.5" />}
                    </div>
                    <div className="min-w-0 pb-1 -mt-0.5">
                      <div className="text-[11.5px] text-slate-200 leading-snug">{ET.label || e.type}</div>
                      <div className="text-[10px] text-slate-500 mono">{e.detail} · {timeAgo(e.ts)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* footer — acting operator */}
        <div className="sticky bottom-0 bg-[#0e131b]/95 backdrop-blur border-t border-white/[0.07] px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Avatar userId={Drawer.actor} size={20} /> acting as <span className="text-slate-300">{(TEAM.find(t => t.id === Drawer.actor) || {}).name}</span>
          </div>
          <button onClick={() => Drawer.close()} className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500 hover:text-white transition-colors">close · esc</button>
        </div>
      </div>
    </div>
  );
}
window.RecordDrawer = RecordDrawer;

/* ======================= THE COMMAND SURFACE ======================= */
function ViewCommand() {
  const d = useDrawer();
  const { def, roster, terms } = useWorkspace();
  const [stageF, setStageF] = React.useState('all');
  const [riskF, setRiskF] = React.useState('all');
  const [q, setQ] = React.useState('');
  const [sort, setSort] = React.useState('priority');

  let rows = roster.map(p => ({ ...p, score: priorityScore(p) }));
  if (stageF !== 'all') rows = rows.filter(p => String(p.stageIdx) === stageF);
  if (riskF !== 'all') rows = rows.filter(p => p.risk === riskF);
  if (q.trim()) { const t = q.toLowerCase(); rows = rows.filter(p => p.name.toLowerCase().includes(t) || p.specialty.toLowerCase().includes(t) || p.group.toLowerCase().includes(t)); }
  rows.sort((a, b) => sort === 'priority' ? b.score - a.score : sort === 'readiness' ? a.readiness - b.readiness : a.name.localeCompare(b.name));

  const mine = roster.filter(p => p.assignee === Drawer.actor).map(p => ({ ...p, score: priorityScore(p) })).sort((a, b) => b.score - a.score);

  return (
    <div className="max-w-[1560px] mx-auto px-6 py-7 space-y-6">
      <SurfaceIntro eyebrow="Command Center · W1400-D3"
        title="One workspace. Assign, resolve, approve, escalate."
        sub="Every record in one operational table. Filter to what you own, open any record, and act — each action advances the record and writes an immutable event to the ledger. This is the layer where Professional Trust becomes daily work."
        right={<OperatorPicker />} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* main table */}
        <Panel className="overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.07] flex items-center gap-2.5 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Icon.Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${terms.providerPl.toLowerCase()}…`}
                className="w-full h-8 pl-8 pr-3 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-md text-[12px] text-slate-100 outline-none placeholder:text-slate-600" />
            </div>
            <Select value={stageF} onChange={setStageF} options={[['all', 'All stages'], ...def.stages.map((s, i) => [String(i), s.label])]} />
            <Select value={riskF} onChange={setRiskF} options={[['all', 'All risk'], ['high', 'High risk'], ['med', 'Medium'], ['low', 'Low']]} />
            <Select value={sort} onChange={setSort} options={[['priority', 'Sort: priority'], ['readiness', 'Sort: readiness'], ['name', 'Sort: name']]} />
          </div>
          <div className="px-4 py-2 border-b border-white/[0.05] grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center mono text-[9px] uppercase tracking-[0.12em] text-slate-600">
            <span className="w-8">Pri</span><span>Record</span><span className="hidden sm:block w-28">Stage</span><span className="hidden md:block w-24">Readiness</span><span className="w-16 text-right">Owner</span>
          </div>
          <div className="max-h-[620px] overflow-y-auto scroll-thin divide-y divide-white/[0.04]">
            {rows.map(p => (
              <button key={p.id} onClick={() => Drawer.open(p.id)}
                className={cn('w-full px-4 py-2.5 grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center text-left hover:bg-white/[0.03] transition-colors', d.pid === p.id && 'bg-white/[0.04]')}>
                <span className="w-8"><PriorityTag score={p.score} /></span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 min-w-0"><RiskDot risk={p.risk} /><span className="text-[12.5px] font-medium text-slate-100 truncate">{p.name}</span>{p.flagged && <Icon.Flag size={11} className="text-rose-400 flex-shrink-0" />}</span>
                  <span className="block text-[10px] text-slate-500 truncate mt-0.5 pl-4">{p.specialty} · {p.group}{p.blockers.length > 0 && <span className="text-rose-400/80"> · {p.blockers.length} blocker{p.blockers.length > 1 ? 's' : ''}</span>}</span>
                </span>
                <span className="hidden sm:block w-28 mono text-[10.5px] text-slate-400 truncate">{def.stages[p.stageIdx].label}</span>
                <span className="hidden md:block w-24"><div className="flex items-center justify-between text-[9.5px] mb-1"><span className="mono" style={{ color: p.readiness >= 75 ? '#5ed6a4' : '#f0a93a' }}>{p.readiness}%</span></div><Bar value={p.readiness} color={p.readiness >= 75 ? '#5ed6a4' : '#f0a93a'} h={3} /></span>
                <span className="w-16 flex justify-end"><Avatar userId={p.assignee} size={22} /></span>
              </button>
            ))}
            {rows.length === 0 && <div className="px-4 py-12 text-center text-[13px] text-slate-500">No records match.</div>}
          </div>
          <div className="px-4 py-2.5 border-t border-white/[0.06] mono text-[10px] text-slate-500 flex items-center justify-between">
            <span>{rows.length} of {roster.length} records</span>
            <span className="flex items-center gap-1.5"><Icon.Command size={11} /> click a row to open the command drawer</span>
          </div>
        </Panel>

        {/* my work + quick reference */}
        <div className="space-y-6">
          <Panel className="overflow-hidden">
            <PanelHead icon={Icon.ListChecks} title="Your assigned work" sub={`${mine.length} records · ${(TEAM.find(t => t.id === Drawer.actor) || {}).name}`} />
            <div className="max-h-[300px] overflow-y-auto scroll-thin divide-y divide-white/[0.05]">
              {mine.length === 0 && <div className="px-4 py-6 text-center text-[12px] text-slate-500">Nothing assigned to you. Assign work from any record.</div>}
              {mine.map(p => (
                <button key={p.id} onClick={() => Drawer.open(p.id)} className="w-full px-4 py-2.5 flex items-center gap-2.5 text-left hover:bg-white/[0.03] transition-colors">
                  <PriorityTag score={p.score} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-medium text-slate-100 truncate">{p.name}</span>
                    <span className="block text-[10px] text-slate-500 truncate">{def.stages[p.stageIdx].label}</span>
                  </span>
                  <Icon.ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
                </button>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHead icon={Icon.GitCommit} title="How the ledger works" />
            <div className="p-4 space-y-2.5 text-[11.5px] text-slate-400 leading-snug">
              {[
                ['CheckCircle', 'Approving evidence', 'lifts readiness and records who conferred it.'],
                ['Unlock', 'Resolving a blocker', 'clears the gate and recomputes risk.'],
                ['ArrowRight', 'Advancing a stage', 'moves the record and resets its SLA clock.'],
                ['ChevronsUp', 'Escalating', 'flags for leadership and notifies the org.'],
              ].map(([ic, b, t]) => {
                const I = Icon[ic] || Icon.Dot;
                return (
                  <div key={b} className="flex items-start gap-2.5">
                    <span className="h-5 w-5 rounded flex items-center justify-center accent-soft-bg accent-text flex-shrink-0 mt-0.5"><I size={11} /></span>
                    <span className="text-pretty"><span className="text-slate-200 font-medium">{b}</span> {t}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none h-8 pl-2.5 pr-7 bg-white/[0.04] border border-white/10 hover:border-white/20 focus:border-white/30 rounded-md text-[11.5px] text-slate-200 outline-none cursor-pointer">
        {options.map(([v, l]) => <option key={v} value={v} className="bg-[#141922]">{l}</option>)}
      </select>
      <Icon.ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
    </div>
  );
}

function OperatorPicker() {
  const d = useDrawer();
  return (
    <div className="hidden md:flex items-center gap-2 border border-white/10 rounded-md pl-2.5 pr-2 py-2">
      <span className="mono text-[9.5px] uppercase tracking-[0.12em] text-slate-500">Acting as</span>
      <div className="relative">
        <select value={d.actor} onChange={e => Drawer.setActor(e.target.value)}
          className="appearance-none bg-transparent pr-5 text-[12px] font-medium text-slate-100 outline-none cursor-pointer">
          {TEAM.map(u => <option key={u.id} value={u.id} className="bg-[#141922]">{u.name} · {(ROLES[u.role] || {}).short}</option>)}
        </select>
        <Icon.ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
      </div>
    </div>
  );
}

window.ViewCommand = ViewCommand;
window.useDrawer = useDrawer; window.Drawer = Drawer;
