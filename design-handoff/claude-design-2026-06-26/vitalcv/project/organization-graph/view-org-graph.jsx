// ════════════════════════════════════════════════════════════════════════
// W265-D4 · CLINICIAN ↔ ORGANIZATION GRAPH — relationship explorer
// Chain: Clinician ↔ Employment ↔ Organization ↔ Opportunity
// A live node-link board. Selecting an organization lights its path and
// resolves the opportunity containers it owns (D4 → D5).
// ════════════════════════════════════════════════════════════════════════

// edge color by type, with a dimmed variant
function edgePath(x1, y1, x2, y2) {
  const dx = Math.max(40, (x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

function ClinicianNode({ c, nodeRef }) {
  return (
    <div ref={nodeRef} className="rounded-xl border border-slate-300 bg-white shadow-sm p-4 w-[210px]">
      <div className="flex items-center gap-3">
        <span className="h-11 w-11 rounded-lg bg-slate-900 text-white flex items-center justify-center font-semibold text-[15px] tracking-tight flex-none">{c.initials}</span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-slate-900 leading-tight truncate">{c.name}, {c.credential}</div>
          <div className="mono text-[10.5px] text-slate-500 mt-0.5">{c.specialty}</div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="mono text-[10px] text-slate-400">NPI {c.npi}</span>
        <span className="inline-flex items-center gap-1 text-[10.5px] text-emerald-700"><Ic.Verified size={11} />verified</span>
      </div>
    </div>
  );
}

function OrgNode({ org, edge, selected, dimmed, onSelect, nodeRef }) {
  const et = G.EDGE_TYPE[edge.type];
  const containers = G.containersFor(org.id);
  return (
    <button ref={nodeRef} onClick={() => onSelect(org.id)}
      className={gcn('block w-[230px] text-left rounded-xl border bg-white p-4 transition-all',
        selected ? 'border-slate-900 shadow-md ring-1 ring-slate-900/5' : 'border-slate-200 hover:border-slate-300 shadow-sm',
        dimmed && 'opacity-45')}>
      <div className="flex items-center gap-3">
        <OrgMark org={org} size={40} className="rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-slate-900 leading-tight truncate">{org.short}</div>
          <div className="mono text-[10.5px] text-slate-500 mt-0.5 truncate">{org.kind}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className={gcn('inline-flex items-center gap-1.5 rounded-full ring-1 ring-inset text-[10.5px] font-medium px-2 py-0.5', et.soft)}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: et.color }} />{et.label}
        </span>
        <span className="mono text-[10.5px] text-slate-400 tabular-nums">{containers.length} owned</span>
      </div>
    </button>
  );
}

function ContainerNode({ c, dimmed, onOpen, nodeRef }) {
  const st = G.CONTAINER_STATUS[c.status];
  return (
    <button ref={nodeRef} onClick={() => onOpen(c.id)}
      className={gcn('block w-[230px] text-left rounded-xl border bg-white p-3.5 shadow-sm transition-all hover:border-slate-300',
        dimmed ? 'opacity-45 border-slate-200' : 'border-slate-200')}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[12.5px] font-semibold text-slate-900 leading-tight">{c.title}</div>
        <span className={gcn('inline-flex items-center gap-1 rounded-full ring-1 ring-inset text-[9.5px] font-medium px-1.5 py-0.5 flex-none', st.chip)}><span className={gcn('h-1 w-1 rounded-full', st.dot)} />{st.label}</span>
      </div>
      <div className="mono text-[10px] text-slate-400 mt-1.5">{c.id}</div>
      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
        <span className="text-slate-500">{c.openings} opening{c.openings !== 1 && 's'}</span>
        <span className="mono text-slate-700">{c.comp}</span>
      </div>
    </button>
  );
}

function ColLabel({ children, n }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="mono text-[10px] uppercase tracking-[0.14em] text-slate-400">{children}</span>
      {n != null && <span className="mono text-[10px] text-slate-300 tabular-nums">{n}</span>}
    </div>
  );
}

function RelationshipBoard({ selectedOrg, onSelect, onOpen }) {
  const wrapRef = React.useRef(null);
  const clinRef = React.useRef(null);
  const orgRefs = React.useRef({});
  const conRefs = React.useRef({});
  const [lines, setLines] = React.useState([]);
  const [dims, setDims] = React.useState({ w: 0, h: 0 });

  const edges = G.GRAPH.edges;
  const containers = G.containersFor(selectedOrg);

  const measure = React.useCallback(() => {
    const conts = G.containersFor(selectedOrg);
    const wrap = wrapRef.current; if (!wrap) return;
    const wb = wrap.getBoundingClientRect();
    const rel = (el) => { const b = el.getBoundingClientRect(); return { x1: b.left - wb.left, x2: b.right - wb.left, midY: b.top - wb.top + b.height / 2, top: b.top - wb.top, bottom: b.bottom - wb.top }; };
    const out = [];
    const clin = clinRef.current;
    if (clin) {
      const cr = rel(clin);
      edges.forEach(e => {
        const oe = orgRefs.current[e.orgId]; if (!oe) return;
        const or = rel(oe);
        const active = e.orgId === selectedOrg;
        out.push({ key: 'c-' + e.orgId, d: edgePath(cr.x2, cr.midY, or.x1, or.midY), color: G.EDGE_TYPE[e.type].stroke, active });
      });
      // selected org → its containers
      const oe = orgRefs.current[selectedOrg];
      if (oe) {
        const or = rel(oe);
        conts.forEach(c => {
          const ce = conRefs.current[c.id]; if (!ce) return;
          const ccr = rel(ce);
          out.push({ key: 'o-' + c.id, d: edgePath(or.x2, or.midY, ccr.x1, ccr.midY), color: '#0f172a', active: true });
        });
      }
    }
    setDims({ w: wb.width, h: wb.height });
    setLines(out);
  }, [selectedOrg, edges]);

  React.useLayoutEffect(() => {
    measure();
    const t = setTimeout(measure, 60);
    return () => clearTimeout(t);
  }, [measure]);

  React.useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  return (
    <div ref={wrapRef} className="relative">
      {/* connector layer */}
      <svg className="absolute inset-0 pointer-events-none overflow-visible" width={dims.w} height={dims.h} style={{ zIndex: 0 }}>
        {lines.map(l => (
          <path key={l.key} d={l.d} fill="none" stroke={l.color} strokeWidth={l.active ? 2 : 1.25}
            strokeOpacity={l.active ? 0.9 : 0.22} strokeDasharray={l.active ? 'none' : '4 4'}
            style={{ transition: 'stroke-opacity .3s, stroke-width .3s' }} />
        ))}
        {lines.filter(l => l.active).map(l => {
          // endpoint dot
          const m = l.d.match(/([\d.]+) ([\d.]+)$/);
          return m ? <circle key={l.key + '-d'} cx={parseFloat(m[1])} cy={parseFloat(m[2])} r="3" fill={l.color} /> : null;
        })}
      </svg>

      {/* node columns */}
      <div className="relative grid grid-cols-[210px_1fr_1fr] gap-x-9 gap-y-8" style={{ zIndex: 1 }}>
        {/* clinician */}
        <div>
          <ColLabel>Clinician</ColLabel>
          <ClinicianNode c={G.GRAPH.clinician} nodeRef={clinRef} />
          <div className="mt-3 w-[210px] rounded-lg bg-slate-50 border border-slate-200 p-3">
            <div className="text-[11px] text-slate-500 leading-snug">Owns her evidence ledger. Every edge below is presented by her, then verified at source.</div>
          </div>
        </div>

        {/* organizations + edges */}
        <div>
          <ColLabel n={edges.length}>Organizations · via employment</ColLabel>
          <div className="space-y-4">
            {edges.map(e => {
              const org = G.byId(e.orgId);
              return (
                <div key={e.id}>
                  <OrgNode org={org} edge={e} selected={selectedOrg === e.orgId}
                    dimmed={selectedOrg !== e.orgId} onSelect={onSelect}
                    nodeRef={el => { orgRefs.current[e.orgId] = el; }} />
                  {selectedOrg === e.orgId && (
                    <div className="mt-2 w-[230px] rounded-lg bg-slate-900 text-white p-3">
                      <div className="text-[11px] text-slate-300 leading-snug"><span className="text-white font-medium">{G.GRAPH.clinician.name}</span> {e.verb} <span className="text-white font-medium">{org.short}</span></div>
                      <div className="mt-2 flex items-center gap-2 text-[10.5px] text-slate-400">
                        <span>{e.role}</span><span className="text-slate-600">·</span><span>since {e.since}</span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-700 flex items-center gap-1.5 text-[10.5px]">
                        <Ic.Verified size={11} className="text-emerald-400" />
                        <span className="text-slate-300">{e.source}</span>
                        <span className="mono ml-auto text-slate-400">{e.tier}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* opportunities */}
        <div>
          <ColLabel n={containers.length}>Opportunities · owned by org</ColLabel>
          {containers.length > 0 ? (
            <div className="space-y-3">
              {containers.map(c => (
                <ContainerNode key={c.id} c={c} onOpen={onOpen}
                  nodeRef={el => { conRefs.current[c.id] = el; }} />
              ))}
            </div>
          ) : (
            <div className="w-[230px] rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <Ic.Network size={16} className="text-slate-400" />
              <div className="text-[12px] font-medium text-slate-700 mt-2">No owned opportunities</div>
              <div className="text-[11px] text-slate-500 mt-1 leading-snug">This is an observation edge — the organization saw her verified passport but owns no open containers.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ViewGraph({ org, onNav, onOpen }) {
  const [selectedOrg, setSelectedOrg] = React.useState(org.focal ? 'cedar-health' : org.id);
  const edge = G.GRAPH.edges.find(e => e.orgId === selectedOrg);

  return (
    <div>
      <PageHead icon="Network" route={`organizations/${org.id}/graph`} title="Clinician ↔ Organization graph"
        sub="One clinician, her verified edges, and the organizations they reach. Every relationship is a typed edge she presents and a source confirms — then each organization owns the opportunities on the right."
        actions={<Btn variant="outline" sm iconLeft={<Ic.ArrowLeft size={14} />} onClick={() => onNav('profile')}>Profile</Btn>} />

      {/* chain legend */}
      <Card className="mb-6">
        <div className="px-5 py-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          {[
            ['User', 'Clinician'], ['arrow', 'Employment'], ['Building2', 'Organization'], ['arrow', 'owns'], ['Briefcase', 'Opportunity'],
          ].map((step, i) => {
            if (step[0] === 'arrow') return (
              <span key={i} className="flex items-center gap-1.5 text-slate-300"><span className="mono text-[10px] text-slate-400 uppercase tracking-[0.08em]">{step[1]}</span><Ic.ArrowRight size={14} /></span>
            );
            const I = Ic[step[0]];
            return (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-[12px] font-medium text-slate-700"><I size={13} className="text-slate-500" />{step[1]}</span>
            );
          })}
          <span className="ml-auto hidden md:flex items-center gap-3 text-[11px]">
            {Object.entries(G.EDGE_TYPE).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1.5 text-slate-500"><span className="h-1.5 w-5 rounded-full" style={{ background: v.color }} />{v.label}</span>
            ))}
          </span>
        </div>
      </Card>

      {/* board */}
      <Card className="overflow-hidden">
        <SecHead icon="GitBranch" title="Relationship explorer" sub="Select an organization to trace its path"
          right={<span className="mono text-[10.5px] text-slate-400 uppercase tracking-[0.08em]">live graph</span>} />
        <div className="p-6 overflow-x-auto bg-[linear-gradient(to_right,#f1f5f933_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f933_1px,transparent_1px)] bg-[size:22px_22px]">
          <div className="min-w-[880px]">
            <RelationshipBoard selectedOrg={selectedOrg} onSelect={setSelectedOrg} onOpen={onOpen} />
          </div>
        </div>
        {edge && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-slate-600">
            <Ic.Route size={14} className="text-slate-400" />
            <span className="font-medium text-slate-900">{G.GRAPH.clinician.name}</span>
            <Ic.ArrowRight size={12} className="text-slate-300" />
            <span className="lowercase">{edge.label} edge</span>
            <Ic.ArrowRight size={12} className="text-slate-300" />
            <span className="font-medium text-slate-900">{G.byId(selectedOrg).short}</span>
            <Ic.ArrowRight size={12} className="text-slate-300" />
            <span>{G.containersFor(selectedOrg).length} owned opportunity container{G.containersFor(selectedOrg).length !== 1 && 's'}</span>
            <span className="ml-auto text-[11px] text-slate-400 hidden sm:inline">Edge verified · {edge.source} · {edge.tier}</span>
          </div>
        )}
      </Card>

      <p className="mt-4 mt-5 text-[12px] text-slate-400 leading-snug max-w-[70ch]">
        The graph stores <span className="text-slate-600">relationships, never matches</span>. An employment edge and an owned opportunity are two separate facts — the network decides whether they meet, elsewhere.
      </p>
    </div>
  );
}

window.ViewGraph = ViewGraph;
