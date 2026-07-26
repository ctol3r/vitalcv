// WAVE 1100 · D4 — /dna
// A clinician's career as a topology — a shape read from the graph's structure, not a score.

function Radar({ metrics, size = 380 }) {
  const cx = size / 2, cy = size / 2, R = size * 0.36;
  const N = metrics.length;
  const pt = (i, frac) => {
    const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
    return [cx + Math.cos(a) * R * frac, cy + Math.sin(a) * R * frac];
  };
  const poly = metrics.map((m, i) => pt(i, Math.max(0.06, m.value / 100)).join(',')).join(' ');
  const PAD = 56;
  return (
    <svg viewBox={`${-PAD} ${-16} ${size + PAD * 2} ${size + 28}`} className="w-full h-auto" style={{ maxWidth: size + PAD * 2, overflow: 'visible' }}>
      {/* rings */}
      {[0.25, 0.5, 0.75, 1].map(fr => (
        <polygon key={fr} points={metrics.map((_, i) => pt(i, fr).join(',')).join(' ')}
          fill="none" stroke="#e2e8f0" strokeWidth="1" />
      ))}
      {/* axes */}
      {metrics.map((m, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
      })}
      {/* value polygon */}
      <polygon points={poly} fill="#0f172a" fillOpacity="0.08" stroke="#0f172a" strokeWidth="2" strokeLinejoin="round" />
      {metrics.map((m, i) => {
        const [x, y] = pt(i, Math.max(0.06, m.value / 100));
        return <circle key={i} cx={x} cy={y} r="3.5" fill="#0f172a" />;
      })}
      {/* axis labels */}
      {metrics.map((m, i) => {
        const [x, y] = pt(i, 1.16);
        const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
        const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
        return (
          <text key={i} x={x} y={y} textAnchor={anchor} dominantBaseline="middle"
            fontSize="11" fontWeight="600" fill="#334155">
            {m.short}
            <tspan x={x} dy="13" fontSize="13" fontWeight="700" fill="#0f172a" className="mono">{m.value}</tspan>
          </text>
        );
      })}
    </svg>
  );
}

function FamilyStrand() {
  const counts = Object.keys(FAMILIES).map(fam => ({ fam, n: NODES.filter(x => x.family === fam).length }));
  const total = NODES.length;
  return (
    <div>
      <div className="flex h-9 rounded-md overflow-hidden border border-slate-200">
        {counts.map(({ fam, n }) => {
          const f = FAMILIES[fam];
          return (
            <div key={fam} title={`${f.label}: ${n}`} style={{ width: `${(n / total) * 100}%`, background: f.dashed ? '#f1f5f9' : f.accent }}
              className="flex items-center justify-center">
              <span className="mono text-[10px] font-semibold tabular-nums" style={{ color: f.dashed ? '#64748b' : '#fff' }}>{n}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2"><FamilyLegend /></div>
    </div>
  );
}

function ViewDNA() {
  const metrics = React.useMemo(() => DNA_METRICS.map(m => ({
    ...m, value: Math.max(0, Math.min(100, m.compute())),
    short: m.label.replace('Career ', '').replace('Professional ', ''),
  })), []);
  const max = metrics.reduce((a, m) => m.value > a.value ? m : a, metrics[0]);
  const min = metrics.reduce((a, m) => m.value < a.value ? m : a, metrics[0]);

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-7">
      <div className="rise">
        <SurfaceIntro eyebrow="Career DNA · Wave 1100"
          title="A topology, not a score"
          sub="No single number can hold a career. This is its shape — six structural signatures read directly off the graph: how strong it is, how diverse, how dense with leadership, how deep academically, how mobile, how far its influence reaches."
          right={<span className="hidden md:inline-flex items-center gap-2 mono text-[10px] uppercase tracking-[0.12em] text-slate-500 border border-slate-200 rounded-md px-3 py-2"><Icon.Fingerprint size={13} /> computed live</span>} />
      </div>

      <div className="rise grid lg:grid-cols-12 gap-5 items-stretch" style={{ animationDelay: '80ms' }}>
        {/* signature */}
        <div className="lg:col-span-5">
          <div className="border border-slate-200 rounded-lg bg-white h-full flex flex-col">
            <CardHead icon={Icon.Atom} title="Career signature" right={<Eyebrow>6-axis topology</Eyebrow>} />
            <div className="flex-1 flex items-center justify-center p-6">
              <Radar metrics={metrics} />
            </div>
            <div className="px-5 py-3.5 border-t border-slate-100 grid grid-cols-2 gap-3 text-[11.5px]">
              <div className="flex items-center gap-2"><Icon.ArrowUp size={13} className="text-emerald-600" /><span className="text-slate-600">Deepest: <span className="font-semibold text-slate-900">{max.short}</span></span></div>
              <div className="flex items-center gap-2"><Icon.ArrowDown size={13} className="text-amber-600" /><span className="text-slate-600">Thinnest: <span className="font-semibold text-slate-900">{min.short}</span></span></div>
            </div>
          </div>
        </div>

        {/* metric readouts */}
        <div className="lg:col-span-7">
          <div className="grid sm:grid-cols-2 gap-4 h-full">
            {metrics.map(m => (
              <div key={m.key} className="border border-slate-200 rounded-lg bg-white p-4 flex flex-col">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold text-slate-900">{m.label}</span>
                  <span className="text-[22px] font-semibold text-slate-900 tabular-nums leading-none">{m.value}</span>
                </div>
                <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: `${m.value}%` }} />
                </div>
                <p className="mt-2.5 text-[11.5px] text-slate-500 leading-snug text-pretty">{m.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DNA strand — family composition */}
      <section className="rise" style={{ animationDelay: '140ms' }}>
        <SectionHeader n="01" title="What the career is made of" sub="The composition of the graph by entity family — the strand the topology is read from." right={`${NODES.length} entities`} />
        <div className="border border-slate-200 rounded-lg bg-white p-5">
          <FamilyStrand />
        </div>
      </section>

      {/* interpretation */}
      <section className="rise" style={{ animationDelay: '180ms' }}>
        <SectionHeader n="02" title="Reading the topology" sub="A shape tells you where a career is deep, where it is thin, and where it can still grow." right="structure → meaning" />
        <div className="grid md:grid-cols-3 gap-4">
          <ReadCard Icon={Icon.Scale} kind="Balance" tone="slate"
            text={`The record is deep before it is broad — ${max.short} leads at ${max.value}, while ${min.short} trails at ${min.value}. A characteristic early-career shape.`} />
          <ReadCard Icon={Icon.TrendingUp} kind="Leverage" tone="indigo"
            text="The thinnest axis is also the cheapest to grow: a single research node would visibly reshape the signature toward symmetry." />
          <ReadCard Icon={Icon.Route} kind="Reach" tone="emerald"
            text="Mobility stays high because three aspiration targets remain reachable from the current structure — the topology is not yet settled." />
        </div>
      </section>
    </div>
  );
}

function ReadCard({ Icon: I, kind, text, tone }) {
  const toneCls = { slate: 'text-slate-700 bg-slate-100', indigo: 'text-indigo-700 bg-indigo-50', emerald: 'text-emerald-700 bg-emerald-50' }[tone];
  return (
    <div className="border border-slate-200 rounded-lg bg-white p-4">
      <div className={cn('h-8 w-8 rounded-md flex items-center justify-center mb-3', toneCls)}><I size={16} /></div>
      <span className="mono text-[9px] uppercase tracking-[0.14em] text-slate-400">{kind}</span>
      <p className="text-[12.5px] text-slate-700 leading-[1.55] mt-1 text-pretty">{text}</p>
    </div>
  );
}

window.ViewDNA = ViewDNA;
