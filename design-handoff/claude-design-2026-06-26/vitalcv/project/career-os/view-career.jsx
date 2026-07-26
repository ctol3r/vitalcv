// SURFACE — /career/:id — Career OS Home
// Combines Memory + Reputation + Mobility into one home. The clinician's career, owned.

/* ---------- The ladder (evidence → trust → recognition → reputation) ---------- */
function LadderStrip() {
  const rungs = [
    { n: '01', label: 'Evidence', sub: 'a fact you hold', state: 'OBSERVED', Icon: Icon.FileText },
    { n: '02', label: 'Trust', sub: 'belief in the fact', state: 'COMPUTED', Icon: Icon.ShieldCheck },
    { n: '03', label: 'Recognition', sub: 'esteem conferred', state: 'CONFERRED', Icon: Icon.Award },
    { n: '04', label: 'Reputation', sub: 'standing over time', state: 'ACCUMULATED', Icon: Icon.TrendingUp, cap: true },
  ];
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-200">
        {rungs.map(r => (
          <div key={r.n} className={cn('p-4 relative', r.cap && 'bg-slate-950 text-white')}>
            <div className="flex items-center gap-2 mb-2">
              <div className={cn('h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0', r.cap ? 'bg-white/10 text-white' : 'bg-slate-900 text-white')}>
                <r.Icon size={14} />
              </div>
              <span className={cn('mono text-[9px] uppercase tracking-[0.12em]', r.cap ? 'text-slate-400' : 'text-slate-400')}>{r.state}</span>
            </div>
            <div className={cn('text-[14px] font-semibold leading-tight', r.cap ? 'text-white' : 'text-slate-900')}>{r.label}</div>
            <div className={cn('text-[11.5px] mt-0.5', r.cap ? 'text-slate-400' : 'text-slate-500')}>{r.sub}</div>
          </div>
        ))}
      </div>
      <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
        Each rung feeds the one above · reputation is the integral of the ladder over time
      </div>
    </div>
  );
}

/* ---------- Mini reputation profile (top dimensions) ---------- */
function MiniProfile() {
  return (
    <div className="space-y-2">
      {DIMENSIONS.map(d => (
        <div key={d.key} className="flex items-center gap-2.5">
          <span className="text-[11px] text-slate-600 w-[78px] flex-shrink-0">{d.label}</span>
          <div className="relative flex-1 h-2.5 bg-slate-100 rounded-sm overflow-visible">
            <div className="absolute inset-y-0 left-0 rounded-sm bg-slate-900" style={{ width: `${d.value}%` }} />
            <span className="absolute -top-0.5 -bottom-0.5 w-px border-l border-dashed border-slate-400" style={{ left: `${d.median}%` }} />
          </div>
          <span className="mono text-[10px] text-slate-400 tabular-nums w-5 text-right flex-shrink-0">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Surface module card ---------- */
function ModuleCard({ surface, entityId, icon: I, title, blurb, stat, statLabel, children, accent }) {
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden flex flex-col hover:border-slate-300 transition-colors">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-md bg-slate-900 text-white flex items-center justify-center"><I size={16} /></div>
            <div>
              <div className="text-[15px] font-semibold text-slate-900 leading-tight">{title}</div>
              <div className="mono text-[9px] uppercase tracking-[0.13em] text-slate-400 mt-0.5">/{surface}/{entityId}</div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[22px] font-semibold text-slate-900 tracking-tightish leading-none tabular-nums">{stat}</div>
            <div className="mono text-[9px] uppercase tracking-[0.1em] text-slate-400 mt-1">{statLabel}</div>
          </div>
        </div>
        <p className="text-[12px] text-slate-500 leading-snug mt-3">{blurb}</p>
      </div>
      <div className="px-5 pb-4 flex-1">{children}</div>
      <button onClick={() => navTo(surface, entityId)}
        className="px-5 py-3 border-t border-slate-200 flex items-center justify-between text-[12.5px] font-medium text-slate-900 hover:bg-slate-50 transition-colors group">
        <span>Open {title}</span>
        <Icon.ArrowRight size={15} className="text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
      </button>
    </div>
  );
}

function ViewCareer({ entity }) {
  const latest = [...EVENTS].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 4);
  const topPath = [...ADVANCEMENT_PATHS].sort((a, b) => b.match - a.match)[0];
  const aboveMedian = DIMENSIONS.filter(d => d.value >= d.median).length;
  return (
    <div className="max-w-[1340px] mx-auto px-6 py-9 space-y-9">
      {/* Hero */}
      <div className="rise grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8">
          <EntityHeader entity={entity} surfaceLabel="Career OS · Home"
            surfaceDesc="One home for a professional career: the memory of everything that happened, the reputation it accumulated, and the mobility it unlocks. All projected from a single ledger the clinician owns — portable across every employer, state, and specialty." />
        </div>
        <div className="lg:col-span-4">
          <div className="border border-slate-200 rounded-lg bg-white p-4">
            <Eyebrow className="mb-2.5">The owned ledger</Eyebrow>
            <KV k="Ledger" v={<span className="mono text-[11px]">{entity.ledgerId}</span>} />
            <KV k="Owned since" v={entity.ownerSince} mono />
            <KV k="Events" v={`${EVENTS.length} verified`} />
            <KV k="Held by" v="the clinician · not an employer" />
            <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-700">
              <Icon.ShieldCheck size={13} /><span>Portable · recomputes, never resets</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ladder */}
      <section className="rise" style={{ animationDelay: '60ms' }}>
        <LadderStrip />
      </section>

      {/* Three modules */}
      <section className="rise" style={{ animationDelay: '120ms' }}>
        <SectionHeader n="01" title="Your career, three lenses" sub="One ledger, projected three ways — each a working surface." right="memory · reputation · mobility" />
        <div className="grid lg:grid-cols-3 gap-5">
          <ModuleCard surface="memory" entityId={entity.id} icon={Icon.Book} title="Memory"
            blurb="Every dated, sourced event — a timeline projected from the ledger." stat={EVENTS.length} statLabel="events">
            <div className="space-y-1.5 mt-1">
              {latest.map(e => (
                <div key={e.id} className="flex items-center gap-2 text-[11.5px]">
                  <span className="mono text-[10px] text-slate-400 tabular-nums w-12 flex-shrink-0">{e.date}</span>
                  <span className="text-slate-700 truncate flex-1">{e.title}</span>
                </div>
              ))}
            </div>
          </ModuleCard>

          <ModuleCard surface="reputation" entityId={entity.id} icon={Icon.Award} title="Reputation"
            blurb="Accumulated credibility across seven dimensions — a profile, never a score." stat={`${aboveMedian}/7`} statLabel="above median">
            <div className="mt-1"><MiniProfile /></div>
          </ModuleCard>

          <ModuleCard surface="mobility" entityId={entity.id} icon={Icon.Route} title="Mobility"
            blurb="What the verified profile unlocks now, and the paths it projects toward." stat={READINESS.score} statLabel="readiness">
            <div className="mt-1 space-y-2.5">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-slate-500">Qualify today</span>
                <span className="mono text-slate-900">14 requisitions</span>
              </div>
              <div className="border border-slate-200 rounded-md p-2.5 bg-slate-50/60">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-slate-900 truncate">{topPath.title}</span>
                  <span className="mono text-[12px] text-slate-900 tabular-nums">{topPath.match}%</span>
                </div>
                <div className="mt-1.5 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-900 rounded-full" style={{ width: `${topPath.match}%` }} />
                </div>
                <div className="mono text-[9px] uppercase tracking-[0.1em] text-slate-400 mt-1.5">strongest path · {topPath.horizon}</div>
              </div>
            </div>
          </ModuleCard>
        </div>
      </section>

      {/* Combined snapshot: recent trust + recognition */}
      <section className="rise grid lg:grid-cols-12 gap-6" style={{ animationDelay: '180ms' }}>
        <div className="lg:col-span-7">
          <SectionHeader n="02" title="Recent ledger activity" sub="The most recent reads and corroborations." />
          <div className="border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
            {TRUST_HISTORY.slice(0, 5).map((h, i) => {
              const tone = { ok: 'bg-emerald-500', warn: 'bg-amber-500', info: 'bg-indigo-500', muted: 'bg-slate-300' }[h.tone];
              return (
                <div key={i} className="px-5 py-3 flex items-start gap-3">
                  <span className={cn('h-2 w-2 rounded-full mt-1.5 flex-shrink-0', tone)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-slate-900">{h.source}</span>
                      <span className="mono text-[10px] text-slate-400 ml-auto tabular-nums">{h.t}</span>
                    </div>
                    <p className="text-[12px] text-slate-600 leading-snug mt-0.5">{h.msg}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="lg:col-span-5">
          <SectionHeader n="03" title="Conferred recognition" sub="Honors that amplify the record." />
          <div className="border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
            {RECOGNITION.map(r => (
              <div key={r.id} className="px-5 py-3.5 flex items-start gap-3">
                <div className="h-8 w-8 rounded-md bg-violet-50 ring-1 ring-inset ring-violet-600/20 flex items-center justify-center flex-shrink-0">
                  <Icon.Award size={14} className="text-violet-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold text-slate-900 leading-tight">{r.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{r.conferrer} · {r.year}</div>
                </div>
                <span className="mono text-[9px] uppercase tracking-[0.08em] text-violet-700 flex-shrink-0">{r.selectivity}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-slate-200 pt-5 text-center">
        <p className="text-[12px] text-slate-500 max-w-[68ch] mx-auto leading-[1.6]">
          VitalCV Career OS makes a career what it should always have been — <span className="text-slate-900 font-medium">credibility earned and owned, not attention won or held by an employer</span>. Memory, Reputation, and Mobility are three projections of one portable ledger.
        </p>
      </div>
    </div>
  );
}

window.ViewCareer = ViewCareer;
