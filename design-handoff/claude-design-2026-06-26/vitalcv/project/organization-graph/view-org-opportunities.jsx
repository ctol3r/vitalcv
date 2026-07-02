// ════════════════════════════════════════════════════════════════════════
// W265-D5 · OPPORTUNITY CONTAINER — organization-owned opportunity objects
// These are CONTAINERS, not matches. A container declares what the org needs.
// No clinician readiness is computed here — matching lives in another layer.
// ════════════════════════════════════════════════════════════════════════

function StatusChip({ status, sm }) {
  const st = G.CONTAINER_STATUS[status];
  return (
    <span className={gcn('inline-flex items-center gap-1.5 rounded-full ring-1 ring-inset font-medium', st.chip, sm ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5')}>
      <span className={gcn('h-1.5 w-1.5 rounded-full', st.dot, status === 'open' && 'pulse-soft')} />{st.label}
    </span>
  );
}

function DeclaredChip({ d }) {
  return (
    <span className={gcn('inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]',
      d.required ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-50 border-slate-200 text-slate-500')}>
      <Ic.Dot size={10} className={d.required ? 'text-slate-400' : 'text-slate-300'} />
      {d.label}
      {!d.required && <span className="mono text-[9px] text-slate-400 uppercase tracking-[0.06em]">pref</span>}
    </span>
  );
}

function ContainerCard({ c, onOpen }) {
  const required = c.declared.filter(d => d.required).length;
  return (
    <Card className="overflow-hidden hover:border-slate-300 transition-colors">
      <button onClick={() => onOpen(c.id)} className="w-full text-left">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[15.5px] font-semibold text-slate-900 tracking-[-0.01em] leading-tight">{c.title}</h3>
                <StatusChip status={c.status} sm />
              </div>
              <div className="flex items-center gap-2 mt-1 text-[12px] text-slate-500 flex-wrap">
                <span className="mono text-slate-400">{c.id}</span><span className="text-slate-300">·</span>
                <span>{c.specialty}</span><span className="text-slate-300">·</span>
                <span>{c.employment}</span>
              </div>
            </div>
            <div className="flex-none text-right">
              <div className="mono text-[12.5px] text-slate-700">{c.comp}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{c.openings} opening{c.openings !== 1 && 's'}</div>
            </div>
          </div>

          <p className="text-[12.5px] text-slate-500 mt-3 leading-snug max-w-[68ch]">{c.summary}</p>

          <div className="mt-3.5 flex flex-wrap items-center gap-3 text-[11.5px] text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Ic.FileText size={13} className="text-slate-400" /><span className="mono tabular-nums text-slate-700">{required}</span> declared requirements</span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1.5"><Ic.Eye size={13} className="text-slate-400" /><span className="mono tabular-nums text-slate-700">{c.pipeline.observing}</span> observing</span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1.5"><Ic.User size={13} className="text-slate-400" /><span className="mono tabular-nums text-slate-700">{c.pipeline.packetsReceived}</span> packets received</span>
          </div>
        </div>
      </button>
      <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11.5px] text-slate-400 flex items-center gap-1.5"><Ic.User size={12} />{c.owner}</span>
        <button onClick={() => onOpen(c.id)} className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-700 hover:text-slate-900">Open container <Ic.ChevronRight size={13} /></button>
      </div>
    </Card>
  );
}

function ViewOpportunities({ org, onOpen, onNav }) {
  const all = G.containersFor(org.id);
  const [tab, setTab] = React.useState('all');
  const tabs = [
    { id: 'all', label: 'All', n: all.length },
    { id: 'open', label: 'Open', n: all.filter(c => c.status === 'open').length },
    { id: 'pooled', label: 'Talent pool', n: all.filter(c => c.status === 'pooled').length },
    { id: 'filled', label: 'Filled', n: all.filter(c => c.status === 'filled').length },
  ];
  const shown = tab === 'all' ? all : all.filter(c => c.status === tab);
  const totalOpenings = all.filter(c => c.status === 'open' || c.status === 'pooled').reduce((s, c) => s + c.openings, 0);

  return (
    <div>
      <PageHead icon="Briefcase" route={`organizations/${org.id}/opportunities`} title={`${org.short} · Opportunity containers`}
        sub="Organization-owned opportunity objects. Each container declares what the role needs — it holds no candidate matches. Matching is projected elsewhere, against these declarations."
        actions={<Btn variant="outline" sm iconLeft={<Ic.ArrowLeft size={14} />} onClick={() => onNav('profile')}>Profile</Btn>} />

      {/* summary strip */}
      <Card className="mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-200">
          {[
            [all.filter(c => c.status === 'open').length, 'Open containers', 'text-emerald-700'],
            [totalOpenings, 'Total openings', 'text-slate-900'],
            [all.reduce((s, c) => s + c.pipeline.observing, 0), 'Observing', 'text-slate-900'],
            [all.reduce((s, c) => s + c.pipeline.packetsReceived, 0), 'Packets received', 'text-slate-900'],
          ].map(([v, l, t], i) => (
            <div key={i} className="p-5"><Stat value={v} label={l} accent={t} /></div>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        {tabs.map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={gcn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors',
                on ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}>
              {t.label}<span className={gcn('mono tabular-nums', on ? 'text-slate-300' : 'text-slate-400')}>{t.n}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3.5">
        {shown.map(c => <ContainerCard key={c.id} c={c} onOpen={onOpen} />)}
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/60 p-4 flex items-start gap-3">
        <Ic.Info size={16} className="text-slate-400 flex-none mt-0.5" />
        <p className="text-[12px] text-slate-500 leading-relaxed">
          A container is an <span className="text-slate-700 font-medium">object the organization owns</span>, not a match. The counts shown — observing, packets received, in review — are facts about who has presented evidence, never a computed fit. VitalCV deliberately keeps the declaration and the matching apart.
        </p>
      </div>
    </div>
  );
}

// ── container detail ─────────────────────────────────────────────────────────
function PipelineStat({ icon, value, label }) {
  const I = Ic[icon];
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="h-9 w-9 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center flex-none"><I size={16} /></span>
      <div>
        <div className="text-[18px] font-semibold text-slate-900 tabular-nums leading-none">{value}</div>
        <div className="mono text-[9.5px] uppercase tracking-[0.08em] text-slate-400 mt-1.5">{label}</div>
      </div>
    </div>
  );
}

function ViewContainer({ org, id, onOpen, onNav, onBack }) {
  const c = G.containerById(id);
  if (!c) return <div className="text-slate-500">Container not found. <button className="underline" onClick={onBack}>Back</button></div>;
  const cOrg = G.byId(c.orgId);
  const facility = c.facilityId && cOrg.facilities ? cOrg.facilities.find(f => f.id === c.facilityId) : null;
  const required = c.declared.filter(d => d.required);
  const preferred = c.declared.filter(d => !d.required);

  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-500 hover:text-slate-900 mb-5">
        <Ic.ArrowLeft size={14} /> All opportunity containers
      </button>

      <Card className="overflow-hidden mb-6">
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mono text-[10.5px] text-slate-400 tracking-[0.04em]">{c.id} · owned by {cOrg.short}</div>
              <div className="flex items-center gap-2.5 flex-wrap mt-1">
                <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-slate-900 leading-none">{c.title}</h1>
                <StatusChip status={c.status} />
              </div>
              <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-3 text-[12.5px] text-slate-600">
                <span className="flex items-center gap-1.5"><Ic.Stethoscope size={13} className="text-slate-400" />{c.specialty}</span>
                {facility && <span className="flex items-center gap-1.5"><Ic.Building2 size={13} className="text-slate-400" />{facility.name}</span>}
                <span className="flex items-center gap-1.5"><Ic.Briefcase size={13} className="text-slate-400" />{c.employment}</span>
              </div>
            </div>
            <div className="flex-none text-right">
              <div className="mono text-[15px] text-slate-900">{c.comp}</div>
              <div className="text-[12px] text-slate-400 mt-0.5">{c.openings} opening{c.openings !== 1 && 's'} · posted {c.posted}</div>
            </div>
          </div>
          <p className="text-[13px] text-slate-500 mt-4 leading-snug max-w-[72ch]">{c.summary}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-200 border-t border-slate-200">
          <PipelineStat icon="FileText" value={c.declared.length} label="Declared reqs" />
          <PipelineStat icon="Eye" value={c.pipeline.observing} label="Observing" />
          <PipelineStat icon="User" value={c.pipeline.packetsReceived} label="Packets in" />
          <PipelineStat icon="ClipboardCheck" value={c.pipeline.inReview} label="In review" />
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7 space-y-6">
          <Card>
            <SecHead icon="FileText" title="Declared requirements" sub="What this container asks for — evidence categories, not a checklist against any one person" />
            <div className="p-5">
              <div className="mono text-[10px] uppercase tracking-[0.12em] text-slate-400 mb-2.5">Required · {required.length}</div>
              <div className="flex flex-wrap gap-2">{required.map((d, i) => <DeclaredChip key={i} d={d} />)}</div>
              {preferred.length > 0 && <>
                <div className="mono text-[10px] uppercase tracking-[0.12em] text-slate-400 mt-5 mb-2.5">Preferred · {preferred.length}</div>
                <div className="flex flex-wrap gap-2">{preferred.map((d, i) => <DeclaredChip key={i} d={d} />)}</div>
              </>}
            </div>
          </Card>

          {c.filledNote && (
            <Card className="bg-slate-50/60">
              <div className="p-5 flex items-start gap-3">
                <Ic.CheckCircle size={16} className="text-slate-400 flex-none mt-0.5" />
                <div>
                  <div className="text-[12.5px] font-semibold text-slate-700">This container is closed</div>
                  <div className="text-[12px] text-slate-500 mt-1 leading-snug">{c.filledNote}</div>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="col-span-12 lg:col-span-5 space-y-6">
          <Card>
            <SecHead icon="Info" title="Container facts" />
            <div className="px-5 py-2">
              <KV k="Container ID" v={c.id} mono />
              <KV k="Owner" v={c.owner} />
              <KV k="Visibility" v={c.visibility} />
              <KV k="Specialty" v={c.specialty} />
              {facility && <KV k="Facility" v={facility.name} />}
              <KV k="Employment" v={c.employment} />
              <KV k="Compensation" v={c.comp} mono />
              <KV k="Openings" v={c.openings} mono />
              <KV k="Posted" v={c.posted} />
            </div>
          </Card>

          <Card className="bg-slate-900 border-slate-900 text-white">
            <div className="p-5">
              <div className="flex items-center gap-2">
                <Ic.Network size={15} className="text-emerald-400" />
                <span className="text-[12.5px] font-semibold">Where matching happens</span>
              </div>
              <p className="text-[12.5px] text-slate-300 mt-2.5 leading-relaxed">
                This object stays a pure declaration. The Opportunity Network projects each clinician’s owned evidence against it in real time — no fit is ever stored back here.
              </p>
              <button onClick={() => onNav('graph')} className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-400 hover:text-emerald-300">
                <Ic.GitBranch size={14} /> See it in the graph <Ic.ArrowRight size={13} />
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

window.ViewOpportunities = ViewOpportunities;
window.ViewContainer = ViewContainer;
