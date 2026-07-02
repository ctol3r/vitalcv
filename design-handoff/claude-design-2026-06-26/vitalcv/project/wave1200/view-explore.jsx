// WAVE 1200 · D2 — /explore · Natural-language Explorer (ask the graph; the answer is visualized)

function ViewExplore() {
  const [activeId, setActiveId] = React.useState(NL_QUERIES[0].id);
  const [typed, setTyped] = React.useState('');
  const [running, setRunning] = React.useState(false);
  const q = NL_QUERIES.find(x => x.id === activeId);
  const result = React.useMemo(() => q.resolve(), [activeId]);
  const trace = TRACES[q.traceId];

  const run = (id) => { setRunning(true); setActiveId(id); setTimeout(() => setRunning(false), 480); };
  const submit = () => {
    const t = typed.trim().toLowerCase(); if (!t) return;
    const match = NL_QUERIES.find(x => {
      const keys = x.nl.toLowerCase().split(/\W+/).filter(w => w.length > 3);
      return keys.some(k => t.includes(k)) || t.includes(x.parse.entities[0].toLowerCase().split(' ')[0]);
    });
    run((match || NL_QUERIES[0]).id);
  };

  return (
    <div className="max-w-[1480px] mx-auto px-6 py-7 space-y-6">
      <SurfaceIntro eyebrow="Natural-language Explorer · W1200-D2" title="Ask the graph in plain language"
        sub="Questions a résumé database can’t answer — eligibility, shared training, what’s blocking readiness, pipeline strength — parse into a graph traversal and resolve to a visualized answer. Nothing here is hand-written; every result is walked from the edges." />

      {/* ask bar */}
      <div className="relative">
        <Icon.Sparkles size={18} className="absolute left-4 top-4 text-cyan-300" />
        <input value={typed} onChange={e => setTyped(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Ask anything — “show clinicians eligible for Medical Director”…"
          className="w-full h-13 pl-12 pr-28 py-3.5 bg-[#141922] border border-white/12 focus:border-cyan-400/50 rounded-xl text-[15px] text-slate-100 placeholder:text-slate-600 outline-none transition-colors" />
        <Button size="md" className="absolute right-2 top-2" onClick={submit} iconRight={<Icon.ArrowRight size={14} />}>Ask</Button>
      </div>
      <div className="flex flex-wrap gap-2 -mt-2">
        {NL_QUERIES.map(x => (
          <button key={x.id} onClick={() => run(x.id)}
            className={cn('inline-flex items-center gap-2 text-[12px] px-3 py-1.5 rounded-full border transition-colors',
              activeId === x.id ? 'border-cyan-400/50 bg-cyan-400/[0.08] text-cyan-100' : 'border-white/8 bg-white/[0.03] text-slate-300 hover:border-white/20')}>
            <IconFor name={x.Icon} size={13} className="opacity-80" />{x.nl}
          </button>
        ))}
      </div>

      {/* parse strip */}
      <Panel className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Parsed</span>
          <Icon.ArrowRight size={13} className="text-slate-600" />
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-cyan-300"><Icon.Crosshair size={13} />{q.parse.intent}</span>
          <span className="h-4 w-px bg-white/10" />
          <span className="flex flex-wrap items-center gap-1.5">
            {q.parse.entities.map(e => <span key={e} className="text-[11.5px] px-2 py-0.5 rounded bg-white/[0.05] border border-white/8 text-slate-200">{e}</span>)}
          </span>
          <span className="h-4 w-px bg-white/10 hidden sm:block" />
          <code className="text-[11.5px] mono text-emerald-300 bg-emerald-400/[0.06] px-2 py-0.5 rounded">{q.parse.predicate}</code>
          <span className="ml-auto mono text-[10px] uppercase tracking-[0.1em] text-slate-500 flex items-center gap-1.5">
            {running ? <><span className="h-1.5 w-1.5 rounded-full bg-amber-400 pulse-soft" />traversing…</> : <><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />resolved</>}
          </span>
        </div>
      </Panel>

      <div className={cn('grid lg:grid-cols-12 gap-5 transition-opacity', running && 'opacity-40')}>
        {/* answer body */}
        <div className="lg:col-span-8 space-y-4">
          {result.viz === 'roster' && <RosterAnswer result={result} />}
          {result.viz === 'orgs' && <OrgsAnswer result={result} />}
          {result.viz === 'subgraph' && <SubgraphAnswer result={result} trace={trace} />}
        </div>

        {/* conclusion + reasoning link */}
        <div className="lg:col-span-4 space-y-4">
          {trace && (
            <Panel className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className={cn('h-7 w-7 rounded-lg flex items-center justify-center', trace.conclusion.state === 'verified' ? 'bg-emerald-400/15 text-emerald-300' : trace.conclusion.state === 'pending' ? 'bg-amber-400/15 text-amber-300' : 'bg-cyan-400/15 text-cyan-300')}>
                  <Icon.Scale size={15} />
                </span>
                <span className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Conclusion</span>
              </div>
              <div className="text-[20px] font-semibold text-slate-50 tracking-tight">{trace.conclusion.verdict}</div>
              <p className="text-[12.5px] text-slate-400 leading-[1.6] mt-2 text-pretty">{trace.conclusion.text}</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500">Confidence</span>
                <div className="flex-1"><Bar value={trace.conclusion.confidence} color={trace.conclusion.state === 'pending' ? '#fbbf24' : '#34d8e8'} /></div>
                <span className="mono text-[12px] text-slate-200 tabular-nums">{trace.conclusion.confidence}%</span>
              </div>
              <Button size="sm" variant="outline" className="w-full mt-4" iconLeft={<Icon.GitBranch size={13} />}
                onClick={() => { window.__pathFocus = trace.id; navTo('path', trace.id); }}>See the full reasoning path</Button>
            </Panel>
          )}
          <Panel className="p-4">
            <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500 mb-2.5 flex items-center gap-1.5"><Icon.Lightbulb size={13} className="text-amber-400" />How it reasoned</div>
            <ul className="space-y-2">
              {trace?.reasoning.map((r, i) => (
                <li key={i} className="flex gap-2 text-[12px] text-slate-300 leading-snug">
                  <span className="mono text-[10px] text-cyan-400/70 mt-0.5">{i + 1}</span>
                  <span className="text-pretty">{r}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ---- roster answer: ranked clinicians + excluded ---- */
function RosterAnswer({ result }) {
  const max = Math.max(...result.rows.map(r => result.metric(r.clin)), 100);
  return (
    <Panel className="overflow-hidden">
      <PanelHead icon={Icon.Users} title={`${result.rows.length} clinicians match`} sub={`Ranked by ${result.metricLabel}`}
        right={<span className="mono text-[10px] uppercase tracking-[0.1em] text-slate-500">verified edges</span>} />
      <div className="divide-y divide-white/[0.05]">
        {result.rows.map(({ clin, why }, i) => (
          <div key={clin.id} className={cn('px-4 py-3 flex items-center gap-3', clin.you && 'bg-cyan-400/[0.04]')}>
            <span className="mono text-[11px] text-slate-600 w-5 text-right">{i + 1}</span>
            <span className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: hexA(FAM_COLOR.person, 0.14), color: FAM_COLOR.person }}><Icon.User size={16} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="text-[13px] font-semibold text-slate-100 truncate">{clin.name}</span>{clin.you && <Tag color="#34d8e8">you</Tag>}</div>
              <div className="text-[11px] text-slate-500 truncate">{why}</div>
            </div>
            <div className="w-28 hidden sm:block"><Bar value={result.metric(clin)} max={max} color={FAM_COLOR.person} /></div>
            <span className="mono text-[13px] text-slate-200 tabular-nums w-8 text-right">{result.metric(clin)}</span>
          </div>
        ))}
      </div>
      {result.rejected && result.rejected.length > 0 && (
        <div className="px-4 py-3 border-t border-white/[0.07] bg-white/[0.015]">
          <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-600 mb-2">Excluded by the predicate</div>
          <div className="flex flex-wrap gap-2">
            {result.rejected.map(({ clin, why }) => (
              <span key={clin.id} className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg bg-white/[0.03] border border-white/8 text-slate-400">
                <Icon.X size={11} className="text-rose-400/70" />{clin.name} <span className="text-slate-600">· {why}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ---- orgs answer: pipeline ranking ---- */
function OrgsAnswer({ result }) {
  const max = Math.max(...result.rows.map(o => o.score));
  return (
    <Panel className="overflow-hidden">
      <PanelHead icon={Icon.Building} title="Leadership pipeline ranking" sub="Ready + emerging leaders, weighted by bench depth" />
      <div className="divide-y divide-white/[0.05]">
        {result.rows.map((o, i) => (
          <div key={o.id} className="px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span className="mono text-[11px] text-slate-600 w-5 text-right">{i + 1}</span>
              <span className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: hexA(FAM_COLOR.institution, 0.14), color: FAM_COLOR.institution }}><Icon.Building size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-slate-100 truncate">{o.name}</div>
                <div className="text-[11px] text-slate-500 truncate">{o.loc} · {o.openRoles} open roles</div>
              </div>
              <span className="mono text-[18px] font-semibold tabular-nums" style={{ color: FAM_COLOR.institution }}>{o.score}</span>
            </div>
            <div className="mt-2 ml-13 flex items-center gap-3">
              <div className="flex-1"><Bar value={o.score} max={max} color={FAM_COLOR.institution} /></div>
              <span className="mono text-[10px] text-slate-500">{o.ready} ready · {o.emerging} emerging · {o.bench} bench</span>
            </div>
            <p className="text-[11.5px] text-slate-500 mt-1.5 ml-13 text-pretty">{o.note}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ---- subgraph answer: highlighted graph + evidence ---- */
function SubgraphAnswer({ result, trace }) {
  const [sel, setSel] = React.useState(result.focus);
  return (
    <div className="space-y-4">
      <Panel className="overflow-hidden">
        <PanelHead icon={Icon.Share2} title="Answer subgraph" sub={`${result.ids.length} nodes · ${result.links.length} edges`}
          right={<span className="mono text-[10px] uppercase tracking-[0.1em] text-amber-300/80 flex items-center gap-1.5"><Icon.AlertTri size={12} />blocking nodes</span>} />
        <UniverseGraph height={340} highlightIds={result.ids} fitTo={result.ids} selectedId={sel} onSelect={setSel}
          settings={{ nodeSize: 1.1, linkThickness: 1.2, center: 0.6, repel: 1, linkForce: 0.06, linkDist: 1.1, labels: true }} />
      </Panel>
      <Panel className="p-4">
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500 mb-2">What's preventing readiness</div>
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
          {result.rows.map((r, i) => <NodeRef key={i} node={r.node} detail={r.detail} onClick={() => setSel(r.node.id)} />)}
        </div>
      </Panel>
    </div>
  );
}

window.ViewExplore = ViewExplore;
