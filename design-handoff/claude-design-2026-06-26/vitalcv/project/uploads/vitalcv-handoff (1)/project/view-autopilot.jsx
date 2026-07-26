// VIEW · Career Autopilot (Trust Mode)

function ViewAutopilot() {
  const c = AUTOPILOT_CLINICIAN;
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-10">
      {/* Header card */}
      <div className="mb-6">
        <AutopilotHeader clinician={c} />
      </div>

      {/* Renewal Radar — full width, the centerpiece */}
      <div className="mb-6">
        <RenewalRadar items={RENEWAL_HORIZON} />
      </div>

      {/* NBA + Trust Score */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        <div className="col-span-12 lg:col-span-8">
          <NBAQueue items={NBA_QUEUE} />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <TrustScorePanel factors={TRUST_FACTORS} />
        </div>
      </div>

      {/* Portability */}
      <div className="mb-6">
        <SectionHeader
          eyebrow="Career mobility"
          title="Where you can practice next"
          right={<span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">{c.homeBoard}</span>}
        />
        <PortabilityMap items={PORTABILITY_MAP} />
      </div>

      {/* Drift Monitor */}
      <div className="mb-6">
        <SectionHeader
          eyebrow="Quiet diagnostics"
          title="Profile drift · what's aging"
          right={<span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">Monitoring since {c.monitoringSince}</span>}
        />
        <DriftMonitor fields={DRIFT_FIELDS} />
      </div>

      {/* Footer principles */}
      <div className="mt-10 border-t border-slate-200 pt-6 grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4">
          <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">Doctrine 01</div>
          <div className="text-[13px] font-semibold text-slate-900 mb-1">We don't renew on your behalf</div>
          <p className="text-[12px] text-slate-600 leading-[1.55]">Boards, the DEA, and payers require the credential holder. We surface the deadline, the form, and the fee — you sign.</p>
        </div>
        <div className="col-span-12 md:col-span-4">
          <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">Doctrine 02</div>
          <div className="text-[13px] font-semibold text-slate-900 mb-1">Verified ≠ attested</div>
          <p className="text-[12px] text-slate-600 leading-[1.55]">A claim restated by you is not a claim re-checked by the source. Drift Monitor shows both clocks so you can tell the difference.</p>
        </div>
        <div className="col-span-12 md:col-span-4">
          <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">Doctrine 03</div>
          <div className="text-[13px] font-semibold text-slate-900 mb-1">Mobility is leverage</div>
          <p className="text-[12px] text-slate-600 leading-[1.55]">Pre-staging compact licenses turns 60-day onboardings into 14-day ones. We flag opportunities; we never auto-apply.</p>
        </div>
      </div>
    </div>
  );
}
window.ViewAutopilot = ViewAutopilot;
