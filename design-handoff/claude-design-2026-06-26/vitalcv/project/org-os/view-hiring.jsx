// ════════════════════════════════════════════════════════════════════════
// view-hiring.jsx — D3 · /org/hiring · Hiring Command Center
// Combines: Candidate Review · Evidence Review · Decision Support
//           Offer Progress · Credential Progress
// ════════════════════════════════════════════════════════════════════════

function HiringCenter({ onNav }) {
  const [sel, setSel] = React.useState(CANDIDATES.find(c => c.stage === 'review')?.id || CANDIDATES[0].id);
  const cand = CANDIDATES.find(c => c.id === sel);

  return (
    <div className="space-y-6">
      <SecHead eyebrow={`${CANDIDATES.length} candidates · ${PIPELINE.find(s => s.id === 'review').count} awaiting decision`} title="Hiring command center"
        sub="Source, review evidence, decide, and track to start — on one record that's already federally verified before the first interview."
        right={
          <button className="h-9 px-3.5 text-[13px] font-medium text-white bg-slate-900 rounded-md hover:bg-black inline-flex items-center gap-1.5">
            <Icon.Plus size={14} /> Add candidate
          </button>
        } />

      {/* ── Pipeline board ──────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-3">
        {PIPELINE.map(stage => (
          <div key={stage.id} className="min-w-0">
            <div className="flex items-center justify-between mb-2 px-0.5">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-slate-900 truncate">{stage.label}</div>
                <div className="mono text-[9.5px] uppercase tracking-[0.06em] text-slate-400 truncate">{stage.sub}</div>
              </div>
              <span className="mono text-[12px] font-medium text-slate-900 bg-slate-100 rounded px-1.5 py-0.5 flex-shrink-0">{stage.count}</span>
            </div>
            <div className="space-y-2 min-h-[64px] rounded-lg bg-slate-50/70 p-2">
              {stage.members.map(c => (
                <CandidateCard key={c.id} c={c} active={sel === c.id} onClick={() => setSel(c.id)} />
              ))}
              {stage.members.length === 0 && (
                <div className="h-14 flex items-center justify-center text-[11px] text-slate-300 border border-dashed border-slate-200 rounded-md">empty</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Selected candidate · combined surfaces ──────────────────── */}
      {cand && <CandidateDetail c={cand} onNav={onNav} />}
    </div>
  );
}

function CandidateCard({ c, active, onClick }) {
  return (
    <button onClick={onClick}
      className={cx('w-full text-left bg-white border rounded-md p-2.5 transition-all hover:border-slate-300',
        active ? 'border-slate-900 ring-1 ring-slate-900 shadow-sm' : 'border-slate-200')}>
      <div className="flex items-center gap-2">
        <Avatar initials={c.initials} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-slate-900 truncate">{c.name}</div>
          <div className="text-[10.5px] text-slate-500 truncate">{c.role} · {c.spec}</div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className={cx('mono text-[10.5px] font-medium', tone(c.trust >= 90 ? 'verified' : c.trust >= 80 ? 'pending' : 'gap').text)}>T{c.trust}</span>
        <span className="flex items-center gap-1">
          <span className={cx('h-1.5 w-1.5 rounded-full', tone(c.signal).dot, c.signal === 'watch' && 'pulse-soft')} />
          <span className="mono text-[9.5px] uppercase tracking-[0.06em] text-slate-400">{c.days}d</span>
        </span>
      </div>
    </button>
  );
}

function CandidateDetail({ c, onNav }) {
  const lanes = [
    { k: 'NPPES identity · NPI ' + (1000000000 + c.id.charCodeAt(1) * 73 % 900000000), t: 'verified' },
    { k: 'State license · WA', t: 'verified' },
    { k: 'OIG / LEIE exclusions', t: 'verified' },
    { k: 'PECOS / Medicare enrollment', t: c.evidence > 85 ? 'verified' : 'pending' },
    { k: 'Board certification', t: c.evidence > 80 ? 'verified' : 'pending' },
    { k: 'Malpractice history (NPDB)', t: c.signal === 'watch' ? 'pending' : 'verified' },
  ];
  const stageIdx = HIRING_STAGES.findIndex(s => s.id === c.stage);

  return (
    <OCard pad={false} className="overflow-hidden">
      {/* header */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5">
          <Avatar initials={c.initials} size="lg" />
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-[18px] font-semibold text-slate-900">{c.name}, {c.role}</h3>
              <Pill t={c.signal} dot={c.signal === 'watch'}>{c.signal === 'ready' ? 'Decision-ready' : 'Review item'}</Pill>
            </div>
            <div className="text-[12.5px] text-slate-500 mt-0.5">{c.spec} · {FAC_FULL[c.fac]} · Recruiter {c.recruiter} · {c.days}d in stage</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-9 px-3 text-[12.5px] font-medium text-slate-700 border border-slate-300 rounded-md hover:border-slate-500">Request info</button>
          <button onClick={() => onNav('providers')} className="h-9 px-3.5 text-[12.5px] font-medium text-white bg-slate-900 rounded-md hover:bg-black inline-flex items-center gap-1.5">
            <Icon.Check size={14} /> Advance candidate
          </button>
        </div>
      </div>

      {/* stage progress strip */}
      <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-1">
        {HIRING_STAGES.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className="flex items-center gap-1.5">
              <span className={cx('h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold',
                i < stageIdx ? 'bg-emerald-600 text-white' : i === stageIdx ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-400')}>
                {i < stageIdx ? '✓' : i + 1}
              </span>
              <span className={cx('text-[11.5px] font-medium', i <= stageIdx ? 'text-slate-900' : 'text-slate-400')}>{s.label}</span>
            </div>
            {i < HIRING_STAGES.length - 1 && <span className={cx('flex-1 h-px', i < stageIdx ? 'bg-emerald-300' : 'bg-slate-200')} />}
          </React.Fragment>
        ))}
      </div>

      {/* combined surfaces */}
      <div className="grid grid-cols-12 gap-0 divide-x divide-slate-100">
        {/* Evidence Review */}
        <div className="col-span-12 lg:col-span-5 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Icon.Layers size={14} className="text-slate-500" />
            <Eyebrow>Evidence review</Eyebrow>
          </div>
          <div className="space-y-2">
            {lanes.map(l => (
              <div key={l.k} className="flex items-center justify-between text-[12.5px] py-0.5">
                <span className="text-slate-700">{l.k}</span>
                <Pill t={l.t} dot={l.t === 'pending'}>{l.t === 'verified' ? 'Signed' : 'In flight'}</Pill>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <Eyebrow>Packet completeness</Eyebrow>
              <span className="mono text-[12px] font-medium text-slate-900">{c.evidence}%</span>
            </div>
            <Meter value={c.evidence} t={c.evidence >= 90 ? 'verified' : 'pending'} />
          </div>
        </div>

        {/* Decision Support */}
        <div className="col-span-12 lg:col-span-4 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Icon.Gauge size={14} className="text-slate-500" />
            <Eyebrow>Decision support</Eyebrow>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <Gauge value={c.trust} t={c.trust >= 90 ? 'verified' : c.trust >= 80 ? 'pending' : 'blocked'} label="trust" size={92} stroke={9} />
            <div className="flex-1">
              <Pill t={c.signal} dot={c.signal === 'watch'}>{c.signal === 'ready' ? 'Recommend advance' : 'Hold for review'}</Pill>
              <p className="text-[11.5px] text-slate-600 leading-snug mt-2">{c.note}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <SupportRow label="Federal lanes verified" ok={c.evidence > 70} />
            <SupportRow label="No active sanctions" ok />
            <SupportRow label="Specialty matches req" ok />
            <SupportRow label="Malpractice clear" ok={c.signal !== 'watch'} warn={c.signal === 'watch'} />
          </div>
        </div>

        {/* Offer + Credential Progress */}
        <div className="col-span-12 lg:col-span-3 p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Icon.FileText size={14} className="text-slate-500" />
              <Eyebrow>Offer progress</Eyebrow>
            </div>
            <ProgressBlock value={c.offer} stage={c.stage}
              states={['Not sent', 'Extended', 'Negotiating', 'Accepted']} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Icon.ShieldCheck size={14} className="text-slate-500" />
              <Eyebrow>Credential progress</Eyebrow>
            </div>
            <ProgressBlock value={c.cred} stage={c.stage}
              states={['Not started', 'PSV running', 'Committee', 'Cleared']} cred />
          </div>
        </div>
      </div>
    </OCard>
  );
}

function SupportRow({ label, ok, warn }) {
  const t = warn ? 'watch' : ok ? 'verified' : 'gap';
  const I = warn ? Icon.Clock : ok ? Icon.Check : Icon.Minus;
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <I size={13} className={tone(t).text} strokeWidth={2.25} />
      <span className="text-slate-600">{label}</span>
    </div>
  );
}

function ProgressBlock({ value, states, cred }) {
  const idx = value >= 100 ? 3 : value >= 60 ? 2 : value > 0 ? 1 : 0;
  const t = value >= 100 ? 'verified' : value > 0 ? 'pending' : 'low';
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className={cx('text-[13px] font-medium', tone(t).text)}>{states[idx]}</span>
        <span className="mono text-[11px] text-slate-400">{value}%</span>
      </div>
      <Meter value={Math.max(value, 3)} t={t} />
    </div>
  );
}

window.HiringCenter = HiringCenter;
