// ════════════════════════════════════════════════════════════════════════
// D2 · OPPORTUNITY DETAIL — /opportunities/[id]
// D3 · MATCH EXPLAINER — "Why this opportunity?" (evidence/trust/timeline)
// Required evidence · required trust · required experience · readiness · gaps
// ════════════════════════════════════════════════════════════════════════

// ── D3 · one alignment column ──────────────────────────────────────────────
function AlignColumn({ icon, title, a, accent, children }) {
  const I = Ic[icon];
  const tone = a.pct >= 100 ? 'emerald' : a.pct >= 60 ? 'sky' : 'orange';
  const fill = { emerald: 'bg-emerald-500', sky: 'bg-sky-500', orange: 'bg-orange-500' }[tone];
  const txt  = { emerald: 'text-emerald-700', sky: 'text-sky-700', orange: 'text-orange-700' }[tone];
  return (
    <div className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <I size={15} className="text-slate-700" />
          <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
        </div>
        <span className={ocn('mono text-[11px] tabular-nums font-semibold', txt)}>{a.met}/{a.total}</span>
      </div>
      <div className="mt-3"><Meter pct={a.pct} fill={fill} h="h-1.5" /></div>
      <p className="text-[11.5px] text-slate-500 mt-2.5 leading-snug">{a.summary}</p>
      {children}
    </div>
  );
}

function MatchExplainer({ opp }) {
  const a = O.alignment(opp);
  const verdict = opp.ev.level === 'ready' || opp.ev.level === 'conditional'
    ? { txt: 'You clear this role on evidence you already own.', tone: 'text-emerald-700', icon: 'CheckCircle' }
    : opp.ev.level === 'nearly'
      ? { txt: 'One credential stands between you and ready.', tone: 'text-sky-700', icon: 'Target' }
      : { txt: 'A strong long-term fit as your record deepens.', tone: 'text-orange-700', icon: 'Compass' };
  const VI = Ic[verdict.icon];
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ic.Sparkles size={15} className="text-slate-700" />
          <h2 className="text-[14px] font-semibold text-slate-900 tracking-[-0.01em]">Why this opportunity?</h2>
        </div>
        <span className={ocn('inline-flex items-center gap-1.5 text-[12px] font-medium', verdict.tone)}>
          <VI size={13} /> {verdict.txt}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
        <AlignColumn icon="ShieldCheck" title="Evidence alignment" a={a.evidence} />
        <AlignColumn icon="Gauge" title="Trust alignment" a={a.trust}>
          <div className="mt-3 space-y-2">
            {opp.ev.trust.map((r, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-600">{r.label}</span>
                  <span className={ocn('mono tabular-nums', r.met ? 'text-emerald-600' : 'text-orange-600')}>{r.score} <span className="text-slate-300">/ {r.min}</span></span>
                </div>
                <Meter pct={r.score} mark={r.min} fill={r.met ? 'bg-slate-900' : 'bg-orange-400'} h="h-1.5" />
              </div>
            ))}
          </div>
        </AlignColumn>
        <AlignColumn icon="Briefcase" title="Timeline alignment" a={a.timeline}>
          <div className="mt-3 space-y-1.5">
            {opp.ev.experience.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-[11.5px]">
                <span className="flex items-center gap-1.5 text-slate-600">
                  {r.met ? <Ic.CheckCircle size={12} className="text-emerald-600" /> : <Ic.X size={12} className="text-slate-400" />}
                  {r.label}
                </span>
                <span className={ocn('mono text-[11px]', r.met ? 'text-slate-600' : 'text-orange-600')}>{r.have}</span>
              </div>
            ))}
          </div>
        </AlignColumn>
      </div>
    </Card>
  );
}

// ── requirement block ──────────────────────────────────────────────────────
function ReqBlock({ icon, title, note, reqs }) {
  const met = reqs.filter(r => r.met).length;
  return (
    <Card>
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {React.createElement(Ic[icon], { size: 15, className: 'text-slate-700' })}
          <h2 className="text-[14px] font-semibold text-slate-900 tracking-[-0.01em]">{title}</h2>
        </div>
        <span className="mono text-[11px] text-slate-400 tabular-nums">{met}/{reqs.length} met</span>
      </div>
      <div className="px-5 py-1.5 divide-y divide-slate-50">
        {reqs.map((r, i) => <ReqRow key={i} r={r} />)}
      </div>
      {note && <div className="px-5 py-2.5 border-t border-slate-100 text-[11.5px] text-slate-400">{note}</div>}
    </Card>
  );
}

// map a gap to the recommendation that closes it
const GAP_TO_REC = {
  dea: 'obtain-dea', 'education-psv': 'education-psv', 'state-wa': null,
  leadership: 'leadership', gcp: 'gcp-training', publication: 'add-publication',
  authority: 'renew-license', practice: 'leadership', enrollment: null, education: 'education-psv',
};

function ViewDetail({ id, onOpen, onNav, onBack }) {
  const opp = O.byId(id) || O.ranked()[0];
  const m = O.LEVEL[opp.ev.level];
  const ev = opp.ev;
  const closers = ev.gaps.map(g => O.RECOMMENDATIONS.find(r => r.id === GAP_TO_REC[g.ref])).filter(Boolean);
  const uniqueClosers = [...new Map(closers.map(c => [c.id, c])).values()];

  return (
    <div>
      {/* back */}
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-500 hover:text-slate-900 mb-5">
        <Ic.ArrowLeft size={14} /> All opportunities
      </button>

      {/* header */}
      <Card className="overflow-hidden mb-6">
        <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-5">
          <ReadinessRing pct={ev.pct} level={ev.level} size={84} stroke={7} />
          <div className="min-w-0 flex-1">
            <div className="mono text-[10.5px] text-slate-400">opportunities/{opp.id}</div>
            <div className="flex items-center gap-2.5 flex-wrap mt-1">
              <h1 className="text-[23px] font-semibold text-slate-900 tracking-[-0.02em] leading-tight">{opp.title}</h1>
              <ReadinessChip level={ev.level} />
            </div>
            <div className="flex items-center gap-2.5 flex-wrap mt-2 text-[13px] text-slate-500">
              <span className="flex items-center gap-1.5 text-slate-700 font-medium"><Ic.Building size={13} className="text-slate-400" />{opp.org}</span>
              <span className="text-slate-300">·</span>
              <span className="flex items-center gap-1.5"><Ic.MapPin size={12} className="text-slate-400" />{opp.location}</span>
              <span className="text-slate-300">·</span>
              <span>{opp.type}</span>
              <span className="text-slate-300">·</span>
              <span className="mono text-slate-700">{opp.comp}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-none">
            {ev.gaps.length === 0
              ? <Btn variant="primary" iconLeft={<Ic.Share2 size={14} />}>Apply with packet</Btn>
              : <Btn variant="primary" iconLeft={<Ic.Compass size={14} />} onClick={() => onNav('recommend')}>Close the gap</Btn>}
            <Btn variant="outline" iconLeft={<Ic.Eye size={14} />}>Save to track</Btn>
          </div>
        </div>
        <div className="px-6 py-3.5 bg-slate-50/60 border-t border-slate-100 text-[12.5px] text-slate-600 leading-snug">
          {opp.blurb}
        </div>
      </Card>

      {/* D3 · match explainer */}
      <div className="mb-6"><MatchExplainer opp={opp} /></div>

      {/* readiness verdict strip */}
      <Card className={ocn('mb-6 overflow-hidden border-l-2', ev.level === 'ready' ? 'border-l-emerald-500' : ev.level === 'conditional' ? 'border-l-amber-500' : ev.level === 'nearly' ? 'border-l-sky-500' : ev.level === 'building' ? 'border-l-orange-500' : 'border-l-slate-400')}>
        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={ocn('h-9 w-9 rounded-lg flex items-center justify-center flex-none', m.soft)}>
              {React.createElement(Ic[ev.level === 'ready' ? 'CheckCircle' : ev.gaps.length ? 'Target' : 'AlertTri'], { size: 18, className: m.text })}
            </span>
            <div>
              <div className="text-[14px] font-semibold text-slate-900">{m.label} · {ev.met} of {ev.total} requirements met</div>
              <div className="text-[12px] text-slate-500 mt-0.5">{m.blurb}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {ev.gaps.length === 0 && ev.atRisk.length === 0 && <span className="text-[12px] text-emerald-700 font-medium">No action needed</span>}
            {ev.atRisk.length > 0 && <span className="inline-flex items-center gap-1.5 text-[12px] text-orange-700"><Ic.AlertTri size={13} />{ev.atRisk.length} expiring</span>}
            {ev.gaps.length > 0 && <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-600"><Ic.X size={13} className="text-slate-400" />{ev.gaps.length} gap{ev.gaps.length !== 1 && 's'}</span>}
          </div>
        </div>
      </Card>

      {/* requirements grid */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7 space-y-6">
          <ReqBlock icon="ShieldCheck" title="Required evidence" reqs={ev.evidence}
            note="Each proof resolves live against your owned ledger — verified items carry their authority tier." />
        </div>
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <ReqBlock icon="Gauge" title="Required trust" reqs={ev.trust}
            note="Your score vs. the role's bar. Trust is a profile, never one number." />
          <ReqBlock icon="Briefcase" title="Required experience" reqs={ev.experience} />
        </div>
      </div>

      {/* gaps → how to close */}
      {ev.gaps.length > 0 && (
        <Card className="mt-6 overflow-hidden">
          <SecHead icon="Compass" title="What closes the gap" right={<span className="mono text-[10px] text-slate-400 uppercase tracking-[0.08em]">{ev.gaps.length} to resolve</span>} />
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {uniqueClosers.length > 0 ? uniqueClosers.map(rec => {
              const RI = Ic[rec.icon];
              return (
                <button key={rec.id} onClick={() => onNav('recommend')} className="text-left flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 hover:border-slate-400 transition-colors">
                  <span className="h-8 w-8 rounded-md bg-slate-900 text-white flex items-center justify-center flex-none"><RI size={15} /></span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-slate-900 leading-tight">{rec.title}</div>
                    <div className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">{rec.produces}</div>
                    <div className="mono text-[10.5px] text-slate-400 mt-1.5">{rec.effort} · {rec.cost}{rec.unlocks > 0 && ` · unlocks ${rec.unlocks} more`}</div>
                  </div>
                </button>
              );
            }) : (
              <div className="text-[12.5px] text-slate-500 col-span-2">These gaps resolve as your practice record and federal enrollment mature — see your <button onClick={() => onNav('recommend')} className="text-slate-900 font-medium underline underline-offset-2">growth path</button>.</div>
            )}
          </div>
        </Card>
      )}

      {/* other opportunities */}
      <div className="mt-8">
        <h2 className="text-[13px] font-semibold text-slate-700 mb-3">More in your specialty</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {O.ranked().filter(o => o.id !== opp.id).slice(0, 4).map(o => (
            <button key={o.id} onClick={() => onOpen(o.id)} className="text-left flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3.5 hover:border-slate-300 transition-colors">
              <ReadinessRing pct={o.ev.pct} level={o.ev.level} size={44} stroke={5} label={false} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-slate-900 leading-tight truncate">{o.title}</div>
                <div className="text-[11.5px] text-slate-500 mt-0.5 truncate">{o.org}</div>
              </div>
              <ReadinessChip level={o.ev.level} sm />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

window.ViewDetail = ViewDetail;
