// WAVE 1400 · D2 — /queues · INTELLIGENT WORK QUEUES
// Seven operational queues, each derived live from the roster. A queue isn't a
// list — it explains itself: why this work matters (impact), how urgent it is
// (priority band, computed per record), and the recommended next action. Click
// any record to act on it in the Command drawer.

function ViewQueues() {
  const { def, roster, terms } = useWorkspace();
  const queues = buildQueues(def, roster);
  const [activeQ, setActiveQ] = React.useState(null);
  const totalOpen = queues.reduce((a, q) => a + q.count, 0);
  const totalP1 = queues.reduce((a, q) => a + q.p1, 0);

  const sel = queues.find(q => q.id === activeQ) || queues.slice().sort((a, b) => b.p1 - a.p1 || b.count - a.count)[0];

  return (
    <div className="max-w-[1560px] mx-auto px-6 py-7 space-y-6">
      <SurfaceIntro eyebrow="Work Queues · W1400-D2"
        title="The work, sorted by what matters"
        sub={`Every open item across ${def.name}, grouped into operational queues. Each queue states its impact and recommends the next action; each record carries a computed priority. Clear the P1s first.`}
        right={<div className="hidden md:flex items-center gap-4 border border-white/10 rounded-md px-4 py-2.5">
          <Stat label="Open items" value={totalOpen} />
          <span className="h-8 w-px bg-white/10" />
          <Stat label="P1 urgent" value={totalP1} color="#ec7a9b" />
        </div>} />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* queue selector */}
        <div className="space-y-2">
          <SectionLabel>Queues</SectionLabel>
          {queues.map(q => {
            const QI = Icon[q.icon] || Icon.ListChecks; const active = sel && sel.id === q.id;
            return (
              <button key={q.id} onClick={() => setActiveQ(q.id)}
                className={cn('w-full text-left rounded-xl border p-3.5 transition-colors flex items-center gap-3',
                  active ? 'bg-white/[0.05] accent-border' : 'border-white/[0.07] bg-[#141922] hover:border-white/18')}>
                <span className={cn('h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0', active ? 'accent-bg text-slate-950' : 'accent-soft-bg accent-text')}><QI size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold text-slate-100 truncate">{q.label}</div>
                  <div className="text-[10.5px] text-slate-500 truncate mt-0.5"><RoleChip roleId={q.owner} /></div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[15px] font-semibold tabular-nums text-slate-100 leading-none">{q.count}</div>
                  {q.p1 > 0 && <div className="text-[9.5px] mono text-rose-300 mt-1">{q.p1} P1</div>}
                </div>
              </button>
            );
          })}
        </div>

        {/* selected queue detail */}
        {sel && <QueueDetail q={sel} def={def} terms={terms} />}
      </div>
    </div>
  );
}

function QueueDetail({ q, def, terms }) {
  const QI = Icon[q.icon] || Icon.ListChecks;
  const [bulk, setBulk] = React.useState(false);
  return (
    <div className="space-y-5">
      {/* queue explainer */}
      <Panel className="overflow-hidden rise">
        <div className="p-5" style={{ background: `linear-gradient(180deg, var(--accent-glow), transparent 70%)` }}>
          <div className="flex items-start gap-4">
            <span className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 accent-soft-bg accent-text"><QI size={22} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-slate-50">{q.label}</h2>
                <Pill tone="accent">{q.count} open</Pill>
                {q.p1 > 0 && <Pill tone="rose">{q.p1} P1</Pill>}
              </div>
              <p className="text-[12.5px] text-slate-400 mt-1.5 max-w-[70ch] text-pretty">{q.desc}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 mt-5">
            <ExplainCard icon={Icon.ChevronsUp} label="Priority" tone="rose"
              body={`${q.p1} urgent · ${q.count - q.p1} routine. Records are ranked by risk, blockers, SLA breach and readiness.`} />
            <ExplainCard icon={Icon.Target} label="Impact" tone="accent" body={q.impact} />
            <ExplainCard icon={Icon.Wand} label="Recommended action" tone="emerald" body={q.action} />
          </div>
        </div>
      </Panel>

      {/* queue items */}
      <Panel className="overflow-hidden">
        <PanelHead icon={Icon.ListChecks} title={`${q.count} records in this queue`} sub="ordered by priority — highest first"
          right={<Button size="xs" variant={bulk ? 'primary' : 'dark'} iconLeft={<Icon.ListChecks size={12} />} onClick={() => setBulk(b => !b)}>Triage mode</Button>} />
        {q.items.length === 0 && <div className="px-5 py-10 text-center text-[13px] text-slate-500">This queue is clear. Nice work.</div>}
        <div className="divide-y divide-white/[0.05]">
          {q.items.map(p => (
            <div key={p.id} className="px-5 py-3.5 hover:bg-white/[0.02] transition-colors flex items-center gap-4">
              <PriorityTag score={p.score} />
              <div className="min-w-0 flex-1">
                <button onClick={() => window.openRecord(p.id)} className="text-left group">
                  <div className="text-[13px] font-medium text-slate-100 group-hover:accent-text transition-colors truncate">{p.name}</div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">{p.specialty} · {p.group} · {def.stages[p.stageIdx].label}</div>
                </button>
              </div>
              {bulk && (
                <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                  <div className="w-24"><div className="flex items-center justify-between text-[9.5px] text-slate-500 mb-1"><span>readiness</span><span className="mono" style={{ color: p.readiness >= 75 ? '#5ed6a4' : '#f0a93a' }}>{p.readiness}%</span></div><Bar value={p.readiness} color={p.readiness >= 75 ? '#5ed6a4' : '#f0a93a'} h={3} /></div>
                </div>
              )}
              <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                <RiskDot risk={p.risk} />
                <span className="mono text-[10px] text-slate-500 w-16 text-right">{p.score} pts</span>
              </div>
              <Button size="xs" variant="dark" iconRight={<Icon.ArrowRight size={12} />} onClick={() => window.openRecord(p.id)}>Act</Button>
            </div>
          ))}
        </div>
        {q.items.length > 0 && (
          <div className="px-5 py-2.5 border-t border-white/[0.06] flex items-center justify-between mono text-[10px] text-slate-500">
            <span>recommended: {q.action.toLowerCase()}</span>
            <span>{q.items.length} shown</span>
          </div>
        )}
      </Panel>
    </div>
  );
}

function ExplainCard({ icon: I, label, tone, body }) {
  const ring = { rose: 'ring-rose-400/20', accent: 'accent-ring', emerald: 'ring-emerald-400/20' }[tone] || 'ring-white/10';
  const col = { rose: 'text-rose-300', accent: 'accent-text', emerald: 'text-emerald-300' }[tone] || 'text-slate-300';
  return (
    <div className={cn('rounded-lg bg-white/[0.02] ring-1 ring-inset p-3.5', ring)}>
      <div className={cn('flex items-center gap-1.5 mono text-[9.5px] uppercase tracking-[0.14em] mb-1.5', col)}><I size={12} /> {label}</div>
      <div className="text-[11.5px] text-slate-300 leading-snug text-pretty">{body}</div>
    </div>
  );
}

window.ViewQueues = ViewQueues;
