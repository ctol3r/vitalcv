// WAVE 16 · Executive ROI components

/* ---------- KPI Strip ---------- */
function ROIKpiStrip({ data }) {
  const last = DTS_TIMELINE[DTS_TIMELINE.length - 1];
  const compressionDays = last.baseline - last.cohortP50;
  const compressionPct = Math.round((compressionDays / last.baseline) * 100);

  const kpis = [
    { eyebrow: 'Days-to-Start · Q1 26',  big: `${last.cohortP50}d`, sub: `vs ${last.baseline}d baseline · −${compressionDays}d (${compressionPct}%)`, tone: 'pos' },
    { eyebrow: 'Auto-Resolved Blockers', big: '81.7%',              sub: `${BLOCKER_FUNNEL[1].count.toLocaleString()} of ${BLOCKER_FUNNEL[0].count.toLocaleString()} cleared without review`, tone: 'pos' },
    { eyebrow: 'NCQA / TJC Alignment',   big: '100%',               sub: `${COMPLIANCE_GRID.length} controls · zero exceptions this period`, tone: 'pos' },
    { eyebrow: 'Captured Revenue',       big: data.capturedRevenueLabel, sub: `Net of platform cost: ${data.netImpactLabel} · payback ${data.paybackDays}d`, tone: 'pos' },
  ];

  return (
    <div className="grid grid-cols-4 border border-slate-200 rounded-[3px] bg-white divide-x divide-slate-200">
      {kpis.map((k, i) => (
        <div key={i} className="px-5 py-4">
          <div className="mono text-[10px] uppercase tracking-[0.16em] text-slate-500 mb-2">{k.eyebrow}</div>
          <div className="text-[32px] font-semibold tracking-[-0.025em] text-slate-900 leading-none tabular-nums">{k.big}</div>
          <div className="mono text-[10.5px] text-slate-600 mt-2 leading-[1.45]">{k.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- DTS Compression Chart ---------- */
function DTSChart({ timeline }) {
  // SVG geometry
  const W = 760, H = 240, padL = 56, padR = 24, padT = 18, padB = 36;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const yMax = 64, yMin = 0;
  const xStep = innerW / (timeline.length - 1);
  const baseline = timeline[0].baseline;

  const yFor = v => padT + (1 - (v - yMin) / (yMax - yMin)) * innerH;
  const xFor = i => padL + i * xStep;

  // Cohort p50 line
  const linePoints = timeline.map((d, i) => `${xFor(i)},${yFor(d.cohortP50)}`).join(' ');
  // Confidence band (P10/P90)
  const bandTop = timeline.map((d, i) => `${xFor(i)},${yFor(d.cohortP10)}`).join(' ');
  const bandBot = [...timeline].reverse().map((d, i) => `${xFor(timeline.length - 1 - i)},${yFor(d.cohortP90)}`).join(' ');
  const bandPath = `M ${bandTop} L ${bandBot} Z`;
  // Baseline line
  const baselineY = yFor(baseline);

  return (
    <div className="border border-slate-200 rounded-[3px] bg-white overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Activity size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Days-to-Start · 7-quarter trend</span>
        </div>
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5"><span className="h-px w-3 bg-slate-400 inline-block" />baseline</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-3 bg-slate-200 inline-block rounded-[1px]" />P10/P90</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-px w-3 bg-slate-900 inline-block" />cohort P50</span>
        </div>
      </div>

      <div className="p-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {/* Grid lines */}
          {[0, 16, 32, 48, 64].map(v => (
            <g key={v}>
              <line x1={padL} y1={yFor(v)} x2={W - padR} y2={yFor(v)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2 3" />
              <text x={padL - 8} y={yFor(v) + 3} textAnchor="end" className="mono fill-slate-500" style={{ fontSize: 10 }}>{v}d</text>
            </g>
          ))}
          {/* Confidence band */}
          <path d={bandPath} fill="#0f172a" fillOpacity="0.08" />
          {/* Baseline */}
          <line x1={padL} y1={baselineY} x2={W - padR} y2={baselineY} stroke="#94a3b8" strokeWidth="1.4" strokeDasharray="4 4" />
          <text x={W - padR} y={baselineY - 6} textAnchor="end" className="mono fill-slate-500" style={{ fontSize: 10 }}>{baseline}d Cedar baseline</text>
          {/* Cohort line */}
          <polyline fill="none" stroke="#0f172a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" points={linePoints} />
          {/* Points */}
          {timeline.map((d, i) => (
            <g key={i}>
              <circle cx={xFor(i)} cy={yFor(d.cohortP50)} r="3" fill="#0f172a" />
              <text x={xFor(i)} y={yFor(d.cohortP50) - 8} textAnchor="middle" className="mono fill-slate-900" style={{ fontSize: 10, fontWeight: 600 }}>{d.cohortP50}d</text>
              <text x={xFor(i)} y={H - padB + 14} textAnchor="middle" className="mono fill-slate-500" style={{ fontSize: 10 }}>{d.period}</text>
              <text x={xFor(i)} y={H - padB + 26} textAnchor="middle" className="mono fill-slate-400" style={{ fontSize: 9 }}>n={d.n}</text>
            </g>
          ))}
        </svg>

        <div className="mt-3 mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500">
          Methodology: P50 = median calendar days from application submitted to first paid shift · P10/P90 = 10th/90th percentile · n = files closed in period.
        </div>
      </div>
    </div>
  );
}

/* ---------- Blocker Funnel ---------- */
function BlockerFunnel({ funnel }) {
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Layers size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Blocker Resolution · funnel</span>
        </div>
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">{ROI_META.reportPeriod}</div>
      </div>

      <ul className="p-5 space-y-2">
        {funnel.map((step, i) => {
          const widthPct = step.pct * 100;
          const isAuto = step.id === 'auto';
          return (
            <li key={step.id}>
              <div className="flex items-baseline justify-between mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500 mb-1">
                <span>{String(i + 1).padStart(2, '0')} · {step.label}</span>
                <span className="text-slate-900 tabular-nums">
                  {step.count.toLocaleString()}
                  <span className="text-slate-500 ml-2">{(step.pct * 100).toFixed(1)}%</span>
                </span>
              </div>
              <div className="relative h-7 bg-slate-50 rounded-[2px] overflow-hidden">
                <div
                  className={cn('h-full', i === 0 ? 'bg-slate-900' : isAuto ? 'bg-emerald-600' : i === funnel.length - 1 ? 'bg-amber-500' : 'bg-slate-700')}
                  style={{ width: `${widthPct}%` }}
                />
                <div className="absolute inset-y-0 left-3 flex items-center mono text-[11px] text-white pointer-events-none mix-blend-difference">
                  {step.sub}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/40 grid grid-cols-3 gap-4">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Automation leverage</div>
          <div className="text-[18px] font-semibold tabular-nums text-slate-900 mt-1">81.7%</div>
          <div className="mono text-[10.5px] text-slate-600">cleared without human review</div>
        </div>
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Reviewer hours saved</div>
          <div className="text-[18px] font-semibold tabular-nums text-slate-900 mt-1">∼ 412 hrs</div>
          <div className="mono text-[10.5px] text-slate-600">@ 24 min/blocker prevented</div>
        </div>
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Committee escalations</div>
          <div className="text-[18px] font-semibold tabular-nums text-slate-900 mt-1">12</div>
          <div className="mono text-[10.5px] text-slate-600">all bylaws-mandated · 0 avoidable</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Compliance Grid ---------- */
function ComplianceGrid({ rows }) {
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.ShieldCheck size={13} className="text-emerald-600" />
          <span className="text-[13px] font-semibold text-slate-900">Compliance Health · standards alignment</span>
        </div>
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-emerald-700">
          {rows.length}/{rows.length} aligned · zero exceptions
        </div>
      </div>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/30">
            <th className="text-left mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium px-5 py-2.5">Authority</th>
            <th className="text-left mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium py-2.5">Standard</th>
            <th className="text-left mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium py-2.5">Topic</th>
            <th className="text-left mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium py-2.5">Cohort</th>
            <th className="text-left mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 font-medium px-5 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={i} className="lane-row">
              <td className="px-5 py-2.5 mono text-[11.5px] text-slate-900 font-medium">{r.authority}</td>
              <td className="py-2.5 mono text-[11.5px] text-slate-700">{r.std}</td>
              <td className="py-2.5">
                <div className="text-[12.5px] text-slate-900">{r.topic}</div>
                <div className="mono text-[10.5px] text-slate-500 mt-0.5">{r.detail}</div>
              </td>
              <td className="py-2.5 mono text-[11px] text-slate-700 tabular-nums">{r.cohort}</td>
              <td className="px-5 py-2.5">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] ring-1 ring-inset bg-emerald-50 text-emerald-700 ring-emerald-600/20 text-[10.5px] font-medium uppercase tracking-[0.06em]">
                  <Icon.Check size={11} strokeWidth={2.5} />
                  Aligned
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Financial Impact ---------- */
function FinancialImpact({ data }) {
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Hash size={13} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Financial Impact · captured revenue</span>
        </div>
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">{ROI_META.reportPeriod}</div>
      </div>

      <div className="grid grid-cols-12 gap-0">
        {/* Headline column */}
        <div className="col-span-5 p-6 border-r border-slate-200">
          <div className="mono text-[10.5px] uppercase tracking-[0.16em] text-slate-500 mb-2">Captured revenue</div>
          <div className="text-[56px] font-semibold tracking-[-0.03em] text-slate-900 leading-none tabular-nums">{data.capturedRevenueLabel}</div>
          <div className="mt-2 mono text-[11px] text-slate-600 tabular-nums">
            Range ${(data.rangeLow / 1e6).toFixed(2)}M – ${(data.rangeHigh / 1e6).toFixed(2)}M · ±18%
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Net of platform</div>
              <div className="text-[18px] font-semibold text-slate-900 tabular-nums mt-0.5">{data.netImpactLabel}</div>
              <div className="mono text-[10.5px] text-slate-500">cost ${(data.platformCost / 1000).toFixed(0)}k</div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Payback</div>
              <div className="text-[18px] font-semibold text-slate-900 tabular-nums mt-0.5">{data.paybackDays} days</div>
              <div className="mono text-[10.5px] text-slate-500">ROI {Math.round((data.netImpact / data.platformCost) * 10) / 10}×</div>
            </div>
          </div>
        </div>

        {/* Methodology */}
        <div className="col-span-3 p-6 border-r border-slate-200">
          <div className="mono text-[10.5px] uppercase tracking-[0.16em] text-slate-500 mb-3">Methodology</div>
          <ul className="space-y-3">
            {data.methodology.map((m, i) => (
              <li key={i} className="border-l-2 border-slate-200 pl-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-slate-500">{m.k}</span>
                  <span className="mono text-[11.5px] text-slate-900 tabular-nums">{m.v}</span>
                </div>
                <div className="text-[10.5px] text-slate-600 mt-1 leading-[1.5]">{m.sub}</div>
              </li>
            ))}
          </ul>
        </div>

        {/* By facility */}
        <div className="col-span-4 p-6">
          <div className="mono text-[10.5px] uppercase tracking-[0.16em] text-slate-500 mb-3">By facility</div>
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left mono text-[10px] uppercase tracking-[0.12em] text-slate-500 font-medium pb-2">Facility</th>
                <th className="text-right mono text-[10px] uppercase tracking-[0.12em] text-slate-500 font-medium pb-2">Files</th>
                <th className="text-right mono text-[10px] uppercase tracking-[0.12em] text-slate-500 font-medium pb-2">Days saved</th>
                <th className="text-right mono text-[10px] uppercase tracking-[0.12em] text-slate-500 font-medium pb-2">Capture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.byFacility.map((f, i) => (
                <tr key={i}>
                  <td className="py-2 text-[11.5px] text-slate-900">{f.facility}</td>
                  <td className="py-2 text-right mono tabular-nums text-slate-700">{f.files}</td>
                  <td className="py-2 text-right mono tabular-nums text-slate-700">{f.days.toLocaleString()}</td>
                  <td className="py-2 text-right mono tabular-nums text-slate-900 font-medium">${(f.capture / 1000).toFixed(0)}k</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50/40 mono text-[10.5px] text-slate-500 leading-[1.55]">
        <span className="uppercase tracking-[0.12em] text-slate-700">Source — </span>
        Net daily contribution from Cedar Finance memo CFM-2025-04-22 (service-line blended, post-malpractice and locum offset). Days-saved derived from VitalCV file telemetry. Joint-attested by Cedar Finance and Cedar MSO.
      </div>
    </div>
  );
}

window.ROIKpiStrip = ROIKpiStrip;
window.DTSChart = DTSChart;
window.BlockerFunnel = BlockerFunnel;
window.ComplianceGrid = ComplianceGrid;
window.FinancialImpact = FinancialImpact;
