// ════════════════════════════════════════════════════════════════════════
// D1 · OPPORTUNITY HOME — /opportunities
// The 30-second answer: "What opportunities am I ready for?"
// Recommended opportunities · readiness level · missing requirements · match.
// ════════════════════════════════════════════════════════════════════════

function GapPill({ r }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 border border-slate-200 px-2 py-1 text-[11px] text-slate-600">
      <Ic.X size={11} className="text-slate-400" />
      {r.type === 'trust'
        ? <span>{r.label} <span className="mono text-slate-400">{r.score}/{r.min}</span></span>
        : r.type === 'experience'
          ? <span>{r.label} <span className="mono text-slate-400">{r.have}/{r.need}</span></span>
          : <span>{r.label}</span>}
    </span>
  );
}

function MatchReason({ opp }) {
  const a = O.alignment(opp);
  const cell = (icon, label, frac, pct) => {
    const I = Ic[icon];
    const tone = pct >= 100 ? 'text-emerald-600' : pct >= 60 ? 'text-sky-600' : 'text-orange-500';
    return (
      <div className="flex items-center gap-1.5">
        <I size={12} className={tone} />
        <span className="text-[11.5px] text-slate-500">{label}</span>
        <span className="mono text-[11px] text-slate-700 tabular-nums">{frac}</span>
      </div>
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {cell('ShieldCheck', 'Evidence', `${a.evidence.met}/${a.evidence.total}`, a.evidence.pct)}
      {cell('Gauge', 'Trust', `${a.trust.met}/${a.trust.total}`, a.trust.pct)}
      {cell('Briefcase', 'Timeline', `${a.timeline.met}/${a.timeline.total}`, a.timeline.pct)}
    </div>
  );
}

function OppCard({ opp, onOpen }) {
  const m = O.LEVEL[opp.ev.level];
  const gaps = opp.ev.gaps;
  const atRisk = opp.ev.atRisk;
  return (
    <Card className="overflow-hidden hover:border-slate-300 transition-colors">
      <button onClick={() => onOpen(opp.id)} className="w-full text-left">
        <div className="p-5">
          <div className="flex items-start gap-4">
            <ReadinessRing pct={opp.ev.pct} level={opp.ev.level} size={62} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[16px] font-semibold text-slate-900 tracking-[-0.01em] leading-tight">{opp.title}</h3>
                    <ReadinessChip level={opp.ev.level} sm />
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[12.5px] text-slate-500">
                    <Ic.Building size={12} className="text-slate-400" />
                    <span className="text-slate-700 font-medium">{opp.org}</span>
                    <span className="text-slate-300">·</span>
                    <span>{opp.location}</span>
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-end flex-none">
                  <span className="mono text-[12px] text-slate-700">{opp.comp}</span>
                  <span className="text-[11px] text-slate-400">{opp.type}</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100">
                <MatchReason opp={opp} />
              </div>
            </div>
          </div>

          {/* missing requirements / at-risk */}
          {(gaps.length > 0 || atRisk.length > 0) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {atRisk.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-orange-50 border border-orange-200 px-2 py-1 text-[11px] text-orange-700">
                  <Ic.AlertTri size={11} /> {atRisk.map(r => r.label).join(', ')} expiring
                </span>
              )}
              {gaps.length > 0
                ? gaps.slice(0, 3).map((r, i) => <GapPill key={i} r={r} />)
                : atRisk.length > 0
                  ? <span className="text-[11.5px] text-slate-400">No gaps — keep your proofs current</span>
                  : null}
              {gaps.length > 3 && <span className="text-[11px] text-slate-400">+{gaps.length - 3} more</span>}
            </div>
          )}
          {gaps.length === 0 && atRisk.length === 0 && (
            <div className="mt-4 inline-flex items-center gap-1.5 text-[12px] text-emerald-700">
              <Ic.CheckCircle size={13} /> Every requirement met — apply with one verified packet.
            </div>
          )}
        </div>
      </button>

      <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11.5px] text-slate-400 flex items-center gap-1.5">
          <Ic.Network size={12} /> {opp.network}
        </span>
        <button onClick={() => onOpen(opp.id)} className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-700 hover:text-slate-900">
          {gaps.length === 0 ? 'View & apply' : 'See what’s missing'} <Ic.ChevronRight size={13} />
        </button>
      </div>
    </Card>
  );
}

function ViewHome({ onOpen, onNav }) {
  const ranked = O.ranked();
  const s = O.summary();
  const readyOnes = ranked.filter(o => o.ev.level === 'ready' || o.ev.level === 'conditional');

  return (
    <div>
      <PageHead icon="Briefcase" route="vitalcv.health/opportunities" title="Opportunities you’re ready for"
        sub="Every match is projected live from the evidence you own — not a recruiter’s guess. Readiness is what your verified proofs can already unlock."
        actions={<>
          <Btn variant="outline" sm iconLeft={<Ic.Refresh size={14} />}>Re-project</Btn>
          <Btn variant="primary" sm iconLeft={<Ic.Compass size={14} />} onClick={() => onNav('recommend')}>Next steps</Btn>
        </>} />

      {/* ── THE 30-SECOND ANSWER ── */}
      <Card className="overflow-hidden mb-6">
        <div className="grid grid-cols-12">
          <div className="col-span-12 md:col-span-7 p-6 border-b md:border-b-0 md:border-r border-slate-200">
            <Eyebrow>Right now</Eyebrow>
            <div className="mt-2 text-[26px] sm:text-[30px] font-semibold text-slate-900 tracking-[-0.02em] leading-[1.15]">
              You’re ready for <span className="text-emerald-600">{s.ready} role{s.ready !== 1 && 's'}</span> today,
              <br className="hidden sm:block" /> with <span className="text-sky-600">{s.nearly}</span> a single step away.
            </div>
            <p className="text-[13px] text-slate-500 mt-3 max-w-[52ch] leading-snug">
              {readyOnes.length > 0 && <>Your verified identity, certification and clean standing already clear the bar at {readyOnes[0].org}. </>}
              Close one credential gap and {s.ready + s.nearly} roles open up.
            </p>
          </div>
          <div className="col-span-12 md:col-span-5 grid grid-cols-3 divide-x divide-slate-200">
            {[
              { n: s.ready, label: 'Ready now', dot: 'bg-emerald-500', text: 'text-emerald-700' },
              { n: s.nearly, label: 'Nearly ready', dot: 'bg-sky-500', text: 'text-sky-700' },
              { n: s.building, label: 'Building', dot: 'bg-orange-500', text: 'text-orange-700' },
            ].map((c, i) => (
              <div key={i} className="p-5 flex flex-col justify-center">
                <div className="flex items-center gap-1.5">
                  <span className={ocn('h-1.5 w-1.5 rounded-full', c.dot)} />
                  <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-slate-400">{c.label}</span>
                </div>
                <div className={ocn('text-[34px] font-semibold tracking-[-0.03em] tabular-nums mt-1', c.text)}>{c.n}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ── ranked list ── */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-semibold text-slate-700 tracking-[-0.01em]">Recommended for you · ranked by readiness</h2>
        <span className="mono text-[10.5px] text-slate-400 uppercase tracking-[0.08em]">{ranked.length} matched in your specialty</span>
      </div>
      <div className="space-y-3.5">
        {ranked.map(opp => <OppCard key={opp.id} opp={opp} onOpen={onOpen} />)}
      </div>

      <div className="mt-6 flex items-center justify-center">
        <button onClick={() => onNav('recommend')} className="inline-flex items-center gap-2 text-[12.5px] text-slate-500 hover:text-slate-900">
          <Ic.Compass size={14} /> See how to unlock the rest <Ic.ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

window.ViewHome = ViewHome;
