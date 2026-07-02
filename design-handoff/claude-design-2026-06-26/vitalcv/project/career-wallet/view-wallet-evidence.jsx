// ════════════════════════════════════════════════════════════════════════
// D2 · MY EVIDENCE — what you can prove. Verified · Pending · Expiring · Missing
// Inspect any item down to its source-bound receipt.
// ════════════════════════════════════════════════════════════════════════

function ViewEvidence({ onNav }) {
  const [filter, setFilter] = React.useState('all');
  const [open, setOpen] = React.useState('identity');

  const counts = {
    all: W.EVIDENCE.length,
    verified: W.count('verified'), pending: W.count('pending'),
    expiring: W.count('expiring'), missing: W.count('missing'),
  };
  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'verified', label: 'Verified' },
    { id: 'pending', label: 'In flight' },
    { id: 'expiring', label: 'Expiring' },
    { id: 'missing', label: 'Missing' },
  ];
  const list = filter === 'all' ? W.EVIDENCE : W.EVIDENCE.filter(e => e.status === filter);

  return (
    <div>
      <PageHead icon="ShieldCheck" route="vitalcv.health/wallet/evidence" title="My Evidence"
        sub="Every credential, source-bound. Missing isn't negative — it just means not yet collected."
        actions={<Btn variant="outline" sm iconLeft={<Ic.Plus size={14} />}>Add evidence</Btn>} />

      {/* filter tabs */}
      <div className="flex items-center gap-1 mb-5 border-b border-slate-200">
        {tabs.map(t => {
          const on = filter === t.id;
          const m = WSTATE[t.id];
          return (
            <button key={t.id} onClick={() => setFilter(t.id)}
              className={wcn('px-3.5 h-9 -mb-px border-b-2 text-[13px] font-medium flex items-center gap-2 transition-colors',
                on ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900')}>
              {t.id !== 'all' && <span className={wcn('h-1.5 w-1.5 rounded-full', m.dot)} />}
              {t.label}
              <span className={wcn('mono text-[10.5px] px-1.5 rounded', on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500')}>{counts[t.id]}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2.5">
        {list.map(e => (
          <EvidenceRow key={e.id} e={e} open={open === e.id} onToggle={() => setOpen(open === e.id ? null : e.id)} />
        ))}
      </div>

      {/* legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-[11.5px] text-slate-500">
        <Legend dot="bg-emerald-600" text="Verified at primary source" />
        <Legend dot="bg-amber-500" text="Query in flight — auto-updates" />
        <Legend dot="bg-orange-500" text="Valid now, renews soon" />
        <Legend dot="bg-slate-300" text="Not yet collected" />
      </div>
    </div>
  );
}

function Legend({ dot, text }) {
  return <span className="inline-flex items-center gap-1.5"><span className={wcn('h-2 w-2 rounded-full', dot)} />{text}</span>;
}

function EvidenceRow({ e, open, onToggle }) {
  const m = WSTATE[e.status];
  const missing = e.status === 'missing';
  return (
    <div className={wcn('border rounded-lg bg-white overflow-hidden transition-colors',
      open ? 'border-slate-300' : 'border-slate-200', missing && 'border-dashed')}>
      <button onClick={onToggle} className="w-full text-left px-4 py-3.5 flex items-center gap-4 hover:bg-slate-50/60 transition-colors">
        <div className={wcn('h-9 w-9 rounded-md flex items-center justify-center ring-1 ring-inset flex-none', m.chip)}>
          <m.Icon size={16} strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[14px] font-semibold text-slate-900 leading-tight">{e.label}</span>
            <span className="mono text-[10px] uppercase tracking-[0.08em] text-slate-400">{e.category}</span>
            <TierBadge tier={e.tier} sm />
          </div>
          <div className="text-[12.5px] text-slate-500 mt-0.5 truncate">{e.summary}</div>
        </div>
        <div className="hidden md:flex flex-col items-end text-right flex-none mr-1">
          <span className="mono text-[10px] uppercase tracking-[0.1em] text-slate-400">{e.source}</span>
          {e.expires
            ? <span className={wcn('mono text-[11px] mt-0.5', e.status === 'expiring' ? 'text-orange-700' : 'text-slate-500')}>exp {e.expires}</span>
            : <span className="mono text-[11px] mt-0.5 text-slate-400">{e.checkedAt}</span>}
        </div>
        <Chip state={e.status} className="flex-none">{e.status === 'expiring' ? `${e.daysLeft} days` : m.label}</Chip>
        <Ic.ChevronDown size={16} className={wcn('text-slate-400 transition-transform flex-none', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100">
          {missing ? (
            <div className="grid grid-cols-12 gap-5 pt-3">
              <div className="col-span-12 md:col-span-7">
                <Eyebrow className="mb-2">Why this matters</Eyebrow>
                <p className="text-[13px] text-slate-600 leading-[1.55]">{e.impact}</p>
                <div className="mt-3 border border-slate-200 rounded-md divide-y divide-slate-100">
                  {e.rows.map((r, i) => <KVrow key={i} k={r.k} v={r.v} mono={r.mono} />)}
                </div>
              </div>
              <div className="col-span-12 md:col-span-5">
                <div className="border border-dashed border-slate-300 rounded-md p-4 bg-slate-50/50 h-full flex flex-col">
                  <div className="flex items-center gap-2 text-slate-500"><Ic.Plus size={14} /><span className="mono text-[10.5px] uppercase tracking-[0.12em]">Not on file</span></div>
                  <p className="text-[12.5px] text-slate-600 mt-2 leading-snug flex-1">{e.cadence}.</p>
                  <Btn variant="primary" sm className="mt-3 w-full" iconLeft={<Ic.Plus size={14} />}>Provide {e.label}</Btn>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-5 pt-3">
              <div className="col-span-12 md:col-span-7">
                <Eyebrow className="mb-2">Evidence</Eyebrow>
                <div className="border border-slate-200 rounded-md divide-y divide-slate-100">
                  {e.rows.map((r, i) => <KVrow key={i} k={r.k} v={r.v} mono={r.mono} />)}
                </div>
              </div>
              <div className="col-span-12 md:col-span-5 space-y-3">
                <div>
                  <Eyebrow className="mb-2">Provenance</Eyebrow>
                  <div className="border border-slate-200 rounded-md p-3.5 text-[12.5px] text-slate-600 leading-[1.5]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Ic.ShieldCheck size={14} className="text-slate-500" />
                      <span className="text-slate-900 font-medium">{e.authority}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <TierBadge tier={e.tier} />
                      <span className="text-[11.5px] text-slate-500">{(W.TRUST_TIERS[e.tier]||{}).desc}</span>
                    </div>
                    <p className="mt-2 text-[11.5px] text-slate-500">{e.cadence}.</p>
                  </div>
                </div>
                {e.receipt ? (
                  <div className="bg-slate-900 rounded-md px-3.5 py-3 text-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5"><Ic.Stamp size={12} className="text-slate-300" /><span className="mono text-[10px] uppercase tracking-[0.12em] text-slate-300">Receipt</span></div>
                      <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-emerald-400">replayable</span>
                    </div>
                    <div className="mono text-[11px] text-slate-100 break-all mt-1.5">{e.receipt}</div>
                  </div>
                ) : (
                  <div className="border border-amber-200 bg-amber-50 rounded-md px-3.5 py-3 flex items-center gap-2 text-amber-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 pulse-soft" />
                    <span className="mono text-[10.5px] uppercase tracking-[0.1em]">Receipt issued on completion</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KVrow({ k, v, mono }) {
  return (
    <div className="flex items-baseline justify-between gap-5 px-3.5 py-2">
      <span className="text-[11px] uppercase tracking-[0.06em] text-slate-500 flex-none">{k}</span>
      <span className={wcn('text-[12.5px] text-slate-900 text-right', mono && 'mono text-[11.5px]')}>{v}</span>
    </div>
  );
}

window.ViewEvidence = ViewEvidence;
