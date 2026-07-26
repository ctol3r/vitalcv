// VIEW · Executive ROI Dashboard

function ViewROI() {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="mono text-[10.5px] uppercase tracking-[0.2em] text-slate-500 mb-2 inline-flex items-center gap-2">
            Executive ROI · Credentialing Mode
            <span className="h-1 w-1 rounded-full bg-slate-400" />
            <span className="text-slate-700">Quarterly · Board-ready</span>
          </div>
          <h1 className="text-[34px] font-semibold tracking-[-0.02em] text-slate-900 leading-none">
            What VitalCV moved this quarter.
          </h1>
          <p className="mt-3 text-[13.5px] text-slate-600 leading-[1.55] max-w-[72ch]">
            {ROI_META.cohortSize} active credentialing files across {ROI_META.facilities} facilities. Every number on this page is derived from credentialing events with persisted receipts. Methodology footnotes are inline.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[13px] font-semibold text-slate-900">{ROI_META.org}</div>
          <div className="text-[12px] text-slate-600">{ROI_META.reportPeriod}</div>
          <div className="mono text-[10.5px] text-slate-500 mt-1">Generated {ROI_META.generatedAt}</div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mb-6">
        <ROIKpiStrip data={FINANCIAL_IMPACT} />
      </div>

      {/* DTS Chart */}
      <div className="mb-6">
        <DTSChart timeline={DTS_TIMELINE} />
      </div>

      {/* Funnel + Compliance side-by-side */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        <div className="col-span-12 lg:col-span-7">
          <BlockerFunnel funnel={BLOCKER_FUNNEL} />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <ComplianceGrid rows={COMPLIANCE_GRID} />
        </div>
      </div>

      {/* Financial Impact */}
      <div className="mb-6">
        <FinancialImpact data={FINANCIAL_IMPACT} />
      </div>

      {/* Footer disclosure */}
      <div className="mt-10 border-t border-slate-200 pt-6 grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4">
          <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">Disclosure 01</div>
          <div className="text-[13px] font-semibold text-slate-900 mb-1">Numbers cite events, not estimates</div>
          <p className="text-[12px] text-slate-600 leading-[1.55]">DTS, blocker counts, and compliance alignment are reconciled to file-level receipts. Financial impact uses a single net-daily figure jointly attested by Cedar Finance.</p>
        </div>
        <div className="col-span-12 md:col-span-4">
          <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">Disclosure 02</div>
          <div className="text-[13px] font-semibold text-slate-900 mb-1">Comparator is your own baseline</div>
          <p className="text-[12px] text-slate-600 leading-[1.55]">{ROI_META.comparator}. We do not benchmark against industry averages — your prior performance is the only honest comparator.</p>
        </div>
        <div className="col-span-12 md:col-span-4">
          <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">Disclosure 03</div>
          <div className="text-[13px] font-semibold text-slate-900 mb-1">Range, not point estimate</div>
          <p className="text-[12px] text-slate-600 leading-[1.55]">Captured revenue is presented with a ±18% band reflecting service-line mix variance. Audit trail available on request.</p>
        </div>
      </div>
    </div>
  );
}
window.ViewROI = ViewROI;
