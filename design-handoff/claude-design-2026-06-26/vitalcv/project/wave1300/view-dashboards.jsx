// WAVE 1300 · D4 — /dashboards · DASHBOARD COMPOSER
// Every dashboard is configurable. Pull widgets from the palette, drag to
// reorder, drop what you don't need. Cards, metrics, graphs, alerts and
// activity streams all read live from the active workspace — no two
// organizations need the same dashboard.

function ViewDashboards() {
  const { def, cfg, terms } = useWorkspace();
  const layout = cfg.dashboard;
  const [dragId, setDragId] = React.useState(null);
  const [overId, setOverId] = React.useState(null);

  const setLayout = (next) => Store.patchWs(def.id, w => ({ dashboard: typeof next === 'function' ? next(w.dashboard) : next }));
  const addWidget = (id) => setLayout(l => l.includes(id) ? l : [...l, id]);
  const removeWidget = (id) => setLayout(l => l.filter(w => w !== id));
  const onDrop = (targetId) => {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    setLayout(l => { const from = l.indexOf(dragId), to = l.indexOf(targetId); const c = [...l]; const [m] = c.splice(from, 1); c.splice(to, 0, m); return c; });
    setDragId(null); setOverId(null);
  };

  const palette = Object.values(WIDGETS);

  return (
    <div className="max-w-[1520px] mx-auto px-6 py-7 space-y-6">
      <SurfaceIntro eyebrow="Dashboard Composer · W1300-D4"
        title="Compose the dashboard this workspace needs"
        sub="Add widgets from the palette, drag to reorder, remove what doesn't serve the workforce model. Cards, metrics, graphs, alerts and activity streams read live from this organization — a payer's dashboard and a residency program's share no cards by default."
        right={<div className="hidden md:flex items-center gap-2 mono text-[10px] uppercase tracking-[0.12em] text-slate-500 border border-white/10 rounded-md px-3 py-2"><Icon.Grid size={13} className="accent-text" /> {layout.length} widgets</div>} />

      <div className="grid lg:grid-cols-12 gap-5">
        {/* palette */}
        <div className="lg:col-span-3">
          <div className="lg:sticky lg:top-32">
            <SectionLabel>Widget palette</SectionLabel>
            <div className="space-y-1.5">
              {palette.map(w => {
                const inUse = layout.includes(w.id); const WI = Icon[w.icon] || Icon.Dot;
                return (
                  <button key={w.id} onClick={() => inUse ? removeWidget(w.id) : addWidget(w.id)}
                    className={cn('w-full text-left rounded-lg border p-2.5 transition-colors flex items-center gap-2.5', inUse ? 'border-white/[0.06] bg-white/[0.015] opacity-60' : 'border-white/[0.08] bg-[#141922] hover:border-white/20')}>
                    <span className="h-8 w-8 rounded-lg flex items-center justify-center accent-soft-bg accent-text flex-shrink-0"><WI size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5"><WidgetKindDot kind={w.kind} /><span className="text-[12px] font-medium text-slate-200 truncate">{w.label}</span></span>
                      <span className="block text-[10.5px] text-slate-500 truncate">{w.desc}</span>
                    </span>
                    {inUse ? <Icon.Check size={14} className="accent-text flex-shrink-0" /> : <Icon.Plus size={14} className="text-slate-600 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* live grid */}
        <div className="lg:col-span-9">
          <SectionLabel right={<span className="mono text-[10px] text-slate-600">drag cards to reorder</span>}>{def.short} dashboard · live</SectionLabel>
          {layout.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/12 py-20 text-center text-slate-500 text-[13px]">Empty dashboard — add widgets from the palette.</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 auto-rows-min">
              {layout.map(id => {
                const w = WIDGETS[id]; if (!w) return null;
                return (
                  <div key={id} draggable onDragStart={() => setDragId(id)} onDragEnd={() => { setDragId(null); setOverId(null); }}
                    onDragOver={e => { e.preventDefault(); if (overId !== id) setOverId(id); }} onDrop={() => onDrop(id)}
                    className={cn('group rounded-xl border bg-[#141922] overflow-hidden transition-all', w.span === 2 ? 'sm:col-span-2' : '',
                      dragId === id ? 'opacity-40' : '', overId === id && dragId && dragId !== id ? 'accent-border' : 'border-white/[0.08]')}>
                    <div className="px-4 h-11 flex items-center justify-between border-b border-white/[0.06]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100"><Icon.Grip size={14} /></span>
                        <WidgetKindDot kind={w.kind} />
                        <span className="text-[12px] font-semibold text-slate-200 truncate">{w.label}</span>
                      </div>
                      <button onClick={() => removeWidget(id)} className="text-slate-600 hover:text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity"><Icon.X size={14} /></button>
                    </div>
                    <div className="p-4"><WidgetBody id={id} def={def} cfg={cfg} terms={terms} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Widget bodies — all read from the active workspace ---------- */
function hashN(key, lo, hi) { let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0; return lo + (h % (hi - lo + 1)); }

function WidgetBody({ id, def, cfg, terms }) {
  const stages = cfg.stages;
  if (id === 'pipeline_funnel' || id === 'stage_aging') {
    const aging = id === 'stage_aging';
    return (
      <div className="space-y-2">
        {stages.slice(0, aging ? stages.length : stages.length).map((s, i) => {
          const vol = stageVolume(def.id, i, def.stats.providers);
          const max = stageVolume(def.id, 0, def.stats.providers);
          const over = aging ? hashN(def.id + s.id, 0, Math.round(vol * 0.4)) : 0;
          return (
            <div key={s.id}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11.5px] text-slate-400 truncate">{s.label}</span>
                <span className="mono text-[10.5px] tabular-nums flex-shrink-0" style={{ color: aging && over > 0 ? '#ec7a9b' : 'var(--accent)' }}>{aging ? `${over} past SLA` : vol.toLocaleString()}</span>
              </div>
              <Bar value={aging ? over : vol} max={aging ? Math.round(vol * 0.4) || 1 : max} h={5} color={aging ? '#ec7a9b' : undefined} />
            </div>
          );
        })}
      </div>
    );
  }
  if (id === 'readiness_gauge') {
    const pct = hashN(def.id + 'ready', 71, 94);
    return (
      <div className="flex items-center gap-4">
        <Donut pct={pct} />
        <div>
          <div className="text-[12px] text-slate-400">Aggregate readiness</div>
          <div className="text-[12px] text-slate-500 mt-1">{def.stats.active.toLocaleString()} {terms.providerPl.toLowerCase()} ready to practice</div>
        </div>
      </div>
    );
  }
  if (id === 'time_to_active') {
    const days = hashN(def.id + 'tta', 28, 96);
    return <div><div className="text-[34px] font-semibold tabular-nums accent-text leading-none">{days}<span className="text-[14px] text-slate-500 ml-1">days</span></div><div className="text-[12px] text-slate-500 mt-2">Median, {stages[0].label} → {stages[stages.length - 1].label}</div></div>;
  }
  if (id === 'offers_out') {
    const n = hashN(def.id + 'off', 4, 38);
    return <div><div className="text-[34px] font-semibold tabular-nums leading-none" style={{ color: '#f0a93a' }}>{n}</div><div className="text-[12px] text-slate-500 mt-2">Offers awaiting signature</div></div>;
  }
  if (id === 'source_health') {
    const up = (99 + hashN(def.id + 'sh', 0, 9) / 100).toFixed(2);
    return <div><div className="text-[34px] font-semibold tabular-nums leading-none" style={{ color: '#5ed6a4' }}>{up}%</div><div className="text-[12px] text-slate-500 mt-2 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 blink" />Verifier uptime, 30d</div></div>;
  }
  if (id === 'expiring_creds') {
    const items = [['State license', 12], ['DEA registration', 5], ['Board certification', 3]];
    return <div className="space-y-2">{items.map(([l, n]) => (
      <div key={l} className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-slate-300 flex items-center gap-2"><Icon.AlertTri size={13} className="text-amber-400" />{l}</span>
        <span className="mono text-[11px] text-amber-300 tabular-nums">{hashN(def.id + l, 1, n)}</span>
      </div>
    ))}<div className="mono text-[10px] text-slate-600 pt-1">lapsing within 90 days</div></div>;
  }
  if (id === 'evidence_changes') {
    const acts = ['New publication ingested', 'License verified at source', 'Hospital affiliation updated', 'Board status refreshed'];
    return <div className="space-y-2.5">{acts.slice(0, 4).map((a, i) => (
      <div key={i} className="flex items-start gap-2.5">
        <span className="h-1.5 w-1.5 rounded-full accent-bg mt-1.5 flex-shrink-0" />
        <div className="min-w-0"><div className="text-[12px] text-slate-300 truncate">{a}</div><div className="mono text-[9.5px] text-slate-600">{SAMPLE_NAMES[hashN(def.id + i, 0, SAMPLE_NAMES.length - 1)]} · {hashN(def.id + a, 1, 22)}h ago</div></div>
      </div>
    ))}</div>;
  }
  if (id === 'open_tasks') {
    const tasks = ['Verify primary source', 'Request privileging form', 'Confirm malpractice coverage'];
    return <div className="space-y-2">{tasks.map((t, i) => (
      <label key={i} className="flex items-center gap-2.5 cursor-pointer group/t">
        <span className="h-4 w-4 rounded border border-white/20 group-hover/t:accent-border flex-shrink-0" />
        <span className="text-[12px] text-slate-300">{t}</span>
      </label>
    ))}<div className="mono text-[10px] text-slate-600 pt-1">{hashN(def.id + 'tasks', 6, 24)} assigned to you</div></div>;
  }
  if (id === 'cohort_table') {
    const states = [['Active', '#5ed6a4'], ['In review', '#f0a93a'], ['Readiness', 'var(--accent)'], ['Onboarding', '#c08bf0']];
    return (
      <div className="space-y-1">
        {SAMPLE_NAMES.slice(0, 6).map((n, i) => { const [st, c] = states[hashN(def.id + n, 0, states.length - 1)];
          return (
            <div key={n} className="flex items-center justify-between gap-3 py-1.5 px-1 border-b border-white/[0.04] last:border-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-6 w-6 rounded-full bg-white/[0.06] flex items-center justify-center text-[9px] mono text-slate-400 flex-shrink-0">{n.split(' ').map(p => p[0]).join('')}</span>
                <span className="text-[12px] text-slate-200 truncate">{n}</span>
              </div>
              <span className="mono text-[10px] uppercase tracking-[0.06em] flex-shrink-0" style={{ color: c }}>{st}</span>
            </div>
          );
        })}
      </div>
    );
  }
  return <div className="text-[12px] text-slate-500">Widget</div>;
}

function Donut({ pct }) {
  const r = 26, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return (
    <div className="relative h-[68px] w-[68px] flex-shrink-0">
      <svg viewBox="0 0 68 68" className="h-full w-full -rotate-90">
        <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <circle cx="34" cy="34" r={r} fill="none" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[15px] font-semibold tabular-nums text-slate-100">{pct}%</span>
    </div>
  );
}

window.ViewDashboards = ViewDashboards;
