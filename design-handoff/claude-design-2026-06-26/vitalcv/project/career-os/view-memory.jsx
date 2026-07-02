// SURFACE — /memory/:id — Professional Memory
// TimelineProjection over the owned EvidenceCollection: Career Timeline, Career Events,
// Trust History, Recognition Events, Major Milestones.

function IconFor({ name, ...rest }) { const I = Icon[name] || Icon.Dot; return <I {...rest} />; }

/* ---------- Major milestones strip (floors that never fall) ---------- */
function MilestoneStrip() {
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.Flag} title="Major milestones" right={<Eyebrow>floors · never fall below</Eyebrow>} />
      <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-slate-200">
        {MILESTONES.map((m, i) => (
          <div key={m.id} className="p-4 relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-md bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
                <IconFor name={m.icon} size={14} />
              </div>
              <span className="mono text-[11px] text-slate-400 tabular-nums">{m.year}</span>
            </div>
            <div className="text-[13px] font-semibold text-slate-900 leading-tight">{m.label}</div>
            <div className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">{m.detail}</div>
            <div className="mt-2"><span className="mono text-[9px] uppercase tracking-[0.12em] text-slate-400">{DIM[m.dim].label}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Career timeline (interactive, expandable) ---------- */
function TimelineEvent({ ev, expanded, onToggle, isLast }) {
  const m = TRUST_META[ev.state] || TRUST_META.verified;
  const dirMeta = {
    up:    { sym: '▲', cls: 'text-emerald-700', label: 'raises' },
    floor: { sym: '▣', cls: 'text-slate-900',   label: 'sets floor' },
    down:  { sym: '▼', cls: 'text-rose-700',     label: 'lowers' },
  }[ev.dir];
  return (
    <div className="relative pl-14">
      {/* spine */}
      {!isLast && <span className="absolute left-[22px] top-9 bottom-0 w-px bg-slate-200" />}
      {/* node */}
      <span className={cn('absolute left-[10px] top-3 h-6 w-6 rounded-full ring-4 ring-white flex items-center justify-center',
        ev.state === 'adverse' ? 'bg-rose-600 text-white' : ev.dir === 'floor' ? 'bg-slate-900 text-white' : 'bg-white border-2 border-slate-900 text-slate-900')}>
        <IconFor name={ev.icon} size={12} strokeWidth={2.25} />
      </span>

      <button onClick={onToggle} className="w-full text-left group">
        <div className={cn('rounded-lg border bg-white px-4 py-3.5 transition-colors',
          expanded ? 'border-slate-300 bg-slate-50/40' : 'border-slate-200 hover:border-slate-300')}>
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="mono text-[11px] text-slate-400 tabular-nums">{ev.date}</span>
                <span className="mono text-[9px] uppercase tracking-[0.13em] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{ev.kind}</span>
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

function CareerTimeline() {
  const ordered = [...EVENTS].sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
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
          <TimelineEvent key={ev.id} ev={ev} expanded={openId === ev.id}
            onToggle={() => setOpenId(openId === ev.id ? null : ev.id)} isLast={i === shown.length - 1} />
        ))}
      </div>
    </div>
  );
}

/* ---------- Recognition events (conferred) ---------- */
function RecognitionCard({ r }) {
  return (
    <div className="border border-violet-200 bg-violet-50/40 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-md bg-violet-600 text-white flex items-center justify-center flex-shrink-0">
          <Icon.Award size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="mono text-[11px] text-slate-400 tabular-nums">{r.year}</span>
            <Chip state="conferred" size="sm" />
          </div>
          <div className="text-[13.5px] font-semibold text-slate-900 leading-tight mt-1">{r.title}</div>
          <div className="text-[12px] text-slate-500 mt-0.5">{r.conferrer}</div>
        </div>
      </div>
      <p className="text-[12px] text-slate-600 leading-[1.55] mt-3">{r.blurb}</p>
      <div className="mt-3 pt-3 border-t border-violet-200/60 flex items-center justify-between">
        <span className="mono text-[10px] uppercase tracking-[0.1em] text-violet-700">{r.selectivity}</span>
        <span className="text-[10.5px] text-slate-500">{r.dims.map(d => DIM[d].label).join(' · ')}</span>
      </div>
    </div>
  );
}

/* ---------- Trust history feed ---------- */
function TrustHistory() {
  const toneMap = {
    ok:    'bg-emerald-500',
    warn:  'bg-amber-500',
    info:  'bg-indigo-500',
    muted: 'bg-slate-300',
  };
  const kindLabel = { refresh: 'Refresh', corroborate: 'Corroborate', decay: 'Decay', network: 'Network', resolve: 'Resolve' };
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.Activity} title="Trust history" right={<Eyebrow>belief in evidence, over time</Eyebrow>} />
      <div className="divide-y divide-slate-100">
        {TRUST_HISTORY.map((h, i) => (
          <div key={i} className="px-5 py-3 flex items-start gap-3">
            <span className={cn('h-2 w-2 rounded-full mt-1.5 flex-shrink-0', toneMap[h.tone])} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="mono text-[9px] uppercase tracking-[0.13em] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{kindLabel[h.kind]}</span>
                <span className="text-[12px] font-medium text-slate-900">{h.source}</span>
                <span className="mono text-[10.5px] text-slate-400 ml-auto tabular-nums">{h.t}</span>
              </div>
              <p className="text-[12px] text-slate-600 leading-snug mt-1">{h.msg}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
        Trust is computed · it decays and refreshes · every line is a re-read of an owned fact
      </div>
    </div>
  );
}

function ViewMemory({ entity }) {
  return (
    <div className="max-w-[1340px] mx-auto px-6 py-9 space-y-10">
      <div className="rise" style={{ animationDelay: '0ms' }}>
        <EntityHeader entity={entity} surfaceLabel="Professional Memory"
          surfaceDesc="Everything that happened in this career, as a timeline projected from the owned evidence ledger. Each event is a dated, sourced, typed fact — what you have, what it earned, and what it moved. Nothing here is editorial; it is the record." />
      </div>

      <section className="rise" style={{ animationDelay: '60ms' }}>
        <MilestoneStrip />
      </section>

      <section className="rise" style={{ animationDelay: '120ms' }}>
        <SectionHeader n="01" title="Career timeline" sub="Every verified event, newest first — expand any to read its evidence and receipt." right={`${EVENTS.length} events · ${entity.yearsPracticing}y`} />
        <CareerTimeline />
      </section>

      <div className="grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 rise" style={{ animationDelay: '180ms' }}>
          <SectionHeader n="02" title="Recognition events" sub="Esteem others conferred — scarce, undecaying, cannot be self-claimed." />
          <div className="grid sm:grid-cols-1 gap-4">
            {RECOGNITION.map(r => <RecognitionCard key={r.id} r={r} />)}
          </div>
        </section>
        <section className="lg:col-span-5 rise" style={{ animationDelay: '240ms' }}>
          <SectionHeader n="03" title="Trust history" sub="The audit trail of belief." />
          <TrustHistory />
        </section>
      </div>

      <div className="border-t border-slate-200 pt-5 flex items-center justify-between flex-wrap gap-3">
        <p className="text-[12px] text-slate-500 max-w-[60ch] leading-[1.55]">
          This timeline is a <span className="text-slate-900 font-medium">projection</span>, not a store. It is recomputed from the owned ledger every read — which is why it travels with the clinician, not the employer.
        </p>
        <Button variant="outline" size="sm" iconRight={<Icon.ArrowRight size={13} />} onClick={() => navTo('reputation', entity.id)}>
          See what it accumulates into
        </Button>
      </div>
    </div>
  );
}

window.ViewMemory = ViewMemory;
window.IconFor = IconFor;
