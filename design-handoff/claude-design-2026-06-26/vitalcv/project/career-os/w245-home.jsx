// W245 · D1 — Career Home (/career)
// The 60-second answer: Who am I · What evidence exists · What's missing ·
// How trusted am I · What should I do next. Every panel opens its full experience.

/* small reusable: an "answer panel" — a question, a one-glance answer, a deep link */
function AnswerPanel({ q, section, Icon: I, stat, statLabel, children, cta }) {
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden flex flex-col hover:border-slate-300 transition-colors">
      <div className="px-5 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-md bg-slate-900 text-white flex items-center justify-center flex-shrink-0"><I size={15} /></div>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-slate-900 leading-tight">{q}</div>
              <div className="mono text-[9px] uppercase tracking-[0.12em] text-slate-400 mt-0.5">/career/{section}</div>
            </div>
          </div>
          {stat != null && (
            <div className="text-right flex-shrink-0">
              <div className="text-[20px] font-semibold text-slate-900 leading-none tabular-nums">{stat}</div>
              <div className="mono text-[8.5px] uppercase tracking-[0.1em] text-slate-400 mt-1">{statLabel}</div>
            </div>
          )}
        </div>
      </div>
      <div className="px-5 py-4 flex-1">{children}</div>
      <button onClick={() => go245(section)}
        className="px-5 py-2.5 border-t border-slate-200 flex items-center justify-between text-[12px] font-medium text-slate-900 hover:bg-slate-50 transition-colors group">
        <span>{cta}</span>
        <Icon.ArrowRight size={14} className="text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
      </button>
    </div>
  );
}

function ViewHome({ entity }) {
  const events = window.EVENTS;
  const verifiedCount = events.filter(e => e.state === 'verified' || e.state === 'floor').length;
  const expiring = window.CREDENTIALS.filter(c => c.status === 'expiring');
  const missing = window.MISSING_EVIDENCE;
  const latest = [...events].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 4);
  const topActions = window.NEXT_ACTIONS.slice(0, 3);
  const h = computeHealth();

  return (
    <div className="max-w-[1340px] mx-auto px-6 py-9 space-y-8">

      {/* ── Who am I ── */}
      <div className="rise grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7">
          <EntityHeader entity={entity} surfaceLabel="Career OS · Home"
            surfaceDesc="One screen to know your standing: the evidence behind you, what is missing, how trusted you are, and what to do next — all projected from a single ledger you own, portable across every employer, state, and specialty." />
        </div>
        <div className="lg:col-span-5">
          <div className="border border-slate-200 rounded-lg bg-white p-4">
            <Eyebrow className="mb-2.5">The owned ledger</Eyebrow>
            <KV k="Ledger" v={<span className="mono text-[11px]">{entity.ledgerId}</span>} />
            <KV k="Owned since" v={entity.ownerSince} mono />
            <KV k="On record" v={`${events.length} events · ${window.RECOGNITION.length} honors`} />
            <KV k="Held by" v="the clinician · not an employer" />
            <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-700">
              <Icon.ShieldCheck size={13} /><span>Portable · recomputes, never resets</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Career Health (the composite answer) ── */}
      <section className="rise" style={{ animationDelay: '60ms' }}>
        <CareerHealthCard entity={entity} variant="full" onOpen={() => go245('evidence')} />
      </section>

      {/* ── The four questions, answered at a glance ── */}
      <section className="rise" style={{ animationDelay: '120ms' }}>
        <SectionHeader n="01" title="Know your standing in 60 seconds"
          sub="Four questions every clinician needs answered — each opens its full experience." right="evidence · timeline · trust · actions" />
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">

          {/* What evidence exists / missing */}
          <AnswerPanel q="What evidence exists?" section="evidence" Icon={Icon.FileText}
            stat={verifiedCount} statLabel="verified" cta="Open Evidence">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-slate-500 inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Source-backed</span>
                <span className="mono text-slate-900">{verifiedCount} events</span>
              </div>
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-slate-500 inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Expiring &lt; 12mo</span>
                <span className="mono text-slate-900">{expiring.length} credentials</span>
              </div>
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-slate-500 inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" />Missing / gated</span>
                <span className="mono text-slate-900">{missing.length} items</span>
              </div>
            </div>
          </AnswerPanel>

          {/* What happened (timeline) */}
          <AnswerPanel q="What happened?" section="timeline" Icon={Icon.Book}
            stat={events.length} statLabel="events" cta="Open Timeline">
            <div className="space-y-1.5">
              {latest.map(e => (
                <div key={e.id} className="flex items-center gap-2 text-[11.5px]">
                  <span className="mono text-[10px] text-slate-400 tabular-nums w-12 flex-shrink-0">{e.date}</span>
                  <span className="text-slate-700 truncate flex-1">{e.title}</span>
                </div>
              ))}
            </div>
          </AnswerPanel>

          {/* How trusted */}
          <AnswerPanel q="How trusted am I?" section="trust" Icon={Icon.ShieldCheck}
            stat={h.trustStrength} statLabel="strength" cta="Open Trust">
            <div className="space-y-2">
              {window.TRUST_DIMENSIONS.map(d => (
                <div key={d.key} className="flex items-center gap-2.5">
                  <span className="text-[10.5px] text-slate-600 w-[74px] flex-shrink-0">{d.label}</span>
                  <div className="relative flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-600" style={{ width: `${d.value}%` }} />
                  </div>
                  <span className="mono text-[9.5px] text-slate-400 tabular-nums w-5 text-right flex-shrink-0">{d.value}</span>
                </div>
              ))}
            </div>
          </AnswerPanel>

          {/* What next */}
          <AnswerPanel q="What should I do next?" section="evidence" Icon={Icon.Target}
            stat={window.NEXT_ACTIONS.length} statLabel="actions" cta="See all actions">
            <div className="space-y-2">
              {topActions.map(a => {
                const t = ACTION_TIER[a.tier];
                return (
                  <div key={a.id} className="flex items-start gap-2">
                    <span className={cn('h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0', t.dot)} />
                    <span className="text-[11.5px] text-slate-700 leading-snug">{a.title}</span>
                  </div>
                );
              })}
            </div>
          </AnswerPanel>
        </div>
      </section>

      {/* ── Next actions (full width, prioritized) ── */}
      <section className="rise" style={{ animationDelay: '180ms' }}>
        <SectionHeader n="02" title="What to do next" sub="Prioritized by what unblocks the most — each tied to an owner and a concrete impact." />
        <div className="grid md:grid-cols-2 gap-4">
          {window.NEXT_ACTIONS.map(a => {
            const t = ACTION_TIER[a.tier];
            const AI = Icon[a.icon] || Icon.Dot;
            return (
              <div key={a.id} className="border border-slate-200 rounded-lg bg-white p-4 flex items-start gap-3.5">
                <div className="h-9 w-9 rounded-md bg-slate-50 ring-1 ring-inset ring-slate-200 flex items-center justify-center flex-shrink-0">
                  <AI size={16} className="text-slate-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-slate-900 leading-tight">{a.title}</span>
                    <span className={cn('mono text-[8.5px] uppercase tracking-[0.1em] font-medium rounded-full ring-1 ring-inset px-1.5 py-0.5', t.chip)}>{t.label}</span>
                  </div>
                  <p className="text-[11.5px] text-slate-500 leading-snug mt-1.5">{a.why}</p>
                  <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
                    <span className="mono text-[10px] text-slate-900">{a.impact}</span>
                    <span className="text-[10.5px] text-slate-400 inline-flex items-center gap-1">
                      <Icon.User size={11} />{a.owner}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Recognition (esteem conferred) ── */}
      <section className="rise" style={{ animationDelay: '240ms' }}>
        <SectionHeader n="03" title="Recognition on record" sub="Conferred honors — cannot be self-claimed; each amplifies the verified evidence beneath it." right={`${window.RECOGNITION.length} conferred`} />
        <div className="grid sm:grid-cols-3 gap-4">
          {window.RECOGNITION.map(r => (
            <div key={r.id} className="border border-slate-200 rounded-lg bg-white p-4">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="h-8 w-8 rounded-md bg-violet-50 ring-1 ring-inset ring-violet-600/20 flex items-center justify-center">
                  <Icon.Award size={15} className="text-violet-700" />
                </div>
                <span className="mono text-[9px] uppercase tracking-[0.08em] text-violet-700">{r.selectivity}</span>
              </div>
              <div className="text-[13px] font-semibold text-slate-900 leading-tight">{r.title}</div>
              <div className="text-[11px] text-slate-500 mt-1">{r.conferrer}</div>
              <div className="mono text-[10px] text-slate-400 mt-2 tabular-nums">{r.year}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="border-t border-slate-200 pt-5 text-center">
        <p className="text-[12px] text-slate-500 max-w-[70ch] mx-auto leading-[1.6]">
          One ledger, owned by the clinician — <span className="text-slate-900 font-medium">evidence, trust, and timeline are three reads of the same portable record</span>. Nothing here was won by attention; all of it was earned and verified.
        </p>
      </div>
    </div>
  );
}

window.ViewHome = ViewHome;
