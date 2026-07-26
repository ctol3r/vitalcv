// SURFACE — /legacy/:id — PROFESSIONAL LEGACY (Wave 1000)
// The long-term story of a clinician's career. Impact · organizations · teaching ·
// research · leadership · mentorship. Privacy-preserving where it must be.

/* ---------- Impact tiles ---------- */
function ImpactGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {LEGACY_IMPACT.map(m => (
        <div key={m.id} className="border border-slate-200 rounded-lg bg-white p-5">
          <m.Icon size={18} className="text-slate-400" />
          <div className="text-[34px] font-semibold text-slate-900 tracking-tight leading-none tabular-nums mt-4">{m.metric}</div>
          <div className="text-[13px] font-medium text-slate-700 mt-2">{m.label}</div>
          <div className="text-[11.5px] text-slate-500 mt-0.5">{m.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Career chapters (the narrative arc) ---------- */
function ChapterStrip() {
  return (
    <div className="relative">
      <div className="space-y-4">
        {LEGACY_CHAPTERS.map((c, i) => (
          <div key={c.id} className={cn('relative rounded-lg border overflow-hidden', c.projected ? 'border-dashed border-slate-300 bg-slate-50/50' : 'border-slate-200 bg-white')}>
            <div className="grid md:grid-cols-12">
              <div className={cn('md:col-span-3 p-5 flex flex-col justify-between', c.projected ? 'bg-slate-100/60' : 'bg-slate-950 text-white')}>
                <div>
                  <div className={cn('mono text-[9.5px] uppercase tracking-[0.16em]', c.projected ? 'text-slate-400' : 'text-slate-400')}>Chapter {String(i + 1).padStart(2, '0')}</div>
                  <div className={cn('text-[20px] font-semibold tracking-tightish mt-2 leading-tight', c.projected ? 'text-slate-700' : 'text-white')}>{c.era}</div>
                </div>
                <div className={cn('mono text-[11px] tabular-nums mt-4', c.projected ? 'text-slate-400' : 'text-slate-500')}>{c.years}</div>
              </div>
              <div className="md:col-span-9 p-5">
                <div className="text-[15px] font-semibold text-slate-900 leading-snug">{c.headline}</div>
                <p className="text-[12.5px] text-slate-600 leading-[1.6] mt-2 max-w-[78ch]">{c.body}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.anchors.map((a, j) => (
                    <span key={j} className={cn('mono text-[10px] uppercase tracking-[0.06em] rounded px-2 py-0.5', c.projected ? 'bg-white border border-slate-200 text-slate-400' : 'bg-slate-100 text-slate-600')}>{a}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Mentorship ---------- */
function MentorshipPanel() {
  const total = MENTORSHIP.reduce((s, m) => s + m.count, 0);
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.Users} title="Mentorship & teaching" right={<span className="mono text-[11px] text-slate-900 tabular-nums">{total} reached</span>} />
      <div className="divide-y divide-slate-100">
        {MENTORSHIP.map(m => (
          <div key={m.id} className="px-5 py-3.5 flex items-center gap-3">
            <div className="text-[22px] font-semibold text-slate-900 tabular-nums leading-none w-9 flex-shrink-0">{m.count}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="text-[12.5px] font-semibold text-slate-900">{m.name}</span><span className="mono text-[9px] uppercase tracking-[0.1em] text-slate-400">{m.kind}</span></div>
              <p className="text-[11.5px] text-slate-500 leading-snug mt-0.5">{m.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Organizations served ---------- */
function OrgsServed() {
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <CardHead icon={Icon.Building} title="Organizations served" right={<Eyebrow>{ORGANIZATIONS.length} institutions</Eyebrow>} />
      <div className="divide-y divide-slate-100">
        {ORGANIZATIONS.map(o => (
          <div key={o.id} className="px-5 py-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0"><IconFor name={o.icon} size={14} className="text-slate-700" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-slate-900 leading-tight truncate">{o.name}</div>
              <div className="text-[11px] text-slate-500 truncate">{o.kind} · {o.location}</div>
            </div>
            <span className="mono text-[10px] text-slate-400 tabular-nums flex-shrink-0">{Math.round(o.tenureMonths / 12 * 10) / 10}y</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Contribution breakdown (research / leadership / teaching) ---------- */
function ContributionBars() {
  const rows = [
    { label: 'Clinical care', value: 88, note: '~5,600 encounters' },
    { label: 'Teaching', value: 62, note: '6 precepted · 9 lectures' },
    { label: 'Research', value: 41, note: '2 peer-reviewed works' },
    { label: 'Leadership', value: 33, note: '1 protocol authored' },
    { label: 'Service', value: 36, note: 'AAPA caucus' },
  ];
  return (
    <div className="border border-slate-200 rounded-lg bg-white p-5">
      <Eyebrow className="mb-3">Where the career left its mark</Eyebrow>
      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.label}>
            <div className="flex items-center justify-between text-[12px] mb-1">
              <span className="text-slate-700 font-medium">{r.label}</span>
              <span className="text-slate-400 mono text-[10.5px]">{r.note}</span>
            </div>
            <Bar value={r.value} h="h-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ViewLegacy({ entity }) {
  return (
    <div className="max-w-[1340px] mx-auto px-6 py-9 space-y-10">
      {/* Editorial hero */}
      <div className="rise border border-slate-900 rounded-xl bg-slate-950 text-white overflow-hidden">
        <div className="px-8 py-10 md:py-14 relative">
          <div className="hairline-grid absolute inset-0 opacity-[0.04]" />
          <div className="relative max-w-[80ch]">
            <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-400 mb-4">Professional Legacy · /legacy</div>
            <h1 className="text-[34px] md:text-[42px] font-semibold tracking-[-0.025em] leading-[1.05]">
              The story of a career, <span className="text-slate-500">told by the record it left.</span>
            </h1>
            <p className="text-[14px] text-slate-300 leading-[1.65] mt-5 max-w-[68ch]">
              Not a snapshot of where {entity.fullName.split(' ')[0].charAt(0) + entity.fullName.split(' ')[0].slice(1).toLowerCase()} is today — the long arc of impact: the patients reached, the institutions served, the clinicians taught, the field advanced. Privacy-preserving where it must be, permanent everywhere it can be.
            </p>
            <div className="mt-7 flex items-center gap-6 flex-wrap">
              <div><div className="text-[28px] font-semibold tabular-nums leading-none">{entity.yearsPracticing}</div><div className="mono text-[9px] uppercase tracking-[0.12em] text-slate-500 mt-1.5">years in practice</div></div>
              <div className="h-8 w-px bg-slate-700" />
              <div><div className="text-[28px] font-semibold tabular-nums leading-none">{EVENTS.length}</div><div className="mono text-[9px] uppercase tracking-[0.12em] text-slate-500 mt-1.5">events on record</div></div>
              <div className="h-8 w-px bg-slate-700" />
              <div><div className="text-[28px] font-semibold tabular-nums leading-none">{ORGANIZATIONS.length}</div><div className="mono text-[9px] uppercase tracking-[0.12em] text-slate-500 mt-1.5">organizations served</div></div>
            </div>
          </div>
        </div>
      </div>

      {/* Impact */}
      <section className="rise" style={{ animationDelay: '60ms' }}>
        <SectionHeader n="01" title="Career impact" sub="The cumulative footprint, read from the owned ledger." right="privacy-preserving" />
        <ImpactGrid />
      </section>

      {/* Chapters */}
      <section className="rise" style={{ animationDelay: '120ms' }}>
        <SectionHeader n="02" title="The chapters" sub="A career told in eras — from formation to standing." right="formation → standing" />
        <ChapterStrip />
      </section>

      {/* Contribution + Mentorship + Orgs */}
      <section className="rise" style={{ animationDelay: '160ms' }}>
        <SectionHeader n="03" title="Where it left a mark" sub="Teaching, research, leadership, and the institutions served." />
        <div className="grid lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5"><ContributionBars /></div>
          <div className="lg:col-span-4"><MentorshipPanel /></div>
          <div className="lg:col-span-3"><OrgsServed /></div>
        </div>
      </section>

      {/* Closing statement */}
      <section className="rise border-t border-slate-200 pt-8" style={{ animationDelay: '200ms' }}>
        <div className="max-w-[72ch] mx-auto text-center">
          <Icon.Quote size={22} className="text-slate-300 mx-auto" />
          <p className="text-[18px] text-slate-800 leading-[1.6] mt-4 tracking-tightish text-pretty">
            A career is not the job you hold today. It is everything you built, everyone you cared for, and everything you passed on — <span className="text-slate-900 font-medium">earned and owned, and impossible to take away.</span>
          </p>
          <div className="mt-5 mono text-[10px] uppercase tracking-[0.16em] text-slate-400">VitalCV · the home for a professional life</div>
        </div>
      </section>
    </div>
  );
}

window.ViewLegacy = ViewLegacy;
