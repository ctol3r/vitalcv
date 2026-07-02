// SURFACE — /opportunities/:id — OPPORTUNITY CENTER (Wave 1000)
// Aggregates internal recs, recruiter interest, org invitations, mobility, readiness.
// Every recommendation answers two questions: Why now. Why you.

const LANES = [
  { id: 'all',        label: 'All' },
  { id: 'recruiter',  label: 'Recruiter interest' },
  { id: 'internal',   label: 'Internal' },
  { id: 'invitation', label: 'Invitations' },
  { id: 'mobility',   label: 'Mobility' },
  { id: 'academic',   label: 'Academic' },
];

const TONE = {
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  slate:  'bg-slate-100 text-slate-700 ring-slate-300',
};

function OpportunityCard({ o, entityId }) {
  return (
    <div className={cn('border rounded-lg bg-white overflow-hidden transition-colors', o.hot ? 'border-slate-900' : 'border-slate-200 hover:border-slate-300')}>
      <div className="px-5 py-4">
        <div className="flex items-start gap-4">
          <div className={cn('h-11 w-11 rounded-lg ring-1 ring-inset flex items-center justify-center flex-shrink-0', TONE[o.tone])}><o.Icon size={19} /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="mono text-[9.5px] uppercase tracking-[0.13em] text-slate-400">{o.kind}</span>
              {o.hot && <span className="mono text-[8.5px] uppercase tracking-[0.12em] bg-slate-900 text-white rounded px-1.5 py-0.5">time-sensitive</span>}
            </div>
            <div className="text-[15.5px] font-semibold text-slate-900 leading-tight mt-1">{o.role}</div>
            <div className="text-[12.5px] text-slate-500 mt-0.5">{o.org} · {o.location}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[24px] font-semibold text-slate-900 tabular-nums leading-none">{o.match}<span className="text-[13px] text-slate-400">%</span></div>
            <div className="mono text-[9px] uppercase tracking-[0.1em] text-slate-400 mt-1">match</div>
          </div>
        </div>

        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
            <div className="flex items-center gap-1.5 mono text-[9.5px] uppercase tracking-[0.12em] text-slate-500 mb-1.5"><Icon.Clock size={11} />Why now</div>
            <p className="text-[12px] text-slate-700 leading-[1.5]">{o.whyNow}</p>
          </div>
          <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
            <div className="flex items-center gap-1.5 mono text-[9.5px] uppercase tracking-[0.12em] text-slate-500 mb-1.5"><Icon.User size={11} />Why you</div>
            <p className="text-[12px] text-slate-700 leading-[1.5]">{o.whyYou}</p>
          </div>
        </div>
      </div>
      <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-3 bg-slate-50/40">
        <span className="text-[12px] text-slate-600"><span className="mono text-slate-900">{o.comp}</span></span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" iconLeft={<Icon.Bookmark size={13} />}>Save</Button>
          <Button variant="primary" size="sm" iconRight={<Icon.ArrowRight size={13} />}>Explore</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Future readiness ---------- */
function FutureReadiness() {
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.Compass} title="Future readiness" right={<Eyebrow>where you're headed</Eyebrow>} />
      <div className="divide-y divide-slate-100">
        {FUTURE_READINESS.map(f => (
          <div key={f.id} className="px-5 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] font-semibold text-slate-900">{f.label}</span>
              <span className={cn('mono text-[9px] uppercase tracking-[0.1em] rounded px-1.5 py-0.5', f.window === 'open now' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>{f.window}</span>
            </div>
            <div className="mt-2 flex items-center gap-2.5">
              <Bar value={f.ready} h="h-1.5" tone={f.ready === 100 ? 'bg-emerald-600' : 'bg-slate-900'} />
              <span className="mono text-[10px] text-slate-400 tabular-nums w-7 text-right flex-shrink-0">{f.ready}%</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug mt-1.5">{f.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Missing evidence (what would unlock more) ---------- */
function UnlockPanel() {
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.Lock} title="What unlocks more" right={<Eyebrow>close the gap</Eyebrow>} />
      <div className="divide-y divide-slate-100">
        {MISSING_EVIDENCE.map(m => (
          <div key={m.id} className="px-5 py-3.5 flex items-start gap-3">
            <div className="h-7 w-7 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5"><Icon.Plus size={13} className="text-slate-600" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12.5px] font-semibold text-slate-900 leading-tight">{m.label}</span>
                <span className="mono text-[8.5px] uppercase tracking-[0.1em] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{m.owner}</span>
              </div>
              <p className="text-[11.5px] text-slate-500 leading-snug mt-0.5">{m.detail}</p>
              <div className="mt-1.5 text-[11px] text-emerald-700 inline-flex items-center gap-1"><Icon.ArrowUpRight size={11} />{m.impact}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ViewOpportunities({ entity }) {
  const [lane, setLane] = React.useState('all');
  const shown = lane === 'all' ? OPPORTUNITIES : OPPORTUNITIES.filter(o => o.lane === lane);
  return (
    <div className="max-w-[1340px] mx-auto px-6 py-9">
      <div className="rise mb-7">
        <SurfaceIntro eyebrow="Opportunity Center · /career/opportunities"
          title={<>What's open to you — <span className="text-slate-400">and why.</span></>}
          sub="Every recruiter, internal track, invitation, and move surfaced in one place — matched to your verified record. Each one explains why now, and why you. No spray of listings; only what fits."
          right={<div className="text-right"><div className="text-[26px] font-semibold text-slate-900 tabular-nums leading-none">{OPPORTUNITIES.length}</div><div className="mono text-[9px] uppercase tracking-[0.1em] text-slate-400 mt-1">open now</div></div>} />
      </div>

      {/* Lane filters */}
      <div className="rise flex items-center gap-1.5 mb-6 flex-wrap" style={{ animationDelay: '50ms' }}>
        {LANES.map(l => {
          const n = l.id === 'all' ? OPPORTUNITIES.length : OPPORTUNITIES.filter(o => o.lane === l.id).length;
          return (
            <button key={l.id} onClick={() => setLane(l.id)}
              className={cn('px-3 h-8 rounded-md text-[12px] font-medium transition-colors inline-flex items-center gap-1.5',
                lane === l.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300')}>
              {l.label}{n > 0 && <span className={cn('mono text-[10px] tabular-nums', lane === l.id ? 'text-slate-400' : 'text-slate-400')}>{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Feed */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          {shown.map((o, i) => (
            <div key={o.id} className="rise" style={{ animationDelay: `${i * 50}ms` }}><OpportunityCard o={o} entityId={entity.id} /></div>
          ))}
          {shown.length === 0 && <div className="border border-dashed border-slate-300 rounded-lg p-10 text-center text-[13px] text-slate-500">No opportunities in this lane right now.</div>}
        </div>

        {/* Rails */}
        <aside className="col-span-12 lg:col-span-4 space-y-5">
          <div className="rise" style={{ animationDelay: '80ms' }}><FutureReadiness /></div>
          <div className="rise" style={{ animationDelay: '120ms' }}><UnlockPanel /></div>
          <div className="rise border border-slate-900 rounded-lg bg-slate-950 text-white p-5" style={{ animationDelay: '160ms' }}>
            <Icon.ShieldCheck size={18} className="text-emerald-400" />
            <p className="text-[12.5px] text-slate-300 leading-[1.6] mt-3">Every match is computed against your <span className="text-white font-medium">verified, owned record</span> — never a scraped profile. Recruiters see what you choose to share, anchored to the same ledger you hold.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

window.ViewOpportunities = ViewOpportunities;
