// ════════════════════════════════════════════════════════════════════════
// W275-D3 · CLINICIAN WORKSPACE  —  /workspace/[id]/clinicians
// The clinician side: Career Health · Readiness · Evidence · Mobility.
// ════════════════════════════════════════════════════════════════════════

function HealthCard({ h }) {
  const tone = W.STATE_TONE[h.state];
  const fill = h.state === 'strong' ? 'bg-emerald-500' : h.state === 'attention' ? 'bg-amber-500' : 'bg-slate-900';
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="mono text-[10px] uppercase tracking-[0.12em] text-slate-400">{h.label}</span>
        <span className={gcn('h-1.5 w-1.5 rounded-full', tone.dot)} />
      </div>
      <div className={gcn('text-[20px] font-semibold tracking-[-0.02em] mt-2 leading-none', tone.text)}>{h.value}</div>
      <div className="mt-2.5"><Meter pct={h.pct} fill={fill} h="h-1" /></div>
      <div className="text-[11px] text-slate-500 leading-snug mt-2.5">{h.note}</div>
    </Card>
  );
}

function ReadinessRow({ r, onNav }) {
  return (
    <div className="px-5 py-3.5 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-3">
        <span className={gcn('h-8 w-8 rounded-md flex items-center justify-center flex-none',
          r.ready ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600')}>
          {r.ready ? <Ic.Check size={15} /> : <Ic.Clock size={15} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-slate-900 leading-tight truncate">{r.title}</div>
          <div className="mono text-[10.5px] text-slate-400 mt-0.5">{r.id} · {r.org}</div>
        </div>
        <div className="text-right flex-none">
          <div className={gcn('text-[12px] font-medium', r.ready ? 'text-emerald-700' : 'text-amber-700')}>{r.ready ? 'Ready' : 'Gap'}</div>
          <div className="mono text-[10.5px] text-slate-400 tabular-nums">{r.satisfied}/{r.required} met</div>
        </div>
      </div>
      {r.gap && (
        <div className="mt-2 ml-11 text-[11.5px] text-amber-700 flex items-center gap-1.5">
          <Ic.AlertTri size={12} />{r.gap}
        </div>
      )}
    </div>
  );
}

function EvidenceRow({ e }) {
  const tone = W.STATE_TONE[e.state];
  return (
    <div className="px-5 py-3 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-3">
        <span className={gcn('h-2 w-2 rounded-full flex-none', tone.dot)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-medium text-slate-800 truncate">{e.label}</span>
            <TierBadge tier={e.tier} sm />
          </div>
          <div className="mono text-[10px] text-slate-400 mt-0.5 truncate">{e.source} · {e.note}</div>
        </div>
        <div className="text-right flex-none">
          <div className={gcn('text-[11px] font-medium', tone.text)}>{tone.label}</div>
          <div className="mono text-[10px] text-slate-400">{e.last}</div>
        </div>
      </div>
    </div>
  );
}

function MobilityRow({ m }) {
  const st = W.MOBILITY_STATE[m.state]; const I = Ic[st.icon];
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 last:border-0">
      <span className={gcn('h-8 w-8 rounded-md flex items-center justify-center flex-none ring-1 ring-inset', st.chip)}><I size={14} /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-slate-900 leading-tight truncate">{m.org}</div>
        <div className="text-[11.5px] text-slate-500 leading-tight mt-0.5 truncate">{m.basis}</div>
      </div>
      <div className="text-right flex-none hidden sm:block">
        <div className="mono text-[10px] text-slate-400">{m.market}</div>
        <div className="text-[10.5px] text-slate-400 mt-0.5">{m.via}</div>
      </div>
      <StatusChip chip={st.chip} dot={st.dot} sm>{st.label}</StatusChip>
    </div>
  );
}

function ViewClinician({ ws, onNav }) {
  const c = W.CLINICIAN;
  const readyCount = W.READINESS.filter(r => r.ready).length;
  const unlocked = W.MOBILITY.filter(m => m.state === 'unlocked').length;

  return (
    <div>
      <PageHead icon="User" route={'/workspace/' + ws.id + '/clinicians'}
        title="Clinician"
        sub="The clinician side: one verified passport, projected into career health, opportunity readiness, source-bound evidence, and where it can travel next."
        actions={<Btn variant="outline" sm iconLeft={<Ic.FileText size={14} />}>View passport</Btn>} />

      {/* clinician header */}
      <Card className="p-5 mb-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar initials={c.initials} party="clinician" size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[19px] font-semibold text-slate-900 tracking-[-0.02em]">{c.name}</h2>
              <VerifiedTag sm>Verified passport</VerifiedTag>
            </div>
            <div className="text-[12.5px] text-slate-500 mt-1">{c.specialty} · {c.city} · employed since {c.since}</div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-emerald-700"><Ic.Verified size={12} /> NPI {c.npi}</div>
          </div>
          <div className="flex items-center gap-6 flex-none">
            <Stat value={readyCount} label="Ready for" sub="opportunities" accent="text-emerald-600" />
            <Stat value={unlocked} label="Unlocked" sub="destinations" accent="text-sky-600" />
          </div>
        </div>
      </Card>

      {/* career health */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><Ic.Gauge size={15} className="text-slate-700" /><h2 className="text-[14px] font-semibold text-slate-900 tracking-[-0.01em]">Career health</h2></div>
        <span className="text-[11.5px] text-slate-400">Projected signals · never one stored score</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {W.CAREER_HEALTH.map(h => <HealthCard key={h.id} h={h} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* readiness */}
        <Card>
          <SecHead icon="ClipboardCheck" title="Readiness" sub="Projected against real opportunities"
            right={<span className="text-[11px] text-emerald-700 font-medium">{readyCount} ready</span>} />
          <div>{W.READINESS.map(r => <ReadinessRow key={r.id} r={r} onNav={onNav} />)}</div>
          <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2 text-[11.5px] text-slate-500">
            <Ic.Info size={13} className="text-slate-400" /> Gaps are named, never scored. Readiness recomputes as evidence refreshes.
          </div>
        </Card>

        {/* evidence */}
        <Card>
          <SecHead icon="ShieldCheck" title="Evidence" sub="Source-bound · freshness-aware"
            right={<span className="text-[11px] text-slate-400">{W.EVIDENCE.length} items</span>} />
          <div>{W.EVIDENCE.map(e => <EvidenceRow key={e.id} e={e} />)}</div>
        </Card>
      </div>

      {/* mobility */}
      <Card className="mt-5">
        <SecHead icon="Route" title="Mobility" sub="Where this passport travels without re-credentialing"
          right={<span className="text-[11px] text-sky-700 font-medium">{unlocked} unlocked · {W.MOBILITY.filter(m => m.state === 'reachable').length} reachable</span>} />
        <div>{W.MOBILITY.map(m => <MobilityRow key={m.id} m={m} />)}</div>
        <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2 text-[11.5px] text-slate-500">
          <Ic.Sparkles size={13} className="text-sky-500" /> Each verified observation a new system makes unlocks the next destination — mobility compounds.
        </div>
      </Card>
    </div>
  );
}

window.ViewClinician = ViewClinician;
