// ════════════════════════════════════════════════════════════════════════
// W275-D1 · WORKSPACE HOME  —  /workspace/[id]
// The shared operating surface where Clinicians, Recruiters & Organizations
// see the same thing: Members · Opportunities · Evidence · Activity.
// ════════════════════════════════════════════════════════════════════════

function MemberRow({ m, onNav }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
      <Avatar initials={m.initials} party={m.party} size={36} you={m.you} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-slate-900 truncate">{m.name}</span>
          {m.you && <span className="mono text-[9px] uppercase tracking-[0.1em] text-emerald-700 bg-emerald-50 ring-1 ring-inset ring-emerald-600/20 rounded px-1 py-px flex-none">You</span>}
        </div>
        <div className="text-[11.5px] text-slate-500 leading-tight truncate">{m.role} · <span className="text-slate-400">{m.detail}</span></div>
      </div>
      <PartyChip party={m.party} sm />
    </div>
  );
}

function OppCard({ o, onNav }) {
  const st = W.OPP_STATUS[o.status];
  return (
    <button onClick={() => onNav && onNav('org')}
      className="text-left w-full bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-300 hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mono text-[10px] text-slate-400">{o.id}</div>
          <div className="text-[14px] font-semibold text-slate-900 tracking-[-0.01em] leading-tight mt-0.5 truncate group-hover:text-black">{o.title}</div>
        </div>
        <StatusChip chip={st.chip} dot={st.dot} sm>{st.label}</StatusChip>
      </div>
      <div className="flex items-center gap-2 mt-2 text-[11.5px] text-slate-500">
        <Ic.Briefcase size={12} className="text-slate-400" />{o.specialty}<span className="text-slate-300">·</span><span className="mono tabular-nums">{o.comp}</span>
      </div>
      {o.note ? (
        <div className="mt-3 text-[11.5px] text-slate-500 flex items-center gap-1.5"><Ic.Check size={12} className="text-emerald-600" />{o.note}</div>
      ) : (
        <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><Ic.Eye size={12} className="text-slate-400" /><span className="mono tabular-nums">{o.observing}</span> observing</span>
          <span className="flex items-center gap-1"><Ic.FileText size={12} className="text-slate-400" /><span className="mono tabular-nums">{o.packets}</span> packets</span>
          <span className="flex items-center gap-1"><Ic.Clock size={12} className="text-slate-400" /><span className="mono tabular-nums">{o.review}</span> in review</span>
        </div>
      )}
    </button>
  );
}

function EvidencePill({ e }) {
  const tone = W.STATE_TONE[e.state];
  return (
    <div className="flex items-center gap-2.5 px-5 py-2.5 border-b border-slate-100 last:border-0">
      <span className={gcn('h-1.5 w-1.5 rounded-full flex-none', tone.dot)} />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] text-slate-800 leading-tight truncate">{e.label}</div>
        <div className="mono text-[10px] text-slate-400 leading-tight mt-0.5">{e.source} · {e.last}</div>
      </div>
      <TierBadge tier={e.tier} sm />
    </div>
  );
}

function ActivityMini({ a }) {
  const t = W.ACTIVITY_TYPE[a.type]; const I = Ic[t.icon];
  return (
    <div className="flex gap-3 px-5 py-3 border-b border-slate-100 last:border-0">
      <span className={gcn('h-7 w-7 rounded-md flex items-center justify-center flex-none mt-0.5', t.soft)}><I size={13} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[12.5px] font-medium text-slate-900">{a.title}</span>
          <span className="mono text-[10px] text-slate-400 flex-none ml-auto">{a.day === 'Today' ? a.t : a.day}</span>
        </div>
        <div className="text-[11.5px] text-slate-500 leading-snug mt-0.5">{a.detail}</div>
      </div>
    </div>
  );
}

function ViewHome({ ws, onNav }) {
  const members = W.membersFor(ws.id);
  const opps = W.oppsFor(ws.id);
  const activity = W.activityFor(ws.id).slice(0, 5);
  const openOpps = opps.filter(o => o.status === 'open' || o.status === 'pooled');
  const type = W.WS_TYPE[ws.type];

  return (
    <div>
      <PageHead icon="Home" route={'/workspace/' + ws.id}
        title={ws.name}
        sub={ws.subtitle + ' · the shared operating surface where every side sees the same truth.'}
        actions={<>
          <Btn variant="outline" sm iconLeft={<Ic.Users size={14} />}>Invite</Btn>
          <Btn variant="primary" sm iconLeft={<Ic.Briefcase size={14} />}>New opportunity</Btn>
        </>} />

      {/* relationship spine — the product thesis, made literal */}
      <Card className="p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <Eyebrow>One experience · four primitives</Eyebrow>
          <span className="text-[11px] text-slate-400 hidden sm:inline">Relationships, never matches</span>
        </div>
        <RelationSpine ws={ws} />
      </Card>

      {/* at-a-glance stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { v: ws.stats.members, l: 'Members', s: ws.sides.length + ' sides', a: 'text-slate-900' },
          { v: ws.stats.opportunities, l: 'Opportunities', s: openOpps.length + ' active', a: 'text-slate-900' },
          { v: ws.stats.evidence, l: 'Evidence items', s: 'source-bound', a: 'text-emerald-600' },
          { v: ws.stats.mobility, l: 'Mobility', s: 'destinations', a: 'text-sky-600' },
        ].map((s, i) => (
          <Card key={i} className="px-4 py-3.5"><Stat value={s.v} label={s.l} sub={s.s} accent={s.a} /></Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* members — the multi-sided roster */}
        <div className="lg:col-span-1 space-y-5">
          <Card>
            <SecHead icon="Users" title="Members" sub={members.length + ' people · ' + ws.sides.length + ' sides'}
              right={<Btn variant="ghost" sm onClick={() => onNav('activity')}>All</Btn>} />
            <div>{members.slice(0, 6).map(m => <MemberRow key={m.id} m={m} onNav={onNav} />)}</div>
            {members.length > 6 && (
              <div className="px-5 py-2.5 border-t border-slate-100 text-[11.5px] text-slate-500">+{members.length - 6} more across {ws.sides.length} sides</div>
            )}
          </Card>

          <Card>
            <SecHead icon="ShieldCheck" title="Evidence" sub="Source-bound · freshness-aware"
              right={<Btn variant="ghost" sm onClick={() => onNav('clinician')}>Open</Btn>} />
            <div>{W.EVIDENCE.slice(0, 5).map(e => <EvidencePill key={e.id} e={e} />)}</div>
            <div className="px-5 py-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">{W.EVIDENCE.filter(e => e.state === 'verified').length} verified · {W.EVIDENCE.filter(e => e.state !== 'verified').length} need attention</span>
              <span className="mono text-slate-400">never a score</span>
            </div>
          </Card>
        </div>

        {/* opportunities */}
        <div className="lg:col-span-2 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><Ic.Briefcase size={15} className="text-slate-700" /><h2 className="text-[14px] font-semibold text-slate-900 tracking-[-0.01em]">Opportunities</h2></div>
              <span className="text-[11.5px] text-slate-400">Org-owned declarations · {opps.length} total</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {opps.map(o => <OppCard key={o.id} o={o} onNav={onNav} />)}
            </div>
          </div>

          {/* shared activity preview */}
          <Card>
            <SecHead icon="Activity" title="Activity" sub="Shared across every side"
              right={<Btn variant="ghost" sm onClick={() => onNav('activity')} iconRight={<Ic.ArrowRight size={13} />}>Feed</Btn>} />
            <div>{activity.map(a => <ActivityMini key={a.id} a={a} />)}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

window.ViewHome = ViewHome;
window.OppCard = OppCard;
