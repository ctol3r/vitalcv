// VIEW · Wave 24 — Application Active State
// In-progress packet, BEFORE submission. Composition surface with section rail,
// active section body, autofill drawer, and the submit gate.

function ViewApplicationV2() {
  const [activeId, setActiveId] = React.useState(APPLICATION_V2_ACTIVE_ID);
  // For the demo, only §C has a detailed body fixture. Other sections show a
  // placeholder body so the rail still drives navigation honestly.
  const section = APPLICATION_V2_SECTIONS.find(s => s.id === activeId);
  const isActiveDetailed = activeId === APPLICATION_V2_ACTIVE_SECTION.id;

  return (
    <div className="bg-slate-100/70 min-h-screen">
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-5">
        <AppV2Header meta={APPLICATION_V2_META} sections={APPLICATION_V2_SECTIONS} />

        <div className="grid grid-cols-12 gap-5">
          <aside className="col-span-12 lg:col-span-3 lg:sticky lg:top-[60px] lg:self-start">
            <AppV2SectionRail
              sections={APPLICATION_V2_SECTIONS}
              activeId={activeId}
              onSelect={setActiveId}
            />
          </aside>

          <div className="col-span-12 lg:col-span-6 space-y-5">
            {isActiveDetailed ? (
              <AppV2SectionBody section={APPLICATION_V2_ACTIVE_SECTION} />
            ) : (
              <AppV2SectionPlaceholder section={section} />
            )}
            <AppV2AutofillDrawer suggestions={APPLICATION_V2_AUTOFILL_SUGGESTIONS} />
          </div>

          <aside className="col-span-12 lg:col-span-3 space-y-5">
            <AppV2SubmitGate items={APPLICATION_V2_SUBMIT_GATE} />
            <AppV2ActivityFeed events={APPLICATION_V2_ACTIVITY} />
          </aside>
        </div>

        <div className="border-t border-slate-200 pt-4 mono text-[10.5px] text-slate-500 leading-[1.55]">
          Composition surface · packet {APPLICATION_V2_META.id}. The sealed, read-only artifact lives at <span className="text-slate-900">/application</span> (legacy view) once §J is signed and the submit gate clears.
        </div>
      </div>
    </div>
  );
}
window.ViewApplicationV2 = ViewApplicationV2;

function AppV2SectionPlaceholder({ section }) {
  return (
    <div className="border border-dashed border-slate-300 bg-white rounded-[3px] px-6 py-10 text-center">
      <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Section {section.n}</div>
      <div className="text-[18px] font-semibold tracking-[-0.02em] text-slate-900 mt-1">{section.label}</div>
      <div className="text-[12px] text-slate-600 mt-2 max-w-[44ch] mx-auto leading-[1.55]">
        Detailed row-level body for this section is rendered live during the demo only for §C ({APPLICATION_V2_ACTIVE_SECTION.label}). The section rail and submit gate continue to reflect this section's true state.
      </div>
      <div className="mt-4 mono text-[11px] text-slate-700 tabular-nums">
        {section.filled} of {section.required} required filled · {section.autofilled} autofilled · {section.conflicts} conflict
      </div>
    </div>
  );
}
