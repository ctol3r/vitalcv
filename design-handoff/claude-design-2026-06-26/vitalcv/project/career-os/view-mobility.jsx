// SURFACE — /mobility/:id — Career Mobility
// GraphProjection over the owned ledger: Readiness, Opportunity Signals, Missing Evidence,
// Advancement Paths. Where the verified profile lets the clinician go next.

/* ---------- Readiness gauge ---------- */
function ReadinessPanel() {
  const r = READINESS;
  const readyN = r.dimensions.filter(d => d.ready).length;
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <div className="grid md:grid-cols-12">
        {/* score */}
        <div className="md:col-span-4 p-6 border-b md:border-b-0 md:border-r border-slate-200">
          <Eyebrow>Readiness</Eyebrow>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-[44px] font-semibold text-slate-900 tracking-[-0.03em] leading-none tabular-nums">{r.score}</span>
            <span className="mono text-[13px] text-slate-400">/ 100</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[15px] font-semibold text-slate-900">{r.label}</span>
            <Chip state="verified" size="sm">{readyN} of {r.dimensions.length} ready</Chip>
          </div>
          <p className="text-[12px] text-slate-500 mt-2 leading-snug">{r.sub}. Computed from verified standing — not a self-assessment.</p>
          {/* ring-ish bar */}
          <div className="mt-4 h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-slate-900 rounded-full" style={{ width: `${r.score}%` }} />
          </div>
        </div>
        {/* dimension readiness */}
        <div className="md:col-span-8 p-5">
          <Eyebrow className="mb-3">What the market reads as ready</Eyebrow>
          <div className="space-y-2">
            {r.dimensions.map(d => {
              const dim = DIM[d.key];
              return (
                <div key={d.key} className="flex items-center gap-3">
                  <div className={cn('h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 ring-1 ring-inset',
                    d.ready ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20')}>
                    {d.ready ? <Icon.Check size={13} strokeWidth={2.5} /> : <Icon.Minus size={13} strokeWidth={2.5} />}
                  </div>
                  <span className="text-[13px] font-medium text-slate-900 w-[96px]">{dim.label}</span>
                  <span className="text-[12px] text-slate-500 flex-1">{d.note}</span>
                  <span className={cn('mono text-[9px] uppercase tracking-[0.1em]', d.ready ? 'text-emerald-700' : 'text-amber-700')}>
                    {d.ready ? 'ready' : 'building'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Opportunity signals ---------- */
function OpportunitySignals() {
  const toneRing = { emerald: 'ring-emerald-600/20 bg-emerald-50 text-emerald-700', indigo: 'ring-indigo-600/20 bg-indigo-50 text-indigo-700', slate: 'ring-slate-300 bg-slate-100 text-slate-700' };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {OPPORTUNITY_SIGNALS.map(s => (
        <div key={s.id} className="border border-slate-200 rounded-lg bg-white p-4">
          <div className="flex items-center justify-between">
            <div className={cn('h-8 w-8 rounded-md flex items-center justify-center ring-1 ring-inset', toneRing[s.tone])}>
              <s.Icon size={15} />
            </div>
            <span className="mono text-[9px] uppercase tracking-[0.12em] text-slate-400">{s.label}</span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-[26px] font-semibold text-slate-900 tracking-tightish leading-none tabular-nums">{s.metric}</span>
            <span className="text-[11px] text-slate-500 leading-tight">{s.unit}</span>
          </div>
          <p className="text-[11.5px] text-slate-500 mt-2 leading-snug">{s.detail}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- Missing evidence (what unlocks more) ---------- */
function MissingEvidence() {
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.Search} title="Missing evidence" right={<Eyebrow>add these to unlock more</Eyebrow>} />
      <div className="divide-y divide-slate-100">
        {MISSING_EVIDENCE.map(m => {
          const dim = DIM[m.dim];
          return (
            <div key={m.id} className="px-5 py-3.5 flex items-start gap-4">
              <div className="h-8 w-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                <dim.Icon size={14} className="text-slate-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-slate-900">{m.label}</span>
                  <Chip state={m.state} size="sm" />
                </div>
                <p className="text-[12px] text-slate-500 mt-1 leading-snug">{m.detail}</p>
                <div className="mt-2 flex items-center gap-3 flex-wrap">
                  <span className="mono text-[9px] uppercase tracking-[0.1em] text-slate-400">owner · {m.owner}</span>
                  <span className="mono text-[9px] uppercase tracking-[0.1em] text-slate-400">{dim.label}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="text-[11px] text-slate-600 text-right max-w-[150px]">{m.impact}</span>
                <span className="mono text-[10px] uppercase tracking-[0.08em] text-emerald-700 bg-emerald-50 ring-1 ring-inset ring-emerald-600/20 rounded px-1.5 py-0.5">↑ {m.unlocks}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Advancement paths ---------- */
function AdvancementPath({ p }) {
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden flex flex-col">
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50/50">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {p.dims.map(d => { const I = DIM[d].Icon; return <I key={d} size={13} className="text-slate-500" />; })}
            <span className="mono text-[9px] uppercase tracking-[0.12em] text-slate-400">{p.horizon}</span>
          </div>
          <div className="text-[15px] font-semibold text-slate-900 leading-tight mt-1.5">{p.title}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[20px] font-semibold text-slate-900 tracking-tightish leading-none tabular-nums">{p.match}<span className="text-[12px] text-slate-400">%</span></div>
          <div className="mono text-[9px] uppercase tracking-[0.1em] text-slate-400 mt-0.5">match</div>
        </div>
      </div>
      <div className="p-5 flex-1">
        <p className="text-[12.5px] text-slate-600 leading-[1.55]">{p.summary}</p>
        {/* match bar */}
        <div className="mt-3.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-slate-900 rounded-full" style={{ width: `${p.match}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <Eyebrow className="mb-2">You have</Eyebrow>
            <ul className="space-y-1.5">
              {p.have.map((h, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11.5px] text-slate-700">
                  <Icon.Check size={12} className="text-emerald-600 mt-0.5 flex-shrink-0" strokeWidth={2.5} />{h}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Eyebrow className="mb-2">You need</Eyebrow>
            <ul className="space-y-1.5">
              {p.need.map((n, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11.5px] text-slate-500">
                  <Icon.Plus size={12} className="text-amber-600 mt-0.5 flex-shrink-0" strokeWidth={2.5} />{n}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">Projected from your verified profile</span>
        <Button size="sm" variant="ghost" iconRight={<Icon.ArrowRight size={13} />}>View requirements</Button>
      </div>
    </div>
  );
}

function ViewMobility({ entity }) {
  const sorted = [...ADVANCEMENT_PATHS].sort((a, b) => b.match - a.match);
  return (
    <div className="max-w-[1340px] mx-auto px-6 py-9 space-y-10">
      <div className="rise">
        <EntityHeader entity={entity} surfaceLabel="Career Mobility"
          surfaceDesc="Where the verified profile can go next. Readiness, the opportunities it unlocks today, the evidence that would unlock more, and the advancement paths it projects — all computed from the owned ledger, so they travel with the clinician." />
      </div>

      <section className="rise" style={{ animationDelay: '60ms' }}>
        <SectionHeader n="01" title="Readiness" sub="Computed from verified standing across dimensions." right="market-ready · conditional" />
        <ReadinessPanel />
      </section>

      <section className="rise" style={{ animationDelay: '120ms' }}>
        <SectionHeader n="02" title="Opportunity signals" sub="What the current profile opens — weighted to the field, never a named ranking." />
        <OpportunitySignals />
      </section>

      <section className="rise" style={{ animationDelay: '180ms' }}>
        <SectionHeader n="03" title="Missing evidence" sub="The smallest additions with the largest unlock." />
        <MissingEvidence />
      </section>

      <section className="rise" style={{ animationDelay: '240ms' }}>
        <SectionHeader n="04" title="Advancement paths" sub="Roles the verified profile projects toward — strongest match first." right={`${ADVANCEMENT_PATHS.length} paths`} />
        <div className="grid lg:grid-cols-3 gap-5">
          {sorted.map(p => <AdvancementPath key={p.id} p={p} />)}
        </div>
      </section>

      <div className="border-t border-slate-200 pt-5 flex items-center justify-between flex-wrap gap-3">
        <p className="text-[12px] text-slate-500 max-w-[64ch] leading-[1.55]">
          Mobility is a projection of an <span className="text-slate-900 font-medium">owned, portable ledger</span>. No employer holds it; a change of job, state, or specialty recomputes — it never resets.
        </p>
        <Button variant="outline" size="sm" iconRight={<Icon.ArrowRight size={13} />} onClick={() => navTo('career', entity.id)}>
          Back to Career OS
        </Button>
      </div>
    </div>
  );
}

window.ViewMobility = ViewMobility;
