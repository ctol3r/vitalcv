// ════════════════════════════════════════════════════════════════════════
// D1 · WALLET HOME — the clinician's home. Understand in 60 seconds:
// who am I · what do I have · what's missing · how trusted · what's next.
// ════════════════════════════════════════════════════════════════════════

function Ring({ pct, size = 116, stroke = 9 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#0f172a" strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct/100)}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)' }} />
    </svg>
  );
}

function ViewHome({ onNav }) {
  const c = W.CLINICIAN, h = W.CAREER_HEALTH;
  const v = W.count('verified'), p = W.count('pending'), x = W.count('expiring'), m = W.count('missing');
  const total = W.EVIDENCE.length;
  const strongDims = W.TRUST_DIMENSIONS.filter(d => d.state === 'strong').length;
  const toneClass = { verified: 'text-emerald-700', pending: 'text-orange-700' };

  return (
    <div>
      <PageHead icon="Wallet" route="vitalcv.health/wallet" title={`Good morning, ${c.firstName || 'Macie'}.`}
        sub="Everything here is projected from evidence you own — not a score someone keeps on you."
        actions={<>
          <Btn variant="outline" sm iconLeft={<Ic.Refresh size={14} />}>Refresh</Btn>
          <Btn variant="primary" sm iconLeft={<Ic.Share2 size={14} />} onClick={() => onNav('share')}>Share</Btn>
        </>} />

      {/* ── CAREER HEALTH ── */}
      <Card className="overflow-hidden mb-6">
        <div className="grid grid-cols-12">
          {/* gauge */}
          <div className="col-span-12 md:col-span-4 p-6 border-b md:border-b-0 md:border-r border-slate-200 flex items-center gap-5">
            <div className="relative flex-none" style={{ width: 116, height: 116 }}>
              <Ring pct={h.pct} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[30px] font-semibold text-slate-900 tracking-[-0.03em] leading-none tabular-nums">{h.pct}<span className="text-[16px] text-slate-400">%</span></div>
                <div className="mono text-[9px] uppercase tracking-[0.14em] text-slate-400 mt-1">verified</div>
              </div>
            </div>
            <div>
              <Eyebrow>Career Health</Eyebrow>
              <div className="text-[20px] font-semibold text-slate-900 tracking-[-0.02em] leading-tight mt-1">{h.label}</div>
              <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-emerald-700">
                <Ic.ArrowUp size={13} /> <span className="mono">{h.trend} pts</span><span className="text-slate-400">· 30 days</span>
              </div>
            </div>
          </div>
          {/* headline + next */}
          <div className="col-span-12 md:col-span-8 p-6 flex flex-col justify-center">
            <p className="text-[15px] text-slate-700 leading-[1.55] max-w-[62ch]">{h.headline}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={() => onNav('evidence')} className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-600/20 text-[12.5px] font-medium hover:bg-orange-100 transition-colors">
                <Ic.ArrowRight size={14} /> Next: renew your CA license <span className="text-orange-600">· 30 days</span>
              </button>
              <span className="text-[12px] text-slate-400">then verify DEA to unlock 32 more roles</span>
            </div>
          </div>
        </div>

        {/* the five questions */}
        <div className="grid grid-cols-2 md:grid-cols-5 border-t border-slate-200 divide-x divide-slate-200">
          {h.answers.map((a, i) => {
            const I = Ic[a.icon];
            const target = { identity: 'evidence', have: 'evidence', missing: 'evidence', trust: 'trust', next: 'evidence' }[a.key];
            return (
              <button key={i} onClick={() => onNav(target)} className={wcn('text-left p-4 hover:bg-slate-50 transition-colors', i >= 4 && 'col-span-2 md:col-span-1', i === 2 && 'border-t md:border-t-0 border-slate-200')}>
                <div className="flex items-center gap-1.5 mono text-[9.5px] uppercase tracking-[0.1em] text-slate-400">
                  <I size={12} className={toneClass[a.tone]} /> {a.q}
                </div>
                <div className="text-[15px] font-semibold text-slate-900 tracking-[-0.01em] mt-1.5 leading-tight">{a.a}</div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">{a.sub}</div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── status grid ── */}
      <div className="grid grid-cols-12 gap-6">
        {/* Evidence status */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <Card>
            <SecHead icon="ShieldCheck" title="Evidence Status" right={<LinkMore label="All evidence" onClick={() => onNav('evidence')} />} />
            <div className="px-5 pb-5">
              {/* stacked bar */}
              <div className="flex h-2.5 rounded-sm overflow-hidden gap-px bg-slate-100 mb-4">
                <div className="bg-emerald-600" style={{ flex: v }} title={`${v} verified`} />
                <div className="bg-amber-500" style={{ flex: p }} title={`${p} in flight`} />
                <div className="bg-orange-500" style={{ flex: x }} title={`${x} expiring`} />
                <div className="bg-slate-300" style={{ flex: m }} title={`${m} missing`} />
              </div>
              <div className="grid grid-cols-4 gap-3">
                <CountCell n={v} label="Verified" state="verified" onClick={() => onNav('evidence')} />
                <CountCell n={p} label="In flight" state="pending" onClick={() => onNav('evidence')} />
                <CountCell n={x} label="Expiring" state="expiring" onClick={() => onNav('evidence')} />
                <CountCell n={m} label="Missing"  state="missing" onClick={() => onNav('evidence')} />
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                {W.EVIDENCE.filter(e => e.status === 'expiring' || e.status === 'missing').slice(0, 3).map(e => (
                  <button key={e.id} onClick={() => onNav('evidence')} className="w-full flex items-center justify-between gap-3 text-left group">
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className={wcn('h-1.5 w-1.5 rounded-full flex-none', WSTATE[e.status].dot)} />
                      <span className="text-[13px] text-slate-700 group-hover:text-slate-900 truncate">{e.label}</span>
                      <span className="text-[11.5px] text-slate-400 truncate hidden sm:inline">{e.summary}</span>
                    </span>
                    <Chip state={e.status} sm>{e.status === 'expiring' ? `${e.daysLeft}d` : 'Add'}</Chip>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Timeline snapshot */}
          <Card>
            <SecHead icon="Activity" title="Timeline Snapshot" right={<LinkMore label="Full timeline" onClick={() => onNav('timeline')} />} />
            <div className="px-5 pb-5">
              <div className="relative pl-5">
                <div className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-slate-200" />
                {W.TIMELINE.slice(0, 4).map(t => (
                  <div key={t.id} className="relative pb-4 last:pb-0">
                    <span className={wcn('absolute -left-5 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white', KIND_DOT[t.kind])} />
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="text-[13px] font-medium text-slate-900">{t.title}</div>
                      <div className="mono text-[10.5px] text-slate-400 flex-none">{t.date}</div>
                    </div>
                    <div className="text-[12px] text-slate-500 mt-0.5 leading-snug">{t.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* right rail */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Trust status */}
          <Card>
            <SecHead icon="Gauge" title="Trust Status" right={<LinkMore label="Details" onClick={() => onNav('trust')} />} />
            <div className="px-5 pb-5">
              <div className="flex items-baseline gap-2">
                <div className="text-[15px] font-semibold text-slate-900">{strongDims} of {W.TRUST_DIMENSIONS.length} dimensions <span className="text-emerald-700">strong</span></div>
              </div>
              <p className="text-[11.5px] text-slate-500 mt-1 leading-snug">Compared only to an anonymous field median — never to a named peer.</p>
              <div className="mt-4 space-y-2.5">
                {W.TRUST_DIMENSIONS.map(d => (
                  <button key={d.id} onClick={() => onNav('trust')} className="w-full group">
                    <div className="flex items-center justify-between text-[11.5px] mb-1">
                      <span className="text-slate-700 font-medium group-hover:text-slate-900">{d.label}</span>
                      <span className={wcn('mono text-[10px] uppercase tracking-[0.06em]', DIM_STATE[d.state].text)}>{DIM_STATE[d.state].label}</span>
                    </div>
                    <Meter pct={d.score} mark={d.median} fill={DIM_STATE[d.state].fill} h="h-1.5" />
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Recent activity */}
          <Card>
            <SecHead icon="Bell" title="Recent Activity" right={<span className="mono text-[10px] text-slate-400">last 30d</span>} fallbackIcon="Activity" />
            <div className="px-5 pb-5 space-y-3">
              {W.TRUST_HISTORY.slice(0, 4).map((e, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className={wcn('mt-1.5 h-1.5 w-1.5 rounded-full flex-none', TONE_DOT[e.tone])} />
                  <div className="min-w-0">
                    <div className="text-[12.5px] text-slate-700 leading-snug">{e.msg}</div>
                    <div className="mono text-[10px] text-slate-400 mt-0.5">{e.src} · {e.t.split(' · ')[0]}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── shared bits used across views ──
const KIND_DOT = { career: 'bg-slate-900', recognition: 'bg-indigo-500', trust: 'bg-emerald-500' };
const TONE_DOT = { ok: 'bg-emerald-500', warn: 'bg-orange-500', info: 'bg-sky-500', muted: 'bg-slate-300' };
window.KIND_DOT = KIND_DOT; window.TONE_DOT = TONE_DOT;

function SecHead({ icon, title, right, fallbackIcon }) {
  const I = window.Icon[icon] || window.Icon[fallbackIcon] || window.Icon.Activity;
  return (
    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <I size={15} className="text-slate-700" />
        <h2 className="text-[14px] font-semibold text-slate-900 tracking-[-0.01em]">{title}</h2>
      </div>
      {right}
    </div>
  );
}
function LinkMore({ label, onClick }) {
  return <button onClick={onClick} className="inline-flex items-center gap-1 text-[11.5px] text-slate-500 hover:text-slate-900 font-medium">{label} <window.Icon.ChevronRight size={13} /></button>;
}
function CountCell({ n, label, state, onClick }) {
  const m = WSTATE[state];
  return (
    <button onClick={onClick} className="text-left rounded-md border border-slate-200 px-3 py-2.5 hover:border-slate-400 transition-colors">
      <div className={wcn('text-[22px] font-semibold tracking-[-0.02em] tabular-nums', m.text)}>{n}</div>
      <div className="mono text-[10px] uppercase tracking-[0.1em] text-slate-500 mt-0.5">{label}</div>
    </button>
  );
}
window.SecHead = SecHead; window.LinkMore = LinkMore; window.CountCell = CountCell;
window.ViewHome = ViewHome;

// Bell icon (used by Recent Activity)
window.Icon.Bell = (p) => (<svg {...{width:p.size||16,height:p.size||16}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p.strokeWidth||1.75} strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>);
