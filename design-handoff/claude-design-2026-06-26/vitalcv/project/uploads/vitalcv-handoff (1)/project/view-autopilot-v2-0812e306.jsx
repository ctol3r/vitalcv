// VIEW · Wave 25 — Career Autopilot v2 (Trust mode)
// Calmer ambient surface. Hero "today" + horizon + drift + portability + week feed + mailbox.

function ViewAutopilotV2() {
  return (
    <div className="bg-slate-100/70 min-h-screen">
      <div className="max-w-[1280px] mx-auto px-6 py-8 space-y-5">
        <AutopilotV2Header clinician={AUTOPILOT_V2_CLINICIAN} />

        <AutopilotV2TodayHero today={AUTOPILOT_V2_TODAY} />

        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-8 space-y-5">
            <AutopilotV2Horizon rows={AUTOPILOT_V2_HORIZON} />
            <AutopilotV2Portability rows={AUTOPILOT_V2_PORTABILITY} />
          </div>
          <aside className="col-span-12 lg:col-span-4 space-y-5">
            <AutopilotV2DriftPanel drift={AUTOPILOT_V2_DRIFT} />
            <AutopilotV2Mailbox rows={AUTOPILOT_V2_MAILBOX} />
            <AutopilotV2ThisWeek rows={AUTOPILOT_V2_THIS_WEEK} />
          </aside>
        </div>

        <div className="border-t border-slate-200 pt-4 mono text-[10.5px] text-slate-500 leading-[1.55] space-y-1.5">
          {AUTOPILOT_V2_DISCLOSURES.map((d, i) => <div key={i}>· {d}</div>)}
        </div>
      </div>
    </div>
  );
}
window.ViewAutopilotV2 = ViewAutopilotV2;
