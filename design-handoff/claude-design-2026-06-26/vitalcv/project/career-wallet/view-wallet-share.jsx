// ════════════════════════════════════════════════════════════════════════
// D5 · SHARE EXPERIENCE — generate a Career Packet or Evidence Packet and
// hand out scoped, expiring share links. Built on the packet infrastructure.
// ════════════════════════════════════════════════════════════════════════

function ViewShare() {
  const [links, setLinks] = React.useState(W.SHARE_LINKS);
  const [gen, setGen] = React.useState(null);      // packet being generated
  const [justMade, setJustMade] = React.useState(null);

  const generate = (packet) => {
    setGen(packet.id);
    setTimeout(() => {
      const token = 'vcv.health/s/' + Math.random().toString(16).slice(2, 10);
      const link = { id: 'l' + Date.now(), label: 'New share link', scope: packet.name, created: W.NOW_DATE, expires: 'in 30 days', views: 0, state: 'active', token, fresh: true };
      setLinks(ls => [link, ...ls]);
      setGen(null); setJustMade(link.id);
      setTimeout(() => setJustMade(null), 4000);
    }, 1400);
  };
  const revoke = (id) => setLinks(ls => ls.map(l => l.id === id ? { ...l, state: 'expired', expires: 'revoked' } : l));

  return (
    <div>
      <PageHead icon="Share2" route="vitalcv.health/wallet/share" title="Share Experience"
        sub="Hand a verifier a sealed, replayable packet — scoped to exactly what they need, expiring when you choose." />

      {/* packets */}
      <div className="grid grid-cols-12 gap-6 mb-8">
        {W.PACKETS.map(p => {
          const I = Ic[p.icon];
          return (
            <Card key={p.id} className="col-span-12 md:col-span-6 overflow-hidden flex flex-col">
              <div className="p-5 flex items-start gap-3.5 border-b border-slate-100">
                <div className="h-11 w-11 rounded-lg bg-slate-900 text-white flex items-center justify-center flex-none"><I size={20} /></div>
                <div>
                  <div className="text-[16px] font-semibold text-slate-900 tracking-[-0.01em]">{p.name}</div>
                  <div className="text-[12.5px] text-slate-500 mt-0.5">{p.tagline}</div>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <p className="text-[13px] text-slate-600 leading-[1.55]">{p.desc}</p>
                <div className="mt-4 space-y-1.5">
                  {p.includes.map((inc, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12.5px] text-slate-700">
                      <Ic.Check size={13} className="text-emerald-600 flex-none" strokeWidth={2.5} /> {inc}
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-[11.5px]">
                    <span className="text-slate-500"><b className="text-slate-900 font-semibold">{p.verified}</b>/{p.items} verified</span>
                    <span className="text-slate-300">·</span>
                    <span className="mono text-[10.5px] text-slate-400">{p.format}</span>
                  </div>
                  <Btn variant="primary" sm iconLeft={<Ic.Link size={14} />} onClick={() => generate(p)} disabled={gen === p.id}>
                    {gen === p.id ? 'Sealing…' : 'Generate link'}
                  </Btn>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* share links */}
      <Card>
        <SecHead icon="Link" title="Share Links" right={<span className="mono text-[10px] text-slate-400">{links.filter(l => l.state === 'active').length} active</span>} />
        <div className="divide-y divide-slate-100">
          {links.map(l => (
            <div key={l.id} className={wcn('px-5 py-3.5 flex items-center gap-4 transition-colors', justMade === l.id && 'bg-emerald-50/60')}>
              <div className={wcn('h-8 w-8 rounded-md flex items-center justify-center flex-none ring-1 ring-inset',
                l.state === 'active' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-slate-100 text-slate-400 ring-slate-300')}>
                {l.state === 'active' ? <Ic.Link size={14} /> : <Ic.Trash size={14} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13.5px] font-semibold text-slate-900">{l.label}</span>
                  <span className="mono text-[10px] uppercase tracking-[0.08em] text-slate-400 bg-slate-50 border border-slate-200 rounded px-1.5 py-px">{l.scope}</span>
                  {justMade === l.id && <Chip state="verified" sm>New</Chip>}
                </div>
                <div className="mono text-[11px] text-slate-500 mt-1 truncate">{l.token}</div>
              </div>
              <div className="hidden md:flex flex-col items-end text-right flex-none">
                <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500"><Ic.Eye size={12} /> {l.views} views</div>
                <div className={wcn('mono text-[10.5px] mt-0.5', l.state === 'active' ? 'text-slate-500' : 'text-slate-400')}>{l.created}</div>
              </div>
              <div className="flex items-center gap-2 flex-none">
                <span className={wcn('mono text-[10.5px] uppercase tracking-[0.08em]', l.state === 'active' ? 'text-emerald-700' : 'text-slate-400')}>{l.expires}</span>
                {l.state === 'active'
                  ? <Btn variant="ghost" sm onClick={() => revoke(l.id)} className="text-slate-400 hover:text-red-600"><Ic.Trash size={14} /></Btn>
                  : <span className="mono text-[10px] uppercase tracking-[0.1em] text-slate-300 px-2">revoked</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2 text-[11.5px] text-slate-500">
          <Ic.ShieldLock size={13} className="text-slate-400" />
          Every link carries only the scope you choose and expires on your schedule. Recipients replay receipts without trusting VitalCV.
        </div>
      </Card>

      {gen && <SealOverlay packet={W.PACKETS.find(p => p.id === gen)} />}
    </div>
  );
}

function SealOverlay({ packet }) {
  const [phase, setPhase] = React.useState(0);
  const phases = ['Collecting verified evidence…', 'Computing Merkle root…', 'Signing with your wallet key…', 'Minting scoped share link…'];
  React.useEffect(() => {
    const t = setInterval(() => setPhase(p => Math.min(p + 1, phases.length - 1)), 330);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="fixed inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center">
      <div className="border border-slate-200 rounded-lg bg-white p-7 w-[440px] text-center shadow-xl">
        <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-3">Sealing {packet.name}</div>
        <div className="text-[17px] font-semibold text-slate-900 tracking-[-0.01em]">Bundling your evidence into a<br />cryptographically-bound packet.</div>
        <div className="mt-5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-slate-900 transition-all" style={{ width: `${((phase + 1) / phases.length) * 100}%` }} />
        </div>
        <div className="mono text-[11px] text-slate-500 mt-3 h-4">{phases[phase]}</div>
      </div>
    </div>
  );
}

window.ViewShare = ViewShare;
