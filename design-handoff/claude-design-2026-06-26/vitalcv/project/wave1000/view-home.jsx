// SURFACE — /career/:id — CAREER HOME (Wave 1000)
// Replaces the dashboard. Answers: Where am I? What changed? What next? What's open?
// Shows: Timeline · Trust · Recognition · Organizations · Intelligence · Goals · Network.

/* ---------- The four orientation answers ---------- */
function OrientationCard({ q, Icon: I, headline, sub, foot, tone = 'slate' }) {
  const toneRing = {
    slate: 'text-slate-700', emerald: 'text-emerald-700', indigo: 'text-indigo-700', violet: 'text-violet-700',
  }[tone];
  return (
    <div className="border border-slate-200 rounded-lg bg-white p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <I size={14} className={toneRing} />
        <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-400">{q}</span>
      </div>
      <div className="text-[20px] font-semibold text-slate-900 tracking-tightish leading-[1.1]">{headline}</div>
      <div className="text-[12px] text-slate-500 mt-1 leading-snug">{sub}</div>
      {foot && <div className="mt-auto pt-3 text-[11px] text-slate-500 leading-snug">{foot}</div>}
    </div>
  );
}

/* ---------- "What changed" feed ---------- */
function ChangeFeed() {
  const toneDot = { emerald: 'bg-emerald-500', violet: 'bg-violet-500', indigo: 'bg-indigo-500', amber: 'bg-amber-500' };
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.Activity} title="What changed" right={<Eyebrow>since you last looked</Eyebrow>} />
      <div className="divide-y divide-slate-100">
        {CAREER_CHANGES.map(c => (
          <div key={c.id} className="px-5 py-3.5 flex items-start gap-3">
            <span className={cn('h-2 w-2 rounded-full mt-1.5 flex-shrink-0', toneDot[c.tone])} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <c.Icon size={13} className="text-slate-500 flex-shrink-0" />
                <span className="text-[12.5px] font-semibold text-slate-900 leading-tight">{c.title}</span>
                <span className="mono text-[10px] text-slate-400 ml-auto whitespace-nowrap">{c.when}</span>
              </div>
              <p className="text-[11.5px] text-slate-500 leading-snug mt-0.5 pl-5">{c.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Next best actions ---------- */
function NextActions() {
  const pri = { high: 'bg-slate-900 text-white', med: 'bg-slate-100 text-slate-600' };
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.Target} title="What to do next" right={<Eyebrow>ranked by leverage</Eyebrow>} />
      <div className="divide-y divide-slate-100">
        {NEXT_ACTIONS.map(a => (
          <div key={a.id} className="px-5 py-4 flex items-start gap-3.5 hover:bg-slate-50/60 transition-colors">
            <div className="h-9 w-9 rounded-md bg-slate-900 text-white flex items-center justify-center flex-shrink-0"><a.Icon size={16} /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13.5px] font-semibold text-slate-900 leading-tight">{a.title}</span>
                <span className={cn('mono text-[8.5px] uppercase tracking-[0.12em] rounded px-1.5 py-0.5', pri[a.priority])}>{a.priority === 'high' ? 'high leverage' : 'do soon'}</span>
              </div>
              <p className="text-[12px] text-slate-600 leading-[1.55] mt-1">{a.why}</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="mono text-[10px] uppercase tracking-[0.1em] text-slate-400">{DIM[a.dim].label}</span>
                <span className="text-slate-300">·</span>
                <span className="text-[11px] text-slate-500">{a.effort}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Compact timeline rail ---------- */
function TimelineRail({ entityId }) {
  const ordered = [...EVENTS].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.Book} title="Career timeline" right={<button onClick={() => navTo('memory', entityId)} className="mono text-[10px] uppercase tracking-[0.1em] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1">Full memory <Icon.ArrowRight size={11} /></button>} />
      <div className="px-5 py-4 space-y-0">
        {ordered.map((e, i) => (
          <div key={e.id} className="relative pl-7 pb-4 last:pb-0">
            {i < ordered.length - 1 && <span className="absolute left-[7px] top-4 bottom-0 w-px bg-slate-200" />}
            <span className={cn('absolute left-[2px] top-1 h-3 w-3 rounded-full ring-2 ring-white', e.state === 'adverse' ? 'bg-rose-500' : e.dir === 'floor' ? 'bg-slate-900' : 'bg-white border-2 border-slate-900')} />
            <div className="flex items-baseline gap-2">
              <span className="mono text-[10px] text-slate-400 tabular-nums w-12 flex-shrink-0">{e.date}</span>
              <span className="text-[12.5px] font-medium text-slate-900 leading-tight">{e.title}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 pl-14">{e.org}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Trust status ---------- */
function TrustStatus() {
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.ShieldCheck} title="Trust status" right={<Chip state="verified" size="sm">Current</Chip>} />
      <div className="px-5 py-4">
        <div className="flex items-end gap-3">
          <div className="text-[34px] font-semibold text-slate-900 tracking-tight leading-none tabular-nums">{CAREER_STATE.trustScore}</div>
          <div className="text-[12px] text-slate-500 leading-tight pb-1">composite<br/>trust index</div>
        </div>
        <p className="text-[11.5px] text-slate-500 mt-2.5 leading-snug">{CAREER_STATE.trustNote}</p>
        <div className="mt-4 space-y-2.5">
          {DIMENSIONS.slice(0, 4).map(d => (
            <div key={d.key} className="flex items-center gap-2.5">
              <span className="text-[11px] text-slate-600 w-[74px] flex-shrink-0">{d.label}</span>
              <Bar value={d.value} median={d.median} h="h-2" />
              <span className="mono text-[10px] text-slate-400 tabular-nums w-5 text-right flex-shrink-0">{d.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="h-px w-3 border-t border-dashed border-slate-400" />field median</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Current organizations ---------- */
function OrgList() {
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.Building} title="Current organizations" right={<Eyebrow>{ORGANIZATIONS.filter(o => o.status === 'active').length} active</Eyebrow>} />
      <div className="divide-y divide-slate-100">
        {ORGANIZATIONS.map(o => (
          <div key={o.id} className="px-5 py-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0"><IconFor name={o.icon} size={15} className="text-slate-700" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-slate-900 leading-tight truncate">{o.name}</span>
                {o.status === 'active' ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" /> : <span className="mono text-[8.5px] uppercase tracking-[0.1em] text-slate-400 flex-shrink-0">past</span>}
              </div>
              <div className="text-[11.5px] text-slate-500 mt-0.5 truncate">{o.role}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="mono text-[10px] uppercase tracking-[0.1em] text-slate-400">{o.kind}</div>
              <div className="mono text-[10px] text-slate-500 tabular-nums mt-0.5">since {o.since}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Career intelligence ---------- */
function CareerIntelligence() {
  const toneCls = { emerald: 'text-emerald-700 bg-emerald-50 ring-emerald-600/20', indigo: 'text-indigo-700 bg-indigo-50 ring-indigo-600/20', slate: 'text-slate-700 bg-slate-100 ring-slate-300' };
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.Sparkles} title="Career intelligence" right={<Eyebrow>read from your ledger</Eyebrow>} />
      <div className="divide-y divide-slate-100">
        {INSIGHTS.map(s => (
          <div key={s.id} className="px-5 py-3.5 flex items-start gap-3">
            <div className={cn('h-7 w-7 rounded-md ring-1 ring-inset flex items-center justify-center flex-shrink-0', toneCls[s.tone])}><s.Icon size={14} /></div>
            <div className="min-w-0 flex-1">
              <span className="mono text-[9px] uppercase tracking-[0.13em] text-slate-400">{s.kind}</span>
              <p className="text-[12.5px] text-slate-700 leading-[1.5] mt-0.5">{s.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Active goals ---------- */
function GoalCard({ g }) {
  return (
    <div className="border border-slate-200 rounded-lg bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[13px] font-semibold text-slate-900 leading-snug pr-2">{g.title}</div>
        <div className="text-right flex-shrink-0">
          <div className="text-[18px] font-semibold text-slate-900 tabular-nums leading-none">{g.progress}<span className="text-[12px] text-slate-400">%</span></div>
          <div className="mono text-[9px] uppercase tracking-[0.1em] text-slate-400 mt-0.5">{g.horizon}</div>
        </div>
      </div>
      <div className="mt-3"><Bar value={g.progress} h="h-1.5" /></div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {g.steps.map((s, i) => (
          <span key={i} className={cn('inline-flex items-center gap-1 text-[10.5px] rounded px-1.5 py-0.5',
            s.done ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
            {s.done ? <Icon.Check size={10} /> : <Icon.Dot size={8} />}{s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Professional network preview ---------- */
function NetworkPreview() {
  const strength = { strong: 'bg-slate-900', medium: 'bg-slate-500', emerging: 'bg-slate-300' };
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.Network} title="Professional network" right={<Eyebrow>{RELATIONSHIPS.filter(r => r.willRef).length} will attest</Eyebrow>} />
      <div className="divide-y divide-slate-100">
        {RELATIONSHIPS.slice(0, 4).map(r => (
          <div key={r.id} className="px-5 py-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center mono text-[11px] font-semibold flex-shrink-0">{r.initials}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-slate-900 leading-tight truncate">{r.name}</div>
              <div className="text-[11px] text-slate-500 truncate">{r.role}</div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="mono text-[9px] uppercase tracking-[0.1em] text-slate-400">{r.tie}</span>
              <span className={cn('h-1.5 w-8 rounded-full', strength[r.strength])} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ViewHome({ entity }) {
  return (
    <div className="max-w-[1340px] mx-auto px-6 py-9 space-y-9">
      {/* Hero / identity */}
      <div className="rise grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8">
          <EntityHeader entity={entity} surfaceLabel="Career Home · Wave 1000"
            surfaceDesc="The home screen for a professional life. Not a dashboard you visit when you change jobs — the place a clinician's career lives, every day, from education through retirement. Everything here is projected from one portable ledger you own." />
        </div>
        <div className="lg:col-span-4">
          <div className="border border-slate-200 rounded-lg bg-white p-4">
            <Eyebrow className="mb-2.5">The owned ledger</Eyebrow>
            <KV k="Ledger" v={<span className="mono text-[11px]">{entity.ledgerId}</span>} />
            <KV k="Owned since" v={entity.ownerSince} mono />
            <KV k="Events" v={`${EVENTS.length} verified`} />
            <KV k="Held by" v="the clinician" />
            <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-700">
              <Icon.ShieldCheck size={13} /><span>Portable · recomputes, never resets</span>
            </div>
          </div>
        </div>
      </div>

      {/* Four orientation answers */}
      <section className="rise" style={{ animationDelay: '60ms' }}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <OrientationCard q="Where am I" Icon={Icon.Compass} headline={CAREER_STATE.stage.split(' → ')[1] || CAREER_STATE.stage} sub={CAREER_STATE.stageNote} foot="Stage on the career arc, read from milestones." />
          <OrientationCard q="How trusted" Icon={Icon.ShieldCheck} tone="emerald" headline={CAREER_STATE.trustLabel} sub={CAREER_STATE.trustNote} foot={`Composite index ${CAREER_STATE.trustScore}/100.`} />
          <OrientationCard q="Where I stand" Icon={Icon.Gauge} headline={CAREER_STATE.standing} sub={CAREER_STATE.standingNote} foot="A profile vs. the field — never a named ranking." />
          <OrientationCard q="Which way" Icon={Icon.TrendingUp} tone="indigo" headline="Rising" sub={CAREER_STATE.momentumNote} foot="Momentum across the seven dimensions." />
        </div>
      </section>

      {/* What changed · what next */}
      <section className="rise grid lg:grid-cols-12 gap-6" style={{ animationDelay: '120ms' }}>
        <div className="lg:col-span-5"><ChangeFeed /></div>
        <div className="lg:col-span-7"><NextActions /></div>
      </section>

      {/* Timeline · Trust · Organizations */}
      <section className="rise" style={{ animationDelay: '160ms' }}>
        <SectionHeader n="01" title="Your career, at a glance" sub="The spine, the standing, and the affiliations — three live projections of one ledger." right="timeline · trust · organizations" />
        <div className="grid lg:grid-cols-3 gap-5">
          <TimelineRail entityId={entity.id} />
          <TrustStatus />
          <OrgList />
        </div>
      </section>

      {/* Intelligence · Goals · Network */}
      <section className="rise" style={{ animationDelay: '200ms' }}>
        <SectionHeader n="02" title="What the record is telling you" sub="Intelligence read off the ledger, the goals in motion, and the people who can attest." right="intelligence · goals · network" />
        <div className="grid lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5"><CareerIntelligence /></div>
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center justify-between">
              <Eyebrow>Active goals</Eyebrow>
              <button onClick={() => navTo('command', entity.id)} className="mono text-[10px] uppercase tracking-[0.1em] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1">Open workspace <Icon.ArrowRight size={11} /></button>
            </div>
            {GOALS.map(g => <GoalCard key={g.id} g={g} />)}
          </div>
          <div className="lg:col-span-3"><NetworkPreview /></div>
        </div>
      </section>

      {/* Opportunities teaser */}
      <section className="rise" style={{ animationDelay: '240ms' }}>
        <div className="border border-slate-900 rounded-lg bg-slate-950 text-white overflow-hidden">
          <div className="px-6 py-5 flex items-center justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-11 w-11 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0"><Icon.Zap size={20} /></div>
              <div className="min-w-0">
                <div className="text-[16px] font-semibold leading-tight">{OPPORTUNITIES.length} opportunities are open to you right now</div>
                <div className="text-[12.5px] text-slate-400 mt-0.5">Recruiter interest, internal recommendations, and an organization invitation — each one explains why now, and why you.</div>
              </div>
            </div>
            <Button variant="outline" className="bg-white text-slate-900 border-white hover:bg-slate-100 flex-shrink-0" iconRight={<Icon.ArrowRight size={14} />} onClick={() => navTo('opportunities', entity.id)}>
              Open the Opportunity Center
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

window.ViewHome = ViewHome;
