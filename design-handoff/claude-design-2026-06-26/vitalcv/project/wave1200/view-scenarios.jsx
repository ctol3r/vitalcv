// WAVE 1200 · D4 — /scenarios · Career "What if…" (projected effects across four axes)

const AXES = [
  { key: 'trust',  label: 'Trust',         Icon: Icon.ShieldCheck, color: '#34d895', unit: '/100', cap: 100 },
  { key: 'career', label: 'Career',        Icon: Icon.TrendingUp,  color: '#34d8e8', unit: '/100', cap: 100 },
  { key: 'orgs',   label: 'Organizations', Icon: Icon.Building,    color: '#fbe33a', unit: ' reachable', cap: 20 },
  { key: 'opps',   label: 'Opportunities', Icon: Icon.Target,      color: '#c084fc', unit: ' open', cap: 20 },
];

function ViewScenarios() {
  const [active, setActive] = React.useState(new Set(['s-supervise']));
  const toggle = (id) => setActive(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const chosen = SCENARIOS.filter(s => active.has(s.id));
  const proj = React.useMemo(() => {
    const out = { ...SCENARIO_BASE };
    chosen.forEach(s => AXES.forEach(a => out[a.key] += s.effects[a.key] || 0));
    AXES.forEach(a => out[a.key] = Math.min(a.cap, out[a.key]));
    return out;
  }, [chosen]);

  const unlocks = [...new Set(chosen.flatMap(s => s.unlocks || []))];
  const opens = [...new Set(chosen.flatMap(s => s.opens || []))];
  const adds = chosen.flatMap(s => s.adds.map(a => ({ ...a, from: s.label })));

  // graph: self curated footprint + aspiration targets
  const baseFootprint = React.useMemo(() => ['self', ...(UNIVERSE.adj['self'] || []), 'g-lead', 'g-specialist', 'g-faculty'], []);

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-7 space-y-6">
      <SurfaceIntro eyebrow="Career Scenarios · W1200-D4" title="Simulate the moves before you make them"
        sub="Toggle a what-if and the graph re-reasons in real time. Each move ghosts new nodes into the record and projects its effect across trust, career readiness, organizational reach, and open opportunities. Stack them — effects compound." />

      <div className="grid lg:grid-cols-12 gap-5">
        {/* scenario builder */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">What-if levers</span>
            <span className="mono text-[10px] text-slate-500">{chosen.length} active</span>
          </div>
          {SCENARIOS.map(s => {
            const on = active.has(s.id);
            return (
              <button key={s.id} onClick={() => toggle(s.id)}
                className={cn('w-full text-left rounded-xl border p-3.5 transition-colors flex items-start gap-3',
                  on ? 'border-cyan-400/45 bg-cyan-400/[0.06]' : 'border-white/[0.07] bg-[#141922] hover:border-white/20')}>
                <span className={cn('h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors', on ? 'bg-cyan-400/15 text-cyan-300' : 'bg-white/[0.05] text-slate-400')}>
                  <IconFor name={s.Icon} size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-slate-100">{s.label}</span>
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">{s.cat} · {s.sub}</span>
                  <span className="block text-[11.5px] text-slate-400 mt-1.5 leading-snug text-pretty">{s.note}</span>
                  <span className="flex flex-wrap gap-1.5 mt-2">
                    {AXES.filter(a => s.effects[a.key]).map(a => (
                      <span key={a.key} className="mono text-[9.5px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded" style={{ color: a.color, background: hexA(a.color, 0.12) }}>+{s.effects[a.key]} {a.label}</span>
                    ))}
                  </span>
                </span>
                <span className={cn('h-5 w-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5', on ? 'bg-cyan-400 border-cyan-400 text-slate-950' : 'border-white/20')}>
                  {on && <Icon.Check size={13} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>

        {/* projection */}
        <div className="lg:col-span-7 space-y-4">
          {/* 4 axes */}
          <div className="grid sm:grid-cols-2 gap-3">
            {AXES.map(a => {
              const base = SCENARIO_BASE[a.key], now = proj[a.key], delta = now - base;
              return (
                <Panel key={a.key} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-2 text-[12px] text-slate-300"><a.Icon size={14} style={{ color: a.color }} />{a.label}</span>
                    {delta !== 0 && <span className="mono text-[11px] text-emerald-400">+{delta}</span>}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[30px] font-semibold tabular-nums leading-none" style={{ color: a.color }}>{now}</span>
                    <span className="text-[12px] text-slate-500">{a.unit}</span>
                    {delta !== 0 && <span className="mono text-[11px] text-slate-600 ml-1">from {base}</span>}
                  </div>
                  <div className="mt-3"><Bar value={now} max={a.cap} color={a.color} ghost={base} /></div>
                </Panel>
              );
            })}
          </div>

          {/* unlocks + opens */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Panel className="p-4">
              <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500 mb-2.5 flex items-center gap-1.5"><Icon.Target size={13} className="text-violet-300" />Roles unlocked</div>
              {unlocks.length ? (
                <div className="flex flex-wrap gap-1.5">{unlocks.map(u => <span key={u} className="inline-flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-lg bg-violet-400/[0.08] border border-violet-400/20 text-violet-200"><Icon.Plus size={11} />{u}</span>)}</div>
              ) : <span className="text-[12px] text-slate-600">No active levers — toggle a scenario.</span>}
            </Panel>
            <Panel className="p-4">
              <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500 mb-2.5 flex items-center gap-1.5"><Icon.Building size={13} className="text-yellow-300" />Organizations opened</div>
              {opens.length ? (
                <div className="flex flex-wrap gap-1.5">{opens.map(o => <span key={o} className="inline-flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-lg bg-yellow-400/[0.08] border border-yellow-400/20 text-yellow-100"><Icon.MapPin size={11} />{o}</span>)}</div>
              ) : <span className="text-[12px] text-slate-600">No new employer reach yet.</span>}
            </Panel>
          </div>

          {/* graph + ghost nodes */}
          <Panel className="overflow-hidden">
            <PanelHead icon={Icon.Network} title="Projected footprint" sub="Current record + ghosted additions"
              right={<span className="mono text-[10px] text-cyan-300/80">{adds.length} new node{adds.length === 1 ? '' : 's'}</span>} />
            <UniverseGraph height={260} highlightIds={baseFootprint} fitTo={baseFootprint}
              settings={{ nodeSize: 1.1, linkThickness: 1.1, center: 0.6, repel: 1, linkForce: 0.06, linkDist: 1, labels: true }} />
            {adds.length > 0 && (
              <div className="px-4 py-3 border-t border-white/[0.07] flex flex-wrap gap-2">
                {adds.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 text-[11.5px] px-2 py-1 rounded-lg border border-dashed" style={{ borderColor: hexA(FAM_COLOR[a.family], 0.4), color: FAM_COLOR[a.family], background: hexA(FAM_COLOR[a.family], 0.06) }}>
                    <IconFor name={a.icon} size={12} />{a.label}
                  </span>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

window.ViewScenarios = ViewScenarios;
