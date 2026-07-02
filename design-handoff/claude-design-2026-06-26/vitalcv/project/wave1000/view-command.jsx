// SURFACE — /command/:id — CAREER COMMAND CENTER (Wave 1000)
// One unified workspace. Evidence · Timeline · Trust · Growth · Mobility · Organizations
// are connected modules inside a single operating system, not separate pages.

const MODULES = [
  { id: 'evidence',      label: 'Evidence',      Icon: Icon.FileText,    desc: 'the facts you hold' },
  { id: 'timeline',      label: 'Timeline',      Icon: Icon.Book,        desc: 'when they happened' },
  { id: 'trust',         label: 'Trust',         Icon: Icon.ShieldCheck, desc: 'belief in the facts' },
  { id: 'growth',        label: 'Growth',        Icon: Icon.TrendingUp,  desc: 'goals in motion' },
  { id: 'mobility',      label: 'Mobility',      Icon: Icon.Route,       desc: 'where it can go' },
  { id: 'organizations', label: 'Organizations', Icon: Icon.Building,    desc: 'who you serve' },
];

/* ---------- Module: Evidence ---------- */
function ModEvidence() {
  return (
    <div className="space-y-4">
      <ModHead title="Evidence" sub="The owned EvidenceCollection — every sourced fact and the authority that backs it." count={`${EVIDENCE_SOURCES.length} feeds · ${EVENTS.length} facts`} />
      <div className="grid sm:grid-cols-2 gap-3">
        {EVIDENCE_SOURCES.map(s => (
          <div key={s.id} className="border border-slate-200 rounded-lg bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-slate-900">{s.label}</div>
                <div className="text-[11.5px] text-slate-500 mt-0.5">{s.authority}</div>
              </div>
              <Chip state={s.state} size="sm" />
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="mono text-slate-400 uppercase tracking-[0.1em]">{s.tier} · {s.count} facts</span>
              <span className="text-slate-500">last read <span className="mono">{s.last}</span></span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {s.feeds.map(f => <span key={f} className="mono text-[9px] uppercase tracking-[0.06em] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{DIM[f].label}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Module: Timeline ---------- */
function ModTimeline() {
  const ordered = [...EVENTS].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div className="space-y-4">
      <ModHead title="Timeline" sub="The TimelineProjection — every event in order, each one moving a dimension." count={`${EVENTS.length} events`} />
      <div className="border border-slate-200 rounded-lg bg-white p-5">
        {ordered.map((e, i) => {
          const dir = { up: { s: '▲', c: 'text-emerald-600' }, floor: { s: '▣', c: 'text-slate-900' }, down: { s: '▼', c: 'text-rose-600' } }[e.dir];
          return (
            <div key={e.id} className="relative pl-8 pb-4 last:pb-0">
              {i < ordered.length - 1 && <span className="absolute left-[9px] top-5 bottom-0 w-px bg-slate-200" />}
              <span className={cn('absolute left-1 top-1.5 h-4 w-4 rounded-full ring-2 ring-white flex items-center justify-center', e.state === 'adverse' ? 'bg-rose-500' : e.dir === 'floor' ? 'bg-slate-900' : 'bg-white border-2 border-slate-900')} />
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="mono text-[10px] text-slate-400 tabular-nums w-12 flex-shrink-0">{e.date}</span>
                <span className="text-[12.5px] font-medium text-slate-900">{e.title}</span>
                {dir && <span className={cn('mono text-[10px]', dir.c)}>{dir.s} {e.dims.map(d => DIM[d].label).join(' · ')}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Module: Trust ---------- */
function ModTrust() {
  const toneMap = { ok: 'bg-emerald-500', warn: 'bg-amber-500', info: 'bg-indigo-500', muted: 'bg-slate-300' };
  return (
    <div className="space-y-4">
      <ModHead title="Trust" sub="The TrustProjection — belief computed per dimension, decaying and refreshing." count={`index ${CAREER_STATE.trustScore}/100`} />
      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-6 border border-slate-200 rounded-lg bg-white p-5">
          <Eyebrow className="mb-3">Dimensions vs. field median</Eyebrow>
          <div className="space-y-2.5">
            {DIMENSIONS.map(d => (
              <div key={d.key} className="flex items-center gap-2.5">
                <span className="text-[11.5px] text-slate-600 w-[84px] flex-shrink-0">{d.label}</span>
                <Bar value={d.value} median={d.median} />
                <span className="mono text-[10px] text-slate-400 tabular-nums w-5 text-right flex-shrink-0">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-6 border border-slate-200 rounded-lg bg-white overflow-hidden">
          <CardHead icon={Icon.Activity} title="Recent re-reads" right={<Eyebrow>audit trail</Eyebrow>} />
          <div className="divide-y divide-slate-100">
            {TRUST_HISTORY.slice(0, 5).map((h, i) => (
              <div key={i} className="px-4 py-2.5 flex items-start gap-2.5">
                <span className={cn('h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0', toneMap[h.tone])} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="text-[11.5px] font-medium text-slate-900">{h.source}</span><span className="mono text-[9.5px] text-slate-400 ml-auto">{h.t.slice(0, 10)}</span></div>
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{h.msg}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Module: Growth ---------- */
function ModGrowth() {
  return (
    <div className="space-y-4">
      <ModHead title="Growth" sub="Active goals and the next moves that advance them — leverage, ranked." count={`${GOALS.length} goals`} />
      <div className="grid lg:grid-cols-2 gap-3">
        {GOALS.map(g => (
          <div key={g.id} className="border border-slate-200 rounded-lg bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[13px] font-semibold text-slate-900 leading-snug pr-2">{g.title}</div>
              <div className="text-[18px] font-semibold text-slate-900 tabular-nums leading-none flex-shrink-0">{g.progress}<span className="text-[12px] text-slate-400">%</span></div>
            </div>
            <div className="mt-2 mono text-[10px] uppercase tracking-[0.1em] text-slate-400">{g.horizon}</div>
            <div className="mt-3"><Bar value={g.progress} h="h-1.5" /></div>
            <div className="mt-3 space-y-1.5">
              {g.steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-[11.5px]">
                  <span className={cn('h-4 w-4 rounded flex items-center justify-center flex-shrink-0', s.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400')}>{s.done ? <Icon.Check size={11} /> : <Icon.Dot size={8} />}</span>
                  <span className={s.done ? 'text-slate-700' : 'text-slate-500'}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Module: Mobility ---------- */
function ModMobility() {
  return (
    <div className="space-y-4">
      <ModHead title="Mobility" sub="The GraphProjection — what the verified record unlocks now and projects toward." count={`readiness ${READINESS.score}`} />
      <div className="grid lg:grid-cols-3 gap-3">
        {[...ADVANCEMENT_PATHS].sort((a, b) => b.match - a.match).map(p => (
          <div key={p.id} className="border border-slate-200 rounded-lg bg-white p-4 flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[13px] font-semibold text-slate-900 leading-tight">{p.title}</div>
              <span className="mono text-[13px] text-slate-900 tabular-nums flex-shrink-0">{p.match}%</span>
            </div>
            <div className="mt-2"><Bar value={p.match} h="h-1.5" /></div>
            <div className="mono text-[9px] uppercase tracking-[0.1em] text-slate-400 mt-1.5">{p.horizon}</div>
            <p className="text-[11.5px] text-slate-600 leading-snug mt-2.5">{p.summary}</p>
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="text-[10px] text-slate-400 mb-1 mono uppercase tracking-[0.1em]">still needs</div>
              <ul className="space-y-1">{p.need.map((n, i) => <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600"><Icon.Plus size={11} className="text-slate-400 mt-0.5 flex-shrink-0" />{n}</li>)}</ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Module: Organizations ---------- */
function ModOrgs() {
  return (
    <div className="space-y-4">
      <ModHead title="Organizations" sub="Every institution the career touches — employer, training, academic, society." count={`${ORGANIZATIONS.length} affiliations`} />
      <div className="grid sm:grid-cols-2 gap-3">
        {ORGANIZATIONS.map(o => (
          <div key={o.id} className="border border-slate-200 rounded-lg bg-white p-4 flex items-start gap-3">
            <div className="h-11 w-11 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0"><IconFor name={o.icon} size={18} className="text-slate-700" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="text-[13px] font-semibold text-slate-900 leading-tight">{o.name}</span>{o.status === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}</div>
              <div className="text-[11.5px] text-slate-500 mt-0.5">{o.role}</div>
              <p className="text-[11px] text-slate-500 mt-1.5">{o.detail}</p>
              <div className="mt-2 flex items-center gap-2 mono text-[9.5px] uppercase tracking-[0.1em] text-slate-400"><span>{o.kind}</span><span>·</span><span>{Math.round(o.tenureMonths / 12 * 10) / 10}y</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModHead({ title, sub, count }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[18px] font-semibold text-slate-900 tracking-tightish leading-tight">{title}</h2>
        <p className="text-[12.5px] text-slate-500 mt-0.5 max-w-[64ch]">{sub}</p>
      </div>
      <span className="mono text-[10px] uppercase tracking-[0.12em] text-slate-400 flex-shrink-0">{count}</span>
    </div>
  );
}

const MOD_VIEWS = { evidence: ModEvidence, timeline: ModTimeline, trust: ModTrust, growth: ModGrowth, mobility: ModMobility, organizations: ModOrgs };

function ViewCommand({ entity }) {
  const [mod, setMod] = React.useState('evidence');
  const Active = MOD_VIEWS[mod];
  return (
    <div className="max-w-[1340px] mx-auto px-6 py-9">
      <div className="rise mb-7">
        <SurfaceIntro eyebrow="Career Command Center · one workspace"
          title={<>Six modules. <span className="text-slate-400">One operating system.</span></>}
          sub="Evidence, Timeline, Trust, Growth, Mobility, and Organizations are not separate pages — they are connected views of one ledger, switched in place. The whole career, in a single workspace."
          right={<div className="hidden sm:flex items-center gap-2 text-[12px] text-slate-500"><span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 blink" />ledger live</span></div>} />
      </div>

      <div className="rise grid grid-cols-12 gap-6" style={{ animationDelay: '60ms' }}>
        {/* Module switcher */}
        <aside className="col-span-12 lg:col-span-3">
          <div className="lg:sticky lg:top-28 space-y-1.5">
            {MODULES.map(m => {
              const on = mod === m.id;
              return (
                <button key={m.id} onClick={() => setMod(m.id)}
                  className={cn('w-full text-left rounded-lg border px-3.5 py-3 transition-colors flex items-center gap-3',
                    on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:border-slate-300')}>
                  <div className={cn('h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0', on ? 'bg-white/10' : 'bg-slate-100')}>
                    <m.Icon size={15} className={on ? 'text-white' : 'text-slate-700'} />
                  </div>
                  <div className="min-w-0">
                    <div className={cn('text-[13px] font-semibold leading-tight', on ? 'text-white' : 'text-slate-900')}>{m.label}</div>
                    <div className={cn('text-[11px] mt-0.5', on ? 'text-slate-400' : 'text-slate-500')}>{m.desc}</div>
                  </div>
                  {on && <Icon.ChevronRight size={15} className="text-slate-500 ml-auto flex-shrink-0" />}
                </button>
              );
            })}
            <div className="mt-3 border border-slate-200 rounded-lg bg-slate-50 p-3.5">
              <div className="flex items-center gap-2 text-[11px] text-slate-600"><Icon.Layers size={13} className="text-slate-500" />All six read one ledger</div>
              <p className="text-[11px] text-slate-500 leading-snug mt-1.5">Change one fact and every module recomputes. Nothing here is a copy.</p>
            </div>
          </div>
        </aside>

        {/* Active module */}
        <div className="col-span-12 lg:col-span-9">
          <div key={mod} className="rise"><Active entity={entity} /></div>
        </div>
      </div>
    </div>
  );
}

window.ViewCommand = ViewCommand;
