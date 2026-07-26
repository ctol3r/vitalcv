// VIEW · Wave 22 — ROI Console v2 (Credentialing Mode)
// Per-pilot ROI surface. Replaces the FY-aggregate Wave 16 dashboard.
//
// Routing: 'roi' tab. The legacy ViewROI remains importable for reference,
// but app.jsx is wired to prefer ViewROIV2 when available.

function ViewROIV2() {
  const [hoursOnlyDemo, setHoursOnlyDemo] = React.useState(false);
  // Toy toggle for the showcase: lets the user see the hours-only render path
  // without editing the data fixture.
  const pilot = React.useMemo(
    () => hoursOnlyDemo ? { ...ROI_V2_PILOT, defaultWageUsd: null } : ROI_V2_PILOT,
    [hoursOnlyDemo]
  );

  const handleExport = (kind) => {
    // No real export — log to console with the demo marker.
    // eslint-disable-next-line no-console
    console.log('roi-v2-export', { kind, recordedBy: 'demo', pilotId: pilot.pilotId });
  };

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-8 space-y-5">
      <RoiConsoleHeader
        pilot={pilot}
        status={ROI_V2_STATUS}
        onExport={handleExport}
      />

      <HoursOnlyBanner
        pilot={pilot}
        onAddWage={() => { window.location.hash = '/activation'; }}
      />

      <RoiHeadlineStrip
        pilot={pilot}
        decisions={ROI_V2_DECISIONS}
        hours={ROI_V2_HOURS}
        ttfd={ROI_V2_TTFD}
      />

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8 space-y-5">
          <RoiTimelineChart timeline={ROI_V2_TIMELINE} decisions={ROI_V2_DECISIONS} />
          <LaneBreakdownTable lanes={ROI_V2_LANE_BREAKDOWN} pilot={pilot} />
          <MethodologyPanel rows={ROI_V2_METHODOLOGY} />
        </div>
        <aside className="col-span-12 lg:col-span-4 space-y-5">
          <DecisionFlowFunnel decisions={ROI_V2_DECISIONS} />
          <PerDecisionCompare pilot={pilot} hours={ROI_V2_HOURS} cost={ROI_V2_COST_DRILLDOWN} />
          <TtfdSparkline ttfd={ROI_V2_TTFD} />

          {/* Hours-only demo toggle — small, local; not a Tweak. */}
          <div className="border border-dashed border-slate-300 rounded-[3px] bg-slate-50/30 px-4 py-3 text-[11.5px] text-slate-600 leading-[1.55]">
            <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1">
              Demo control · hours-only
            </div>
            <p className="mb-2">
              Toggle to preview how the console renders for orgs that haven't entered a default wage. Both paths are first-class — neither is degraded.
            </p>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hoursOnlyDemo}
                onChange={e => setHoursOnlyDemo(e.target.checked)}
                className="accent-slate-900"
              />
              <span className="mono text-[11px] uppercase tracking-[0.12em] text-slate-700">
                {hoursOnlyDemo ? 'hours-only · on' : 'wage-set · on'}
              </span>
            </label>
          </div>
        </aside>
      </div>

      {/* Footer disclosure */}
      <div className="border-t border-slate-200 pt-4 mono text-[10.5px] text-slate-500 leading-[1.55]">
        Pilot {pilot.pilotId} · Owner {pilot.ownerContact} · Marketing tier: {pilot.tier}.
        ROI on this surface is reviewer-hours and decision throughput — not a comprehensive financial model.
        Comparisons are vs. your entered baseline of {pilot.baselineDays}d, not an industry average.
      </div>
    </div>
  );
}

window.ViewROIV2 = ViewROIV2;
