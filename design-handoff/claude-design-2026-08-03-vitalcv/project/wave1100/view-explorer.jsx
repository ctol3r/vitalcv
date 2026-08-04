// WAVE 1100 · D3 — /explorer
// Ask the graph a relationship question; the answer is a traversal, never a hand-written list.

function ViewExplorer() {
  const [activeQ, setActiveQ] = React.useState(QUESTIONS[0].id);
  const [selected, setSelected] = React.useState(null);
  const q = QUESTIONS.find(x => x.id === activeQ);
  const result = React.useMemo(() => q.resolve(), [activeQ]);

  React.useEffect(() => { setSelected(result.focus); }, [activeQ]);

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-7">
      <div className="rise">
        <SurfaceIntro eyebrow="Graph Explorer · Wave 1100"
          title="Ask the graph a question about a career"
          sub="Questions a résumé can't answer — what supports a role, who trained together, what precedes a position — resolve by walking relationships. The highlighted subgraph is the literal answer."
          right={<span className="hidden md:inline-flex items-center gap-2 mono text-[10px] uppercase tracking-[0.12em] text-slate-500 border border-slate-200 rounded-md px-3 py-2"><Icon.Search size={13} /> {QUESTIONS.length} queries</span>} />
      </div>

      <div className="rise grid lg:grid-cols-12 gap-5" style={{ animationDelay: '80ms' }}>
        {/* question list */}
        <div className="lg:col-span-4 space-y-2.5">
          <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-400 px-1 mb-1">Pick a question</div>
          {QUESTIONS.map(x => {
            const active = x.id === activeQ;
            return (
              <button key={x.id} onClick={() => setActiveQ(x.id)}
                className={cn('w-full text-left rounded-lg border p-3.5 transition-colors flex items-start gap-3',
                  active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:border-slate-300')}>
                <span className={cn('h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0', active ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700')}>
                  <IconFor name={x.Icon} size={16} />
                </span>
                <span className="min-w-0">
                  <span className={cn('block text-[13px] font-semibold leading-snug', active ? 'text-white' : 'text-slate-900')}>{x.q}</span>
                  <span className={cn('block text-[11px] mt-0.5 leading-snug', active ? 'text-slate-300' : 'text-slate-500')}>{x.sub}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* answer */}
        <div className="lg:col-span-8 space-y-4">
          <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
              <Icon.Share2 size={14} className="text-slate-700" />
              <span className="text-[13px] font-semibold text-slate-900">Answer subgraph</span>
              <span className="mono text-[9.5px] uppercase tracking-[0.12em] text-slate-400 ml-auto">{result.ids.length} nodes · {result.links.length} edges</span>
            </div>
            <GraphCanvas key={activeQ} selectedId={selected} onSelect={setSelected}
              highlightIds={result.ids} height={420} showAllLabels />
          </div>

          <div className="border border-slate-200 rounded-lg bg-white p-5">
            <div className="flex items-start gap-2.5">
              <Icon.Quote size={16} className="text-slate-300 flex-shrink-0 mt-0.5" />
              <p className="text-[13.5px] text-slate-700 leading-[1.6] text-pretty">{result.narrative}</p>
            </div>
            <div className="mt-4 grid sm:grid-cols-2 gap-x-5 gap-y-1 pt-4 border-t border-slate-100">
              {result.rows.map((r, i) => (
                <NodeRef key={i} node={r.node} onClick={() => setSelected(r.node.id)} />
              ))}
            </div>
            {result.gap && (
              <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-start gap-2 text-[12px] text-slate-600">
                <Icon.Lightbulb size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <span className="leading-snug">{result.gap}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

window.ViewExplorer = ViewExplorer;
