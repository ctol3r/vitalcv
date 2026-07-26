// SURFACE — /reputation/:id — Professional Reputation
// TrustProjection: Reputation Dimensions (7), Reputation History, Evidence Sources, Recognition Sources.
// Canon (W235): a profile, never a stored score. Compared only to an anonymous field median.

function trendMeta(t) {
  return {
    rising: { sym: '▲', cls: 'text-emerald-700', label: 'rising' },
    steady: { sym: '＝', cls: 'text-slate-500',   label: 'steady' },
    falling:{ sym: '▼', cls: 'text-rose-700',     label: 'falling' },
  }[t];
}
function strengthWord(v, median) {
  if (v >= median + 18) return 'strong';
  if (v >= median + 5) return 'above';
  if (v >= median - 5) return 'at median';
  return 'thin';
}

/* ---------- The reputation profile (7 dimensions) ---------- */
function DimensionRow({ d, open, onToggle }) {
  const tm = trendMeta(d.trend);
  const feedingEvents = EVENTS.filter(e => e.dims.includes(d.key));
  const feedingRecog = RECOGNITION.filter(r => r.dims.includes(d.key));
  return (
    <div className={cn('border-b border-slate-100 last:border-b-0', open && 'bg-slate-50/50')}>
      <button onClick={onToggle} className="w-full text-left px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
            <d.Icon size={16} className="text-slate-700" />
          </div>
          <div className="min-w-[120px]">
            <div className="text-[13.5px] font-semibold text-slate-900 leading-tight">{d.label}</div>
            <div className="mono text-[9.5px] uppercase tracking-[0.08em] text-slate-400 mt-0.5">{d.evidenceCount} verified events</div>
          </div>
          {/* track */}
          <div className="flex-1 min-w-0">
            <div className="relative h-3.5 bg-slate-100 border border-slate-200 rounded-sm overflow-visible">
              <div className="absolute inset-y-0 left-0 rounded-l-sm" style={{ width: `${d.value}%`, background: 'repeating-linear-gradient(135deg,#0f172a 0 7px,#1e293b 7px 9px)' }} />
              <span className="absolute -top-1 -bottom-1 w-px bg-slate-400 border-l border-dashed border-slate-400" style={{ left: `${d.median}%` }} title="field median" />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 w-[150px] justify-end">
            <span className={cn('mono text-[11px]', tm.cls)} title={tm.label}>{tm.sym}</span>
            <span className="text-[11.5px] text-slate-500 w-[58px] text-right">{strengthWord(d.value, d.median)}</span>
            <Icon.ChevronDown size={15} className={cn('text-slate-400 transition-transform', open && 'rotate-180')} />
          </div>
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1">
          <p className="text-[12.5px] text-slate-600 leading-[1.6] max-w-[80ch]">{d.blurb}</p>
          <div className="grid md:grid-cols-2 gap-4 mt-3.5">
            <div>
              <Eyebrow className="mb-1.5">Verified events feeding this dimension</Eyebrow>
              <div className="border border-slate-200 rounded-md bg-white divide-y divide-slate-100">
                {feedingEvents.length === 0 && <div className="px-3 py-2.5 text-[12px] text-slate-400">No events yet — dimension is thin.</div>}
                {feedingEvents.map(e => (
                  <div key={e.id} className="px-3 py-2 flex items-center gap-2">
                    <span className={cn('mono text-[10px]', e.dir === 'down' ? 'text-rose-700' : 'text-emerald-700')}>{e.dir === 'down' ? '▼' : e.dir === 'floor' ? '▣' : '▲'}</span>
                    <span className="text-[12px] text-slate-900 truncate flex-1">{e.title}</span>
                    <span className="mono text-[10px] text-slate-400 tabular-nums">{e.year}</span>
                  </div>
                ))}
                {feedingRecog.map(r => (
                  <div key={r.id} className="px-3 py-2 flex items-center gap-2">
                    <Icon.Award size={11} className="text-violet-600" />
                    <span className="text-[12px] text-slate-900 truncate flex-1">{r.title}</span>
                    <span className="mono text-[10px] text-slate-400 tabular-nums">{r.year}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Eyebrow className="mb-1.5">Read</Eyebrow>
              <div className="border border-slate-200 rounded-md bg-white p-3 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-slate-500">Strength vs. field median</span>
                  <span className="mono text-[12px] text-slate-900">{d.value} <span className="text-slate-400">/ {d.median}</span></span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-slate-500">Trend</span>
                  <span className={cn('mono text-[12px]', tm.cls)}>{tm.sym} {tm.label}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-slate-500">Fed by</span>
                  <span className="text-[11.5px] text-slate-700 text-right">{d.fed.join(' · ')}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug pt-1 border-t border-slate-100">
                  Compared only to an anonymous field median — never ranked against a named clinician.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReputationProfile() {
  const [open, setOpen] = React.useState('clinical');
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.Award} title={`${ENTITY.fullName} · reputation profile`}
        right={<Eyebrow>dashed mark = field median</Eyebrow>} />
      <div>
        {DIMENSIONS.map(d => (
          <DimensionRow key={d.key} d={d} open={open === d.key} onToggle={() => setOpen(open === d.key ? null : d.key)} />
        ))}
      </div>
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-6 flex-wrap mono text-[9px] uppercase tracking-[0.1em] text-slate-500">
        <span className="inline-flex items-center gap-2"><span className="inline-block w-4 h-2.5" style={{ background: 'repeating-linear-gradient(135deg,#0f172a 0 5px,#1e293b 5px 7px)' }} /> reputation strength · traceable to evidence</span>
        <span className="inline-flex items-center gap-2"><span className="inline-block w-px h-3 border-l border-dashed border-slate-400" /> field median · the only comparison drawn</span>
      </div>
    </div>
  );
}

/* ---------- Reputation history — era-by-era accumulation matrix ---------- */
function ReputationHistory() {
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.TrendingUp} title="Reputation history" right={<Eyebrow>era by era · last era projected</Eyebrow>} />
      <div className="overflow-x-auto scroll-thin">
        <div className="min-w-[640px]">
          {/* era header */}
          <div className="grid items-stretch border-b border-slate-200" style={{ gridTemplateColumns: '150px repeat(4, 1fr)' }}>
            <div className="px-4 py-2.5 bg-slate-50 border-r border-slate-200" />
            {ERAS.map((e, i) => (
              <div key={e.key} className={cn('px-4 py-2.5 border-r border-slate-100 last:border-r-0', i === 3 && 'bg-slate-50/60')}>
                <div className="mono text-[9px] uppercase tracking-[0.12em] text-slate-400">{e.years}{i === 3 ? ' · projected' : ''}</div>
                <div className="text-[12px] font-semibold text-slate-900 mt-0.5">{e.label}</div>
              </div>
            ))}
          </div>
          {/* rows */}
          {DIMENSIONS.map(d => (
            <div key={d.key} className="grid items-center border-b border-slate-100 last:border-b-0" style={{ gridTemplateColumns: '150px repeat(4, 1fr)' }}>
              <div className="px-4 py-2.5 bg-slate-50 border-r border-slate-200 flex items-center gap-2">
                <d.Icon size={13} className="text-slate-500" />
                <span className="text-[12px] font-medium text-slate-900">{d.label}</span>
              </div>
              {REP_HISTORY[d.key].map((v, i) => (
                <div key={i} className={cn('px-4 py-2.5 border-r border-slate-100 last:border-r-0', i === 3 && 'bg-slate-50/40')}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded-sm overflow-hidden">
                      <div className={cn('h-full rounded-sm', i === 3 ? 'opacity-45' : '')} style={{
                        width: `${v}%`,
                        background: i === 3 ? 'repeating-linear-gradient(135deg,#475569 0 4px,transparent 4px 6px)' : '#0f172a',
                        backgroundColor: i === 3 ? '#94a3b8' : '#0f172a',
                      }} />
                    </div>
                    <span className="mono text-[10px] text-slate-500 tabular-nums w-5 text-right">{v}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-[11.5px] text-slate-500 leading-snug">
        Reputation is the <span className="text-slate-900 font-medium">time-integral</span> of the ladder. Authority forms first and sets a floor; clinical and operational standing accrue through proven work; leadership, academic, and service compound last. Nothing earned is ever subtracted — only added to or aged.
      </div>
    </div>
  );
}

/* ---------- Evidence sources ---------- */
function EvidenceSources() {
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.Layers} title="Evidence sources" right={<Eyebrow>what feeds the profile</Eyebrow>} />
      <div className="divide-y divide-slate-100">
        {EVIDENCE_SOURCES.map(s => {
          const m = TRUST_META[s.state] || TRUST_META.verified;
          return (
            <div key={s.id} className="px-5 py-3 flex items-center gap-4">
              <div className="min-w-[150px]">
                <div className="text-[12.5px] font-semibold text-slate-900">{s.label}</div>
                <div className="text-[11px] text-slate-500">{s.authority}</div>
              </div>
              <div className="flex-1 flex items-center gap-1.5 flex-wrap">
                {s.feeds.map(f => <span key={f} className="mono text-[9px] uppercase tracking-[0.06em] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{DIM[f].label}</span>)}
              </div>
              <span className="mono text-[9px] uppercase tracking-[0.1em] text-slate-400 hidden sm:block">{s.tier}</span>
              <span className="mono text-[10.5px] text-slate-400 tabular-nums hidden md:block w-[78px] text-right">{s.last}</span>
              <Chip state={s.state} size="sm" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Recognition sources (conferred amplifiers) ---------- */
function RecognitionSources() {
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.Award} title="Recognition sources" right={<Eyebrow>conferred · amplifies evidence</Eyebrow>} />
      <div className="divide-y divide-slate-100">
        {RECOGNITION.map(r => (
          <div key={r.id} className="px-5 py-3.5 flex items-start gap-3">
            <div className="h-8 w-8 rounded-md bg-violet-50 ring-1 ring-inset ring-violet-600/20 flex items-center justify-center flex-shrink-0">
              <Icon.Award size={14} className="text-violet-700" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-slate-900 leading-tight">{r.title}</div>
              <div className="text-[11.5px] text-slate-500 mt-0.5">{r.conferrer} · {r.year}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="mono text-[10px] uppercase tracking-[0.08em] text-violet-700">{r.selectivity}</div>
              <div className="text-[10.5px] text-slate-400 mt-0.5">{r.dims.map(d => DIM[d].label).join(' · ')}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
        Recognition cannot be self-claimed · it scales with selectivity · it does not decay
      </div>
    </div>
  );
}

function ViewReputation({ entity }) {
  const aboveMedian = DIMENSIONS.filter(d => d.value >= d.median).length;
  return (
    <div className="max-w-[1340px] mx-auto px-6 py-9 space-y-10">
      <div className="rise">
        <EntityHeader entity={entity} surfaceLabel="Professional Reputation"
          surfaceDesc="Accumulated professional credibility — the aggregate at the top of the ladder. Shown as a profile across seven independent dimensions, never collapsed into one score, never ranked against a named peer. It moves only on verified facts." />
      </div>

      {/* summary stat band */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden rise" style={{ animationDelay: '60ms' }}>
        {[
          { k: 'Dimensions', v: '7', sub: 'computed independently' },
          { k: 'Above field median', v: `${aboveMedian} of 7`, sub: 'authority · clinical · operational · academic' },
          { k: 'Verified events', v: String(EVENTS.length), sub: 'every dimension traceable' },
          { k: 'Stored score', v: 'none', sub: 'composed at read time only' },
        ].map((s, i) => (
          <div key={i} className="bg-white px-4 py-3.5">
            <div className="mono text-[9.5px] uppercase tracking-[0.12em] text-slate-500">{s.k}</div>
            <div className="text-[22px] font-semibold text-slate-900 tracking-tightish mt-1 leading-none">{s.v}</div>
            <div className="text-[10.5px] text-slate-400 mt-1 leading-snug">{s.sub}</div>
          </div>
        ))}
      </div>

      <section className="rise" style={{ animationDelay: '120ms' }}>
        <SectionHeader n="01" title="Reputation dimensions" sub="Seven domains of credibility — expand any to see the evidence beneath it." right="profile · not a score" />
        <ReputationProfile />
      </section>

      <section className="rise" style={{ animationDelay: '180ms' }}>
        <SectionHeader n="02" title="Reputation history" sub="How standing accumulated, era by era." />
        <ReputationHistory />
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rise" style={{ animationDelay: '240ms' }}>
          <SectionHeader n="03" title="Evidence sources" sub="The registries that feed each dimension." />
          <EvidenceSources />
        </section>
        <section className="rise" style={{ animationDelay: '300ms' }}>
          <SectionHeader n="04" title="Recognition sources" sub="Conferred honor that amplifies the record." />
          <RecognitionSources />
        </section>
      </div>

      <div className="border-t border-slate-200 pt-5 flex items-center justify-between flex-wrap gap-3">
        <p className="text-[12px] text-slate-500 max-w-[64ch] leading-[1.55]">
          No followers, no feed, no leaderboard. Every bar dereferences to verified evidence; the only benchmark is an anonymous field median. This is credibility, <span className="text-slate-900 font-medium">not attention</span>.
        </p>
        <Button variant="outline" size="sm" iconRight={<Icon.ArrowRight size={13} />} onClick={() => navTo('mobility', entity.id)}>
          See where it can take you
        </Button>
      </div>
    </div>
  );
}

window.ViewReputation = ViewReputation;
