// ════════════════════════════════════════════════════════════════════════
// view-providers.jsx — D2 · /org/providers · Provider Directory
// Every clinician: Evidence · Trust · Readiness · Timeline · Mobility · Relationship
// ════════════════════════════════════════════════════════════════════════

function ProviderDirectory({ onNav }) {
  const [q, setQ] = React.useState('');
  const [fReady, setFReady] = React.useState('all');
  const [fFac, setFFac] = React.useState('all');
  const [sort, setSort] = React.useState('trust');
  const [open, setOpen] = React.useState(null);

  const rows = React.useMemo(() => {
    let r = PROVIDERS.filter(p => {
      if (fReady !== 'all' && p.readiness !== fReady) return false;
      if (fFac !== 'all' && p.fac !== fFac) return false;
      if (q && !(`${p.name} ${p.spec} ${p.role} ${p.npi}`.toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
    const order = { ready: 0, watch: 1, gap: 2, blocked: 3 };
    if (sort === 'trust') r = [...r].sort((a, b) => b.trust - a.trust);
    if (sort === 'readiness') r = [...r].sort((a, b) => order[b.readiness] - order[a.readiness]);
    if (sort === 'license') r = [...r].sort((a, b) => a.licDays - b.licDays);
    if (sort === 'name') r = [...r].sort((a, b) => a.name.localeCompare(b.name));
    return r;
  }, [q, fReady, fFac, sort]);

  const readyFilters = [
    { id: 'all', label: 'All', n: PROVIDERS.length },
    { id: 'ready', label: 'Ready', n: PROVIDERS.filter(p => p.readiness === 'ready').length },
    { id: 'watch', label: 'Watch', n: PROVIDERS.filter(p => p.readiness === 'watch').length },
    { id: 'gap', label: 'Action', n: PROVIDERS.filter(p => p.readiness === 'gap').length },
    { id: 'blocked', label: 'Blocked', n: PROVIDERS.filter(p => p.readiness === 'blocked').length },
  ];

  return (
    <div className="space-y-5">
      <SecHead eyebrow={`${ORG.totalProviders} providers · ${PROVIDERS.length} shown in working set`} title="Provider directory"
        sub="One verified record per clinician, owned by them and read by you. Click any provider to open evidence, trust, timeline, mobility, and relationship history." />

      {/* ── Filter bar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Icon.Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, specialty, NPI…"
            className="w-full h-9 pl-9 pr-3 text-[13px] border border-slate-300 rounded-md focus:border-slate-900 focus:outline-none placeholder:text-slate-400" />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-md p-0.5">
          {readyFilters.map(f => (
            <button key={f.id} onClick={() => setFReady(f.id)}
              className={cx('px-2.5 h-8 rounded-[5px] text-[12px] font-medium transition-colors flex items-center gap-1.5',
                fReady === f.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900')}>
              {f.id !== 'all' && <span className={cx('h-1.5 w-1.5 rounded-full', tone(f.id).dot)} />}
              {f.label}<span className="mono text-[10.5px] text-slate-400">{f.n}</span>
            </button>
          ))}
        </div>
        <select value={fFac} onChange={e => setFFac(e.target.value)}
          className="h-9 px-3 text-[12.5px] border border-slate-300 rounded-md focus:border-slate-900 focus:outline-none bg-white text-slate-700">
          <option value="all">All facilities</option>
          {ORG.facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="h-9 px-3 text-[12.5px] border border-slate-300 rounded-md focus:border-slate-900 focus:outline-none bg-white text-slate-700">
          <option value="trust">Sort · Trust</option>
          <option value="readiness">Sort · Readiness</option>
          <option value="license">Sort · License expiry</option>
          <option value="name">Sort · Name</option>
        </select>
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <OCard pad={false} className="overflow-hidden">
        <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50 grid grid-cols-24 gap-3 mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
          <div className="col-span-7">Provider</div>
          <div className="col-span-4">Facility · Type</div>
          <div className="col-span-5">Trust</div>
          <div className="col-span-3">Evidence</div>
          <div className="col-span-3">License</div>
          <div className="col-span-2 text-right">State</div>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map(p => (
            <ProviderRow key={p.id} p={p} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} onNav={onNav} />
          ))}
          {rows.length === 0 && (
            <div className="px-5 py-12 text-center text-[13px] text-slate-400">No providers match these filters.</div>
          )}
        </div>
      </OCard>
    </div>
  );
}

function ProviderRow({ p, open, onToggle, onNav }) {
  const lt = p.licDays < 0 ? 'blocked' : p.licDays < 90 ? 'watch' : 'verified';
  const et = p.evidence <= 14 ? 'verified' : p.evidence <= 45 ? 'watch' : 'gap';
  return (
    <div className={cx(open && 'bg-slate-50/60')}>
      <button onClick={onToggle} className="w-full text-left px-5 py-3 grid grid-cols-24 gap-3 items-center hover:bg-slate-50 transition-colors">
        <div className="col-span-7 flex items-center gap-3 min-w-0">
          <Avatar initials={p.initials} size="sm" />
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-slate-900 truncate">{p.name}, {p.role}</div>
            <div className="text-[11.5px] text-slate-500 truncate">{p.spec}</div>
          </div>
        </div>
        <div className="col-span-4 min-w-0">
          <div className="text-[12px] text-slate-700">{FAC_FULL[p.fac]}</div>
          <div className="mono text-[10.5px] text-slate-400 uppercase tracking-[0.06em]">{p.emp}</div>
        </div>
        <div className="col-span-5"><TrustCell value={p.trust} /></div>
        <div className="col-span-3">
          <span className={cx('mono text-[11.5px] font-medium', tone(et).text)}>{p.evidence}d ago</span>
        </div>
        <div className="col-span-3">
          <span className={cx('mono text-[11.5px] font-medium', tone(lt).text)}>
            {p.licDays < 0 ? `−${Math.abs(p.licDays)}d` : `${p.licDays}d`}
          </span>
        </div>
        <div className="col-span-2 flex items-center justify-end gap-2">
          <Pill t={p.readiness} dot={p.readiness !== 'ready'}>{READINESS_LABEL[p.readiness]}</Pill>
          <Icon.ChevronDown size={14} className={cx('text-slate-300 transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && <ProviderDetail p={p} onNav={onNav} />}
    </div>
  );
}

// the six required facets
function ProviderDetail({ p, onNav }) {
  const timeline = buildTimeline(p);
  return (
    <div className="px-5 pb-5 pt-1 grid grid-cols-12 gap-5 border-t border-slate-200/70 bg-white">
      {/* header strip */}
      <div className="col-span-12 flex items-center justify-between pt-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Avatar initials={p.initials} size="lg" />
          <div>
            <div className="text-[16px] font-semibold text-slate-900">{p.name}, {p.role}</div>
            <div className="text-[12px] text-slate-500">NPI <span className="mono text-slate-700">{p.npi}</span> · {p.spec} · {FAC_FULL[p.fac]}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-8 px-3 text-[12px] font-medium text-slate-700 border border-slate-300 rounded-md hover:border-slate-500 inline-flex items-center gap-1.5">
            <Icon.FileText size={13} /> Evidence packet
          </button>
          <button className="h-8 px-3 text-[12px] font-medium text-white bg-slate-900 rounded-md hover:bg-black inline-flex items-center gap-1.5">
            <Icon.ExternalLink size={13} /> Open passport
          </button>
        </div>
      </div>

      {/* Facet 1 — Evidence */}
      <Facet icon={Icon.Layers} title="Evidence" span="col-span-12 lg:col-span-4">
        <div className="space-y-1.5">
          {[
            { k: 'NPPES identity', t: 'verified' },
            { k: 'State license · ' + p.licState, t: p.licDays < 0 ? 'blocked' : 'verified' },
            { k: 'OIG / LEIE clear', t: 'verified' },
            { k: 'PECOS / Medicare', t: 'verified' },
            { k: 'DEA registration', t: p.flags.includes('dea-missing') ? 'gap' : 'verified' },
            { k: 'Board certification', t: 'verified' },
          ].map(e => (
            <div key={e.k} className="flex items-center justify-between text-[12px]">
              <span className="text-slate-600">{e.k}</span>
              <span className={cx('flex items-center gap-1.5 mono text-[10.5px] uppercase tracking-[0.06em]', tone(e.t).text)}>
                <span className={cx('h-1.5 w-1.5 rounded-full', tone(e.t).dot)} />
                {e.t === 'verified' ? 'Signed' : e.t === 'gap' ? 'Missing' : 'Expired'}
              </span>
            </div>
          ))}
          <div className="pt-2 mt-1 border-t border-slate-100 text-[11px] text-slate-500">
            Last source pull <span className="mono text-slate-700">{p.evidence}d ago</span> · re-verifiable outside Meridian
          </div>
        </div>
      </Facet>

      {/* Facet 2 — Trust + Facet 3 — Readiness */}
      <Facet icon={Icon.Fingerprint} title="Trust & Readiness" span="col-span-12 lg:col-span-4">
        <div className="flex items-center gap-4">
          <Gauge value={p.trust} t={p.trust >= 90 ? 'verified' : p.trust >= 80 ? 'pending' : 'blocked'} label="trust" size={96} stroke={9} />
          <div className="flex-1 space-y-2.5">
            <div>
              <Eyebrow className="mb-1">Readiness verdict</Eyebrow>
              <Pill t={p.readiness} dot={p.readiness !== 'ready'}>{READINESS_LABEL[p.readiness]}</Pill>
            </div>
            <div className="text-[11.5px] text-slate-500 leading-snug">
              {p.readiness === 'ready' && 'Can work today. All lanes verified and fresh.'}
              {p.readiness === 'watch' && 'Working now; a credential is approaching expiry.'}
              {p.readiness === 'gap' && 'Action required this week to stay compliant.'}
              {p.readiness === 'blocked' && 'Cannot work today. Privileges should be held.'}
            </div>
          </div>
        </div>
        {p.flags.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
            {p.flags.map(f => <span key={f} className="mono text-[10px] uppercase tracking-[0.08em] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{f}</span>)}
          </div>
        )}
      </Facet>

      {/* Facet 5 — Mobility + Facet 6 — Relationship History */}
      <Facet icon={Icon.Route} title="Mobility & Relationship" span="col-span-12 lg:col-span-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Eyebrow className="mb-1">Career mobility</Eyebrow>
            <div className="text-[22px] font-semibold text-slate-900 leading-none">{p.mobility}</div>
            <div className="text-[11px] text-slate-500 mt-1">orgs of continuity · record travels with them</div>
          </div>
          <div>
            <Eyebrow className="mb-1">With Meridian</Eyebrow>
            <div className="text-[22px] font-semibold text-slate-900 leading-none">{(p.tenure / 12).toFixed(1)}<span className="text-[13px] text-slate-400">yr</span></div>
            <div className="text-[11px] text-slate-500 mt-1">{p.tenure} months · {p.emp.toLowerCase()}</div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100">
          <Eyebrow className="mb-1.5">Relationship</Eyebrow>
          <div className="text-[11.5px] text-slate-600 leading-snug">
            {p.tenure > 60 ? 'Long-tenured anchor. High retention signal.'
              : p.emp === 'Locum' ? 'Locum engagement. Portable record, short horizon.'
              : 'Established. Verified on join, refreshed continuously.'}
          </div>
        </div>
      </Facet>

      {/* Facet 4 — Timeline (full width) */}
      <Facet icon={Icon.Activity} title="Timeline" span="col-span-12">
        <div className="relative pl-1">
          <div className="flex items-stretch gap-0">
            {timeline.map((ev, i) => (
              <div key={i} className="flex-1 relative">
                <div className="flex items-center">
                  <span className={cx('h-2.5 w-2.5 rounded-full ring-4 ring-white z-10', tone(ev.t).dot)} />
                  {i < timeline.length - 1 && <span className="flex-1 h-px bg-slate-200" />}
                </div>
                <div className="mt-2 pr-3">
                  <div className="mono text-[10px] uppercase tracking-[0.08em] text-slate-400">{ev.date}</div>
                  <div className="text-[12px] font-medium text-slate-800 mt-0.5 leading-tight">{ev.label}</div>
                  <div className="text-[11px] text-slate-500 leading-snug">{ev.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Facet>
    </div>
  );
}

function Facet({ icon: I, title, span, children }) {
  return (
    <div className={cx('border border-slate-200 rounded-lg p-4', span)}>
      <div className="flex items-center gap-2 mb-3">
        <I size={14} className="text-slate-500" strokeWidth={2} />
        <Eyebrow>{title}</Eyebrow>
      </div>
      {children}
    </div>
  );
}

function buildTimeline(p) {
  const join = new Date(NOW); join.setMonth(join.getMonth() - p.tenure);
  const joinLabel = join.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  const base = [
    { date: joinLabel, label: 'Joined Meridian', sub: `${p.emp} · ${FAC_NAME[p.fac]}`, t: 'slate' },
    { date: 'Record import', label: `${p.mobility} prior orgs merged`, sub: 'Continuity carried in', t: 'slate' },
    { date: `${p.evidence}d ago`, label: 'Sources re-pulled', sub: 'Federal lanes refreshed', t: 'verified' },
  ];
  if (p.licDays < 0) base.push({ date: `${Math.abs(p.licDays)}d ago`, label: 'License lapsed', sub: `${p.licState} · renewal required`, t: 'blocked' });
  else if (p.licDays < 90) base.push({ date: `in ${p.licDays}d`, label: 'License renewal due', sub: `${p.licState} ${p.licType}`, t: 'watch' });
  else base.push({ date: 'Now', label: 'Active & current', sub: 'Cleared to work', t: 'verified' });
  return base;
}

window.ProviderDirectory = ProviderDirectory;
