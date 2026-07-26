// ════════════════════════════════════════════════════════════════════════
// W275-D2 · ORGANIZATION WORKSPACE  —  /workspace/[id]/organization
// The organization side of the room: Profile · Trust · Opportunities · Active Talent
// ════════════════════════════════════════════════════════════════════════

function TrustRow({ s }) {
  const tone = W.STATE_TONE[s.state];
  const fill = s.fresh >= 70 ? 'bg-emerald-500' : s.fresh >= 45 ? 'bg-amber-500' : 'bg-orange-500';
  return (
    <div className="px-5 py-3.5 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-3">
        <span className={gcn('h-2 w-2 rounded-full flex-none', tone.dot)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-slate-900">{s.name}</span>
            <TierBadge tier={s.tier} sm />
          </div>
          <div className="text-[11.5px] text-slate-500 leading-tight mt-0.5">{s.confirms}</div>
        </div>
        <div className="text-right flex-none">
          <div className="mono text-[10.5px] text-slate-400">{s.last}</div>
          <div className={gcn('text-[11px] font-medium', tone.text)}>{tone.label}</div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-2.5">
        <Meter pct={s.fresh} fill={fill} h="h-1" />
        <span className="mono text-[10px] text-slate-400 tabular-nums flex-none w-9 text-right">{s.fresh}%</span>
      </div>
    </div>
  );
}

function TalentRow({ t, onNav }) {
  const rel = W.TALENT_REL[t.relType];
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
      <Avatar initials={t.initials} party="clinician" size={36} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-slate-900 truncate">{t.name}</div>
        <div className="text-[11.5px] text-slate-500 leading-tight truncate">{t.specialty} · <span className="mono text-slate-400">{t.since}</span></div>
      </div>
      <div className="text-right flex-none hidden sm:block">
        <div className="text-[11px] text-slate-500">{t.evidence}</div>
      </div>
      <StatusChip chip={rel.chip} dot={rel.dot} sm>{t.rel}</StatusChip>
    </div>
  );
}

function ViewOrg({ ws, onNav }) {
  const org = W.ORG;
  const opps = W.oppsFor(ws.id);
  const orgOpps = opps.filter(o => o.owner.includes('Cedar') || o.owner.includes('Dana') || o.owner.includes('Marcus') || ws.type === 'organization');
  const shown = ws.type === 'organization' ? opps : opps.slice(0, 3);

  return (
    <div>
      <PageHead icon="Building" route={'/workspace/' + ws.id + '/organization'}
        title="Organization"
        sub="The organization as a first-class member of the workspace — identity, projected trust, owned opportunities, and the talent it operates with."
        actions={<Btn variant="outline" sm iconLeft={<Ic.ExternalLink size={14} />}>Open org graph</Btn>} />

      {/* profile header */}
      <Card className="p-5 mb-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="h-14 w-14 rounded-xl bg-slate-900 text-white flex items-center justify-center font-semibold text-[20px] flex-none">{org.initials}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[19px] font-semibold text-slate-900 tracking-[-0.02em]">{org.name}</h2>
              <VerifiedTag sm>Identity verified</VerifiedTag>
            </div>
            <div className="text-[12.5px] text-slate-500 mt-1">{org.tagline}</div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-emerald-700">
              <Ic.Verified size={12} /> NPI {org.identity.orgNpi} · CCN {org.identity.ccn}
            </div>
          </div>
          <div className="flex items-center gap-6 flex-none">
            <Stat value={org.stats.facilities} label="Facilities" />
            <Stat value={org.stats.providers.toLocaleString()} label="Providers" />
            <Stat value={org.stats.openReqs} label="Open reqs" accent="text-emerald-600" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* profile / identity */}
        <div className="lg:col-span-1 space-y-5">
          <Card>
            <SecHead icon="Fingerprint" title="Profile" sub="Verified organization identity" />
            <div className="px-5 py-1">
              <KV k="Legal name" v={org.identity.legalName} />
              <KV k="Organization NPI" v={org.identity.orgNpi} mono />
              <KV k="CMS CCN" v={org.identity.ccn} mono />
              <KV k="Tax status" v={org.identity.taxStatus} />
              <KV k="Founded" v={org.identity.founded} />
              <KV k="Headquarters" v={org.identity.hq} />
              <KV k="Taxonomy" v={org.identity.taxonomy} />
            </div>
          </Card>
        </div>

        {/* trust */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <SecHead icon="ShieldCheck" title="Trust" sub="Projected from source-bound verification · never one score"
              right={<span className="mono text-[10px] text-slate-400 hidden sm:inline">freshness-aware</span>} />
            <div>{W.TRUST_SOURCES.map(s => <TrustRow key={s.id} s={s} />)}</div>
            <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2 text-[11.5px] text-slate-500">
              <Ic.Info size={13} className="text-slate-400" />
              Trust is the live composition of these sources. Two are aging — routed to the quality office.
            </div>
          </Card>
        </div>
      </div>

      {/* opportunities + active talent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        <Card>
          <SecHead icon="Briefcase" title="Opportunities" sub="Owned declarations · not matches"
            right={<Btn variant="ghost" sm onClick={() => onNav('home')}>All</Btn>} />
          <div className="p-4 space-y-3">
            {shown.map(o => <OppCard key={o.id} o={o} onNav={onNav} />)}
          </div>
        </Card>

        <Card>
          <SecHead icon="Users" title="Active talent" sub="Clinicians the org operates with"
            right={<span className="text-[11px] text-slate-400">by relationship</span>} />
          <div>{W.ACTIVE_TALENT.map(t => <TalentRow key={t.id} t={t} onNav={onNav} />)}</div>
          <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10.5px]">
            {[['employment','Employed'],['review','In review'],['pool','Talent pool'],['observing','Observing']].map(([k, l]) => (
              <span key={k} className="flex items-center gap-1.5 text-slate-500"><span className={gcn('h-1.5 w-1.5 rounded-full', W.TALENT_REL[k].dot)} />{l}</span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

window.ViewOrg = ViewOrg;
