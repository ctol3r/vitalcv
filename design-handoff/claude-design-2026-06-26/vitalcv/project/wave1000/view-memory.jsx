// SURFACE — /memory/:id — CAREER MEMORY (Wave 1000)
// Every meaningful event becomes permanent professional memory. Nothing is lost.
// First license · board cert · promotion · publication · award · transition — all compound.

/* ---------- Permanent milestones (the floors that never fall) ---------- */
function MemoryFloors() {
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.Anchor} title="Permanent memory" right={<Eyebrow>floors · never fall below</Eyebrow>} />
      <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-slate-200">
        {MILESTONES.map(m => (
          <div key={m.id} className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-md bg-slate-900 text-white flex items-center justify-center flex-shrink-0"><IconFor name={m.icon} size={14} /></div>
              <span className="mono text-[11px] text-slate-400 tabular-nums">{m.year}</span>
            </div>
            <div className="text-[13px] font-semibold text-slate-900 leading-tight">{m.label}</div>
            <div className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">{m.detail}</div>
          </div>
        ))}
      </div>
      <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
        A career's firsts are permanent · they set a floor the record can never drop beneath
      </div>
    </div>
  );
}

/* ---------- Timeline event (expandable, with provenance) ---------- */
function MemoryEvent({ ev, expanded, onToggle, isLast }) {
  const m = TRUST_META[ev.state] || TRUST_META.verified;
  const dirMeta = {
    up:    { sym: '▲', cls: 'text-emerald-700', label: 'raises' },
    floor: { sym: '▣', cls: 'text-slate-900',   label: 'sets permanent floor' },
    down:  { sym: '▼', cls: 'text-rose-700',     label: 'lowers' },
  }[ev.dir];
  return (
    <div className="relative pl-14">
      {!isLast && <span className="absolute left-[22px] top-9 bottom-0 w-px bg-slate-200" />}
      <span className={cn('absolute left-[10px] top-3 h-6 w-6 rounded-full ring-4 ring-white flex items-center justify-center',
        ev.state === 'adverse' ? 'bg-rose-600 text-white' : ev.dir === 'floor' ? 'bg-slate-900 text-white' : 'bg-white border-2 border-slate-900 text-slate-900')}>
        <IconFor name={ev.icon} size={12} strokeWidth={2.25} />
      </span>
      <button onClick={onToggle} className="w-full text-left group">
        <div className={cn('rounded-lg border bg-white px-4 py-3.5 transition-colors', expanded ? 'border-slate-300 bg-slate-50/40' : 'border-slate-200 hover:border-slate-300')}>
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="mono text-[11px] text-slate-400 tabular-nums">{ev.date}</span>
                <span className="mono text-[9px] uppercase tracking-[0.13em] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{ev.kind}</span>
                {ev.dir === 'floor' && <span className="inline-flex items-center gap-1 mono text-[9px] uppercase tracking-[0.1em] text-slate-700"><Icon.Anchor size={10} />permanent</span>}
              </div>
              <div className="text-[14.5px] font-semibold text-slate-900 leading-tight mt-1">{ev.title}</div>
              <div className="text-[12.5px] text-slate-500 mt-0.5">{ev.org}</div>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <Chip state={ev.state} size="sm" />
              {ev.dims.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className={cn('mono text-[10px] font-semibold', dirMeta.cls)}>{dirMeta.sym}</span>
                  <span className="text-[10.5px] text-slate-500">{ev.dims.map(d => DIM[d].label).join(' · ')}</span>
                </div>
              )}
            </div>
            <Icon.ChevronDown size={15} className={cn('text-slate-400 transition-transform mt-1 flex-shrink-0', expanded && 'rotate-180')} />
          </div>
          {expanded && (
            <div className="mt-3.5 pt-3.5 border-t border-slate-200 grid md:grid-cols-12 gap-4">
              <div className="md:col-span-7">
                <Eyebrow className="mb-1.5">What happened</Eyebrow>
                <p className="text-[12.5px] text-slate-600 leading-[1.6]">{ev.detail}</p>
                {ev.dims.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-slate-500">Moves:</span>
                    {ev.dims.map(d => (
                      <span key={d} className="inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.06em] bg-slate-100 text-slate-700 rounded px-2 py-1">
                        <span className={dirMeta.cls}>{dirMeta.sym}</span>{DIM[d].label}
                      </span>
                    ))}
                    <span className="mono text-[10px] uppercase tracking-[0.1em] text-slate-400">{dirMeta.label}</span>
                  </div>
                )}
              </div>
              <div className="md:col-span-5">
                <Eyebrow className="mb-1.5">Provenance</Eyebrow>
                <div className="border border-slate-200 rounded-md bg-white p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <m.Icon size={13} className={m.text} />
                    <span className="text-[12px] font-medium text-slate-900">{ev.source}</span>
                    <span className="mono text-[9px] uppercase tracking-[0.1em] text-slate-400 ml-auto">{ev.tier}</span>
                  </div>
                  <p className="text-[11.5px] text-slate-500 leading-snug">{ev.authority}</p>
                  <div className="mt-2.5 bg-slate-50 border border-slate-200 rounded p-2">
                    <div className="mono text-[9px] text-slate-400 uppercase tracking-[0.1em] mb-0.5">Receipt</div>
                    <div className="mono text-[11px] text-slate-900 break-all">{ev.receipt}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </button>
    </div>
  );
}

function MemoryTimeline() {
  const ordered = [...EVENTS].sort((a, b) => (a.date < b.date ? 1 : -1));
  const [openId, setOpenId] = React.useState(ordered[0].id);
  const [filter, setFilter] = React.useState('all');
  const kinds = ['all', ...Array.from(new Set(EVENTS.map(e => e.kind)))];
  const shown = filter === 'all' ? ordered : ordered.filter(e => e.kind === filter);
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {kinds.map(k => (
          <button key={k} onClick={() => setFilter(k)}
            className={cn('px-2.5 h-7 rounded-md text-[11.5px] font-medium transition-colors',
              filter === k ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300')}>
            {k === 'all' ? 'All events' : k}
          </button>
        ))}
        <span className="ml-auto mono text-[10.5px] uppercase tracking-[0.12em] text-slate-400">{shown.length} of {EVENTS.length}</span>
      </div>
      <div className="space-y-2.5">
        {shown.map((ev, i) => (
          <MemoryEvent key={ev.id} ev={ev} expanded={openId === ev.id} onToggle={() => setOpenId(openId === ev.id ? null : ev.id)} isLast={i === shown.length - 1} />
        ))}
      </div>
    </div>
  );
}

/* ---------- Trust history (re-reads over time) ---------- */
function MemoryTrustHistory() {
  const toneMap = { ok: 'bg-emerald-500', warn: 'bg-amber-500', info: 'bg-indigo-500', muted: 'bg-slate-300' };
  const kindLabel = { refresh: 'Refresh', corroborate: 'Corroborate', decay: 'Decay', network: 'Network', resolve: 'Resolve' };
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.Activity} title="Memory of belief" right={<Eyebrow>every re-read, kept</Eyebrow>} />
      <div className="divide-y divide-slate-100">
        {TRUST_HISTORY.map((h, i) => (
          <div key={i} className="px-5 py-3 flex items-start gap-3">
            <span className={cn('h-2 w-2 rounded-full mt-1.5 flex-shrink-0', toneMap[h.tone])} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="mono text-[9px] uppercase tracking-[0.13em] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{kindLabel[h.kind]}</span>
                <span className="text-[12px] font-medium text-slate-900">{h.source}</span>
                <span className="mono text-[10.5px] text-slate-400 ml-auto tabular-nums">{h.t.slice(0, 10)}</span>
              </div>
              <p className="text-[12px] text-slate-600 leading-snug mt-1">{h.msg}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ViewMemory({ entity }) {
  return (
    <div className="max-w-[1340px] mx-auto px-6 py-9 space-y-10">
      <div className="rise">
        <SurfaceIntro eyebrow="Career Memory · permanent record"
          title={<>Nothing is lost. <span className="text-slate-400">Everything compounds.</span></>}
          sub="Every meaningful event — a first license, a residency completed, a board certification, a promotion, a publication, an award, a career transition — becomes permanent professional memory. The record only grows."
          right={<div className="text-right"><div className="text-[26px] font-semibold text-slate-900 tabular-nums leading-none">{EVENTS.length}</div><div className="mono text-[9px] uppercase tracking-[0.1em] text-slate-400 mt-1">events kept · {entity.yearsPracticing}y</div></div>} />
      </div>

      <section className="rise" style={{ animationDelay: '60ms' }}><MemoryFloors /></section>

      <section className="rise" style={{ animationDelay: '120ms' }}>
        <SectionHeader n="01" title="The full record" sub="Every verified event, newest first — expand any to read its evidence and receipt." right={`${EVENTS.length} events`} />
        <MemoryTimeline />
      </section>

      <div className="grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 rise" style={{ animationDelay: '160ms' }}>
          <SectionHeader n="02" title="Recognition, remembered" sub="Esteem conferred by others — undecaying, never self-claimed." />
          <div className="space-y-4">
            {RECOGNITION.map(r => (
              <div key={r.id} className="border border-violet-200 bg-violet-50/40 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-md bg-violet-600 text-white flex items-center justify-center flex-shrink-0"><Icon.Award size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="mono text-[11px] text-slate-400 tabular-nums">{r.year}</span><Chip state="conferred" size="sm" /></div>
                    <div className="text-[13.5px] font-semibold text-slate-900 leading-tight mt-1">{r.title}</div>
                    <div className="text-[12px] text-slate-500 mt-0.5">{r.conferrer}</div>
                  </div>
                  <span className="mono text-[10px] uppercase tracking-[0.08em] text-violet-700 flex-shrink-0">{r.selectivity}</span>
                </div>
                <p className="text-[12px] text-slate-600 leading-[1.55] mt-3">{r.blurb}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="lg:col-span-5 rise" style={{ animationDelay: '200ms' }}>
          <SectionHeader n="03" title="Memory of belief" sub="Trust decays and refreshes — every re-read is kept." />
          <MemoryTrustHistory />
        </section>
      </div>

      <div className="border-t border-slate-200 pt-5 flex items-center justify-between flex-wrap gap-3">
        <p className="text-[12px] text-slate-500 max-w-[62ch] leading-[1.55]">
          Career Memory is <span className="text-slate-900 font-medium">append-only</span>. Facts are never deleted, only re-read and re-believed. A clinician's whole professional past travels with them — owned, portable, permanent.
        </p>
        <Button variant="outline" size="sm" iconRight={<Icon.ArrowRight size={13} />} onClick={() => navTo('legacy', entity.id)}>See the legacy it builds</Button>
      </div>
    </div>
  );
}

window.ViewMemory = ViewMemory;
