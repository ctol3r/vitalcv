// WAVE 1200 · D3 — /path · Graph Path Explainer (every recommendation explains itself)

const TRACE_ORDER = ['lead-app-ready', 'readiness-block', 'md-eligibility', 'stanford-ca', 'org-pipeline'];

function ViewPath() {
  const route = useRoute();
  const initial = (route.arg && TRACES[route.arg]) ? route.arg : (window.__pathFocus && TRACES[window.__pathFocus]) ? window.__pathFocus : 'lead-app-ready';
  const [tid, setTid] = React.useState(initial);
  const trace = TRACES[tid];
  const [activeStep, setActiveStep] = React.useState(null);

  React.useEffect(() => { setActiveStep(null); }, [tid]);

  // highlight ids for the graph panel
  const highlight = React.useMemo(() => {
    if (trace.seedIds) return trace.seedIds;
    if (trace.requireEligible) return ['self', ...CLINICIANS.filter(c => c.eligible.includes(trace.requireEligible)).map(c => c.id)];
    if (tid === 'stanford-ca') return ['self', 'o-stanford', ...CLINICIANS.filter(c => c.trainedAt.some(t => t.includes('Stanford')) && c.state === 'CA').map(c => c.id)];
    if (tid === 'org-pipeline') return ORG_PIPELINES.map(o => o.id);
    return ['self'];
  }, [trace, tid]);

  const stepHighlight = React.useMemo(() => {
    if (activeStep == null || !trace.traversal) return null;
    const s = trace.traversal[activeStep];
    return [s.from, s.to];
  }, [activeStep, trace]);

  const popStats = React.useMemo(() => {
    if (!trace.population) return null;
    if (trace.requireEligible) {
      const total = CLINICIANS.length, pass = CLINICIANS.filter(c => c.eligible.includes(trace.requireEligible)).length;
      return { total, pass, scanned: 'eligibility predicate (4 clauses)' };
    }
    if (tid === 'stanford-ca') { const total = CLINICIANS.length, pass = CLINICIANS.filter(c => c.trainedAt.some(t => t.includes('Stanford')) && c.state === 'CA').length; return { total, pass, scanned: 'trainedAt ∧ state predicate' }; }
    if (tid === 'org-pipeline') return { total: ORG_PIPELINES.length, pass: ORG_PIPELINES.length, scanned: 'pipeline aggregation over clinician nodes' };
    return null;
  }, [trace, tid]);

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-7 space-y-6">
      <SurfaceIntro eyebrow="Graph Path Explainer · W1200-D3" title="Every answer shows its work"
        sub="No black boxes. Each conclusion is the end of a visible chain — the question asked, the relationships walked, the source-backed evidence touched, the logic applied. Follow any recommendation back to the exact nodes it stands on." />

      {/* trace picker */}
      <div className="flex flex-wrap gap-2">
        {TRACE_ORDER.map(id => (
          <button key={id} onClick={() => setTid(id)}
            className={cn('text-[12px] px-3 py-1.5 rounded-lg border transition-colors text-left max-w-[280px]',
              tid === id ? 'border-cyan-400/50 bg-cyan-400/[0.08] text-cyan-100' : 'border-white/8 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200')}>
            {TRACES[id].question}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-5">
        {/* the reasoning pipeline */}
        <div className="lg:col-span-7">
          <div className="relative pl-10">
            {/* spine */}
            <div className="absolute left-[15px] top-3 bottom-3 w-px bg-gradient-to-b from-cyan-400/40 via-white/10 to-fuchsia-400/40" />

            <Stage n="01" label="Question" Icon={Icon.HelpCircle} color="#34d8e8">
              <p className="text-[16px] font-semibold text-slate-50 leading-snug text-pretty">{trace.question}</p>
            </Stage>

            <Stage n="02" label="Traversal" Icon={Icon.Share2} color="#7cc6e8"
              note={trace.traversal ? `${trace.traversal.length} hops walked` : 'predicate scan'}>
              {trace.traversal ? (
                <div className="space-y-1.5">
                  {trace.traversal.map((s, i) => {
                    const from = UNIVERSE.byId[s.from] || NODE_BY_ID[s.from], to = UNIVERSE.byId[s.to] || NODE_BY_ID[s.to];
                    const on = activeStep === i;
                    return (
                      <button key={i} onMouseEnter={() => setActiveStep(i)} onMouseLeave={() => setActiveStep(null)} onClick={() => setActiveStep(on ? null : i)}
                        className={cn('w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors text-left',
                          on ? 'border-cyan-400/40 bg-cyan-400/[0.06]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15')}>
                        <HopChip node={from} />
                        <span className="flex flex-col items-center px-1">
                          <span className="mono text-[8.5px] uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">{REL[s.rel]?.label || s.rel}</span>
                          <Icon.ArrowRight size={12} className="text-slate-600" />
                        </span>
                        <HopChip node={to} />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap text-[12px]">
                    <span className="px-2 py-1 rounded bg-white/[0.05] border border-white/8 text-slate-200">scan {popStats?.total} clinician nodes</span>
                    <Icon.ArrowRight size={13} className="text-slate-600" />
                    <code className="mono text-[11.5px] text-emerald-300 bg-emerald-400/[0.06] px-2 py-1 rounded">{popStats?.scanned}</code>
                    <Icon.ArrowRight size={13} className="text-slate-600" />
                    <span className="px-2 py-1 rounded bg-cyan-400/10 border border-cyan-400/25 text-cyan-200 font-semibold">{popStats?.pass} pass</span>
                  </div>
                  <p className="text-[12px] text-slate-500">Each node is evaluated against the predicate; a single failing clause excludes it. The traversal is the filter itself.</p>
                </div>
              )}
            </Stage>

            <Stage n="03" label="Evidence" Icon={Icon.ShieldCheck} color="#34d895"
              note={trace.evidence ? `${trace.evidence.length} source-backed nodes` : 'verified edges'}>
              {trace.evidence ? (
                <div className="space-y-2">
                  {trace.evidence.map((e, i) => {
                    const n = UNIVERSE.byId[e.id] || NODE_BY_ID[e.id];
                    return (
                      <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                        <span className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: hexA(n.color || FAM_COLOR[n.family], 0.14), color: n.color || FAM_COLOR[n.family] }}><IconFor name={n.icon} size={14} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2"><span className="text-[12.5px] font-semibold text-slate-100">{n.label}</span><WeightTag w={e.weight} /></div>
                          <div className="text-[11px] text-slate-500 leading-snug mt-0.5 text-pretty">{e.note}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[12.5px] text-slate-400 leading-relaxed text-pretty">Every clause resolves against a source-backed node — a verified training edge, an active-license node, a conferred-honor node. The shortlist is decidable without human screening because the evidence is already in the graph.</p>
              )}
            </Stage>

            <Stage n="04" label="Reasoning" Icon={Icon.Lightbulb} color="#fbbf24" note="the logic applied">
              <ul className="space-y-2.5">
                {trace.reasoning.map((r, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] text-slate-300 leading-[1.55]">
                    <span className="mono text-[10px] text-amber-400/80 mt-1 flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-pretty">{r}</span>
                  </li>
                ))}
              </ul>
            </Stage>

            <Stage n="05" label="Conclusion" Icon={Icon.Scale} color="#f472b6" last>
              <div className="rounded-xl border border-white/12 bg-gradient-to-br from-white/[0.05] to-transparent p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-[20px] font-semibold text-slate-50 tracking-tight">{trace.conclusion.verdict}</span>
                  <Chip state={trace.conclusion.state} />
                </div>
                <p className="text-[13px] text-slate-300 leading-[1.6] text-pretty">{trace.conclusion.text}</p>
                <div className="mt-3.5 flex items-center gap-3">
                  <span className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500">Confidence</span>
                  <div className="flex-1"><Bar value={trace.conclusion.confidence} color={trace.conclusion.state === 'pending' ? '#fbbf24' : trace.conclusion.state === 'unknown' ? '#c084fc' : '#34d895'} /></div>
                  <span className="mono text-[13px] text-slate-100 tabular-nums">{trace.conclusion.confidence}%</span>
                </div>
              </div>
            </Stage>
          </div>
        </div>

        {/* graph panel (sticky) */}
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28 space-y-3">
            <Panel className="overflow-hidden">
              <PanelHead icon={Icon.Network} title="The walked subgraph" sub={stepHighlight ? 'Highlighting this hop' : 'Full path highlighted'}
                right={<span className="mono text-[10px] text-slate-500">{highlight.length} nodes</span>} />
              <UniverseGraph height={400} highlightIds={stepHighlight || highlight} fitTo={highlight}
                settings={{ nodeSize: 1.15, linkThickness: 1.3, center: 0.6, repel: 1, linkForce: 0.06, linkDist: 1.1, labels: true }} />
            </Panel>
            <Panel className="p-4 flex items-start gap-2.5">
              <Icon.Eye size={15} className="text-cyan-300 flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-slate-400 leading-relaxed text-pretty">Hover a traversal step to isolate that single hop in the graph. The conclusion is nothing more than the end of this visible walk — there is no hidden model scoring underneath it.</p>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stage({ n, label, Icon: I, color, note, children, last }) {
  return (
    <div className={cn('relative', last ? '' : 'pb-7')}>
      <span className="absolute -left-10 top-0 h-8 w-8 rounded-full flex items-center justify-center border-2"
        style={{ background: '#10141b', borderColor: hexA(color, 0.5), color }}>
        <I size={15} />
      </span>
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className="mono text-[10px] uppercase tracking-[0.16em]" style={{ color }}>{n}</span>
        <span className="text-[13px] font-semibold text-slate-100">{label}</span>
        {note && <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-slate-600">· {note}</span>}
      </div>
      {children}
    </div>
  );
}
function HopChip({ node }) {
  if (!node) return null;
  const c = node.color || FAM_COLOR[node.family] || '#7cc6e8';
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 px-2 py-1 rounded-md bg-white/[0.04]">
      <span className="h-5 w-5 rounded flex items-center justify-center flex-shrink-0" style={{ background: hexA(c, 0.16), color: c }}><IconFor name={node.icon} size={11} /></span>
      <span className="text-[11.5px] font-medium text-slate-100 truncate">{node.label}</span>
    </span>
  );
}
function WeightTag({ w }) {
  const map = { 'load-bearing': ['#34d895', 'load-bearing'], 'blocking': ['#fb7185', 'blocking'], 'supporting': ['#7cc6e8', 'supporting'], 'corroborating': ['#c084fc', 'corroborating'] };
  const [c, t] = map[w] || ['#94a3b8', w];
  return <span className="mono text-[8.5px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded" style={{ color: c, background: hexA(c, 0.12) }}>{t}</span>;
}

window.ViewPath = ViewPath;
