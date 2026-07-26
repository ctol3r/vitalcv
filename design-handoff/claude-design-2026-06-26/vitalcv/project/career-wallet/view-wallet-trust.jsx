// ════════════════════════════════════════════════════════════════════════
// D4 · MY TRUST — how trusted you are. Dimensions · Sources · History.
// A profile, never a popularity score. Every bar dereferences to its evidence.
// ════════════════════════════════════════════════════════════════════════

function ViewTrust({ onNav }) {
  const dims = W.TRUST_DIMENSIONS;
  const strong = dims.filter(d => d.state === 'strong').length;
  const avg = Math.round(dims.reduce((s, d) => s + d.score, 0) / dims.length);

  return (
    <div>
      <PageHead icon="Gauge" route="vitalcv.health/wallet/trust" title="My Trust"
        sub="Credibility at what — shown as a profile you can audit, compared only to an anonymous field median."
        actions={<Btn variant="outline" sm iconLeft={<Ic.ShieldCheck size={14} />} onClick={() => onNav('evidence')}>See the evidence</Btn>} />

      {/* composite + principle */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        <Card className="col-span-12 md:col-span-5 p-5 flex items-center gap-5">
          <div className="flex-none text-center">
            <div className="text-[40px] font-semibold text-slate-900 tracking-[-0.03em] leading-none tabular-nums">{strong}<span className="text-slate-300">/{dims.length}</span></div>
            <div className="mono text-[10px] uppercase tracking-[0.12em] text-emerald-700 mt-1">strong</div>
          </div>
          <div className="border-l border-slate-200 pl-5">
            <Eyebrow>Trust profile</Eyebrow>
            <p className="text-[13px] text-slate-700 mt-1.5 leading-snug">Identity and standing are proven; enrollment and education are still building. <span className="text-slate-500">No single number — the shape is the point.</span></p>
          </div>
        </Card>
        <Card className="col-span-12 md:col-span-7 p-5">
          <div className="flex items-center gap-2 mb-2.5"><Ic.Network size={15} className="text-slate-700" /><div className="text-[13px] font-semibold text-slate-900">This is not a social score</div></div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-1.5">
            {PRINCIPLES.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px] text-slate-600">
                <span className="h-4 w-4 rounded-full border border-dashed border-slate-400 flex items-center justify-center flex-none"><Ic.X size={9} className="text-slate-400" /></span>
                {p}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Trust Dimensions ── */}
      <Card className="mb-6">
        <SecHead icon="Layers" title="Trust Dimensions" right={<span className="mono text-[10px] text-slate-400">dashed mark · field median</span>} />
        <div className="p-5 space-y-4">
          {dims.map(d => (
            <div key={d.id} className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-12 sm:col-span-3">
                <div className="text-[13.5px] font-semibold text-slate-900">{d.label}</div>
                <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{d.note}</div>
              </div>
              <div className="col-span-9 sm:col-span-6">
                <Meter pct={d.score} mark={d.median} fill={DIM_STATE[d.state].fill} h="h-3.5" />
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {d.fed.map((f, i) => <span key={i} className="mono text-[9.5px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-px">{f}</span>)}
                  {d.flag && <span className="mono text-[9.5px] text-orange-700 bg-orange-50 border border-orange-200 rounded px-1.5 py-px">{d.flag}</span>}
                </div>
              </div>
              <div className="col-span-3 sm:col-span-3 text-right">
                <div className="text-[15px] font-semibold text-slate-900 tabular-nums">{d.score}</div>
                <div className={wcn('mono text-[9.5px] uppercase tracking-[0.08em]', DIM_STATE[d.state].text)}>{DIM_STATE[d.state].label}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-6">
        {/* ── Trust Sources ── */}
        <div className="col-span-12 lg:col-span-7">
          <Card>
            <SecHead icon="ShieldCheck" title="Trust Sources" right={<span className="mono text-[10px] text-slate-400">{W.TRUST_SOURCES.length} authorities</span>} />
            <div className="divide-y divide-slate-100">
              {W.TRUST_SOURCES.map(s => (
                <div key={s.id} className="px-5 py-3.5 flex items-center gap-4">
                  <TierBadge tier={s.tier} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-slate-900">{s.name}</span>
                      <span className="mono text-[10px] text-slate-400 truncate hidden sm:inline">{s.org}</span>
                    </div>
                    <div className="text-[12px] text-slate-500 mt-0.5">Confirms <span className="text-slate-700">{s.confirms}</span></div>
                  </div>
                  <div className="w-24 hidden sm:block">
                    <Meter pct={s.fresh} fill={s.state === 'verified' ? 'bg-emerald-600' : s.state === 'expiring' ? 'bg-orange-500' : 'bg-amber-500'} h="h-1.5" />
                    <div className="mono text-[9.5px] text-slate-400 mt-1 text-right">{s.last}</div>
                  </div>
                  <Chip state={s.state === 'verified' ? 'verified' : s.state === 'expiring' ? 'expiring' : 'pending'} sm className="flex-none" />
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 mono text-[10.5px] text-slate-400">
              Ladder: T1 public · T2 federated · T3 authoritative · T4 primary-sealed
            </div>
          </Card>
        </div>

        {/* ── Trust History ── */}
        <div className="col-span-12 lg:col-span-5">
          <Card>
            <SecHead icon="Activity" title="Trust History" right={<span className="mono text-[10px] text-slate-400">verification events</span>} />
            <div className="px-5 py-4">
              <div className="relative pl-5">
                <div className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-slate-200" />
                {W.TRUST_HISTORY.map((e, i) => (
                  <div key={i} className="relative pb-4 last:pb-0">
                    <span className={wcn('absolute -left-5 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white', TONE_DOT[e.tone])} />
                    <div className="text-[12.5px] text-slate-700 leading-snug">{e.msg}</div>
                    <div className="mono text-[10px] text-slate-400 mt-0.5">{e.src} · {e.t}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const PRINCIPLES = ['No followers or connections', 'No feed or virality', 'No public leaderboard', 'No score without its evidence'];

window.ViewTrust = ViewTrust;
