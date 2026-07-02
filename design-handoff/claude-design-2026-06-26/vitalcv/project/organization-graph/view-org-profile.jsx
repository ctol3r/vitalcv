// ════════════════════════════════════════════════════════════════════════
// W265-D1 · ORGANIZATION PROFILE — /organizations/[id]
// Identity · Facilities · Specialties · Open opportunities · Affiliations
// ════════════════════════════════════════════════════════════════════════

function DemandDot({ demand }) {
  const m = { high: ['bg-emerald-500', 'High demand'], med: ['bg-sky-500', 'Active'], low: ['bg-slate-300', 'Stable'] }[demand] || ['bg-slate-300', ''];
  return <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500"><span className={gcn('h-1.5 w-1.5 rounded-full', m[0])} />{m[1]}</span>;
}

function FacilityRow({ f }) {
  return (
    <div className="flex items-start gap-3.5 px-5 py-3.5 border-b border-slate-100 last:border-0">
      <div className={gcn('h-9 w-9 rounded-md flex items-center justify-center flex-none mt-0.5', f.lead ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500')}>
        {f.beds > 0 ? <Ic.Bed size={16} /> : <Ic.Building2 size={16} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13.5px] font-medium text-slate-900 leading-tight">{f.name}</span>
          {f.lead && <span className="mono text-[9px] uppercase tracking-[0.08em] text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">Flagship</span>}
          {f.verified && <Ic.Verified size={13} className="text-emerald-600" />}
        </div>
        <div className="flex items-center gap-2 mt-1 text-[11.5px] text-slate-500 flex-wrap">
          <span className="flex items-center gap-1"><Ic.MapPin size={11} className="text-slate-400" />{f.city}</span>
          <span className="text-slate-300">·</span>
          <span>{f.type}</span>
        </div>
      </div>
      <div className="flex-none text-right">
        {f.beds > 0 ? <div className="mono text-[12px] text-slate-700 tabular-nums">{f.beds} beds</div>
          : <div className="mono text-[12px] text-slate-400">ambulatory</div>}
        <div className="mono text-[10px] text-slate-400 mt-0.5">CCN {f.ccn}</div>
      </div>
    </div>
  );
}

function SpecialtyCard({ s }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13.5px] font-medium text-slate-900 leading-tight">{s.name}</div>
        <Ic.Stethoscope size={15} className="text-slate-300 flex-none" />
      </div>
      <p className="text-[11.5px] text-slate-500 mt-1.5 leading-snug">{s.note}</p>
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="mono text-[11px] text-slate-700 tabular-nums">{s.providers} <span className="text-slate-400">providers</span></span>
        <DemandDot demand={s.demand} />
      </div>
    </div>
  );
}

function AffiliationRow({ a }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5 border-b border-slate-100 last:border-0">
      <Ic.Verified size={16} className="text-emerald-600 flex-none mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-slate-900 leading-tight">{a.name}</span>
          <TierBadge tier={a.tier} sm />
        </div>
        <div className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">{a.detail}</div>
      </div>
      <div className="flex-none text-right">
        <div className="mono text-[10.5px] text-slate-400 uppercase tracking-[0.06em]">{a.kind}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">{a.expires ? `to ${a.expires}` : `since ${a.since}`}</div>
      </div>
    </div>
  );
}

function OpenReqRow({ c, onOpen }) {
  const st = G.CONTAINER_STATUS[c.status];
  return (
    <button onClick={() => onOpen(c.id)} className="w-full text-left flex items-center gap-3.5 px-5 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
      <div className="h-9 w-9 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center flex-none"><Ic.Briefcase size={15} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13.5px] font-medium text-slate-900 leading-tight">{c.title}</span>
          <span className={gcn('inline-flex items-center gap-1 rounded-full ring-1 ring-inset text-[10px] font-medium px-1.5 py-0.5', st.chip)}><span className={gcn('h-1.5 w-1.5 rounded-full', st.dot)} />{st.label}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11.5px] text-slate-500 flex-wrap">
          <span>{c.specialty}</span><span className="text-slate-300">·</span>
          <span>{c.employment}</span><span className="text-slate-300">·</span>
          <span className="mono">{c.id}</span>
        </div>
      </div>
      <div className="hidden sm:block flex-none text-right">
        <div className="mono text-[12px] text-slate-700">{c.comp}</div>
        <div className="text-[11px] text-slate-400">{c.openings} opening{c.openings !== 1 && 's'}</div>
      </div>
      <Ic.ChevronRight size={15} className="text-slate-300 flex-none" />
    </button>
  );
}

function ViewProfile({ org, onNav, onOpen }) {
  const id = org.identity;
  const openReqs = G.containersFor(org.id).filter(c => c.status === 'open' || c.status === 'pooled');
  return (
    <div>
      {/* identity banner */}
      <Card className="overflow-hidden mb-6">
        <div className="p-6 flex flex-wrap items-start gap-5">
          <OrgMark org={org} size={64} className="rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="mono text-[10.5px] text-slate-400 tracking-[0.04em]">vitalcv.health/organizations/{org.id}</div>
            <div className="flex items-center gap-2.5 flex-wrap mt-1">
              <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-slate-900 leading-none">{org.name}</h1>
              <VerifiedTag>Identity verified</VerifiedTag>
            </div>
            <p className="text-[13px] text-slate-500 mt-2 leading-snug">{org.tagline}</p>
            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-3 text-[12px] text-slate-600">
              <span className="flex items-center gap-1.5"><Ic.MapPin size={13} className="text-slate-400" />{id.hq}</span>
              <span className="flex items-center gap-1.5"><Ic.Globe size={13} className="text-slate-400" />{id.website}</span>
              <span className="flex items-center gap-1.5"><Ic.Calendar size={13} className="text-slate-400" />Est. {id.founded}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-none">
            <Btn variant="outline" sm iconLeft={<Ic.Network size={14} />} onClick={() => onNav('graph')}>Relationships</Btn>
            <Btn variant="primary" sm iconLeft={<Ic.Briefcase size={14} />} onClick={() => onNav('opportunities')}>Opportunities</Btn>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 divide-x divide-slate-200 border-t border-slate-200">
          {[
            ['facilities', org.stats.facilities, 'Facilities'],
            ['beds', org.stats.beds, 'Licensed beds'],
            ['providers', org.stats.providers.toLocaleString(), 'Providers'],
            ['specialties', org.stats.specialties, 'Specialties'],
            ['openReqs', org.stats.openReqs, 'Open reqs'],
            ['affiliations', org.stats.affiliations, 'Affiliations'],
          ].map(([k, v, l], i) => (
            <div key={k} className={gcn('p-4', i >= 4 && 'hidden lg:block', i >= 2 && i < 4 && 'border-t sm:border-t-0 border-slate-200')}>
              <Stat value={v} label={l} />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-6">
        {/* left column */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          <Card>
            <SecHead icon="Building2" title="Facilities" sub={`${org.facilities.length} verified sites under one organization NPI`} />
            <div>{org.facilities.map(f => <FacilityRow key={f.id} f={f} />)}</div>
          </Card>

          <Card>
            <SecHead icon="Stethoscope" title="Specialties" sub={`${org.specialties.length} of ${org.stats.specialties} service lines shown`} />
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {org.specialties.map(s => <SpecialtyCard key={s.id} s={s} />)}
            </div>
          </Card>
        </div>

        {/* right column */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <Card>
            <SecHead icon="Fingerprint" title="Organization identity" sub="Resolved at the federal registry" right={<TierBadge tier="T4" />} />
            <div className="px-5 py-2">
              <KV k="Legal name" v={id.legalName} />
              <KV k="Organization NPI" v={id.orgNpi} mono />
              <KV k="Medicare CCN" v={id.ccn} mono />
              <KV k="Entity type" v={id.entityType} />
              <KV k="Taxonomy" v={id.taxonomy} mono />
              <KV k="Tax status" v={id.taxStatus} />
              <KV k="Headquarters" v={id.hq} />
            </div>
          </Card>

          <Card>
            <SecHead icon="Briefcase" title="Open opportunities" sub="Organization-owned containers" right={
              <button onClick={() => onNav('opportunities')} className="text-[11.5px] font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">All <Ic.ChevronRight size={12} /></button>
            } />
            <div>{openReqs.map(c => <OpenReqRow key={c.id} c={c} onOpen={onOpen} />)}</div>
          </Card>

          <Card>
            <SecHead icon="ShieldCheck" title="Verified affiliations" sub="Accreditations & recognitions" right={
              <button onClick={() => onNav('trust')} className="text-[11.5px] font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">Trust <Ic.ChevronRight size={12} /></button>
            } />
            <div>{org.affiliations.map(a => <AffiliationRow key={a.id} a={a} />)}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

window.ViewProfile = ViewProfile;
