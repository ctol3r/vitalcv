// VIEW · Start-Activation Console (Credentialing Mode)

function ViewActivation() {
  const c = ACTIVATION_CASE;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-10">
      {/* Eyebrow */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="mono text-[10.5px] uppercase tracking-[0.2em] text-slate-500 mb-2 inline-flex items-center gap-2">
            Start Activation · Credentialing Mode
            <span className="h-1 w-1 rounded-full bg-slate-400" />
            <span className="text-slate-700">{c.id}</span>
          </div>
          <h1 className="text-[34px] font-semibold tracking-[-0.02em] text-slate-900 leading-none">
            Acceptance is the milestone. Day-1 readiness is the work.
          </h1>
          <p className="mt-3 text-[13.5px] text-slate-600 leading-[1.55] max-w-[72ch]">
            Four parallel tracks gate the first paid shift: <span className="text-slate-900">privileging</span>,
            <span className="text-slate-900"> payer enrollment</span>,
            <span className="text-slate-900"> onboarding compliance</span>, and
            <span className="text-slate-900"> medical-staff schedule clearance</span>.
            VitalCV tracks every owner, every blocking artifact, every clock.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="text-[13px] text-slate-700">
            <span className="font-semibold text-slate-900">{c.clinician}</span>
            <span className="text-slate-400 mx-2">·</span>
            <span className="mono text-[12px]">NPI {c.npi}</span>
          </div>
          <div className="text-[12px] text-slate-600">{c.facility} · <span className="mono text-[11px]">{c.facilityCode}</span></div>
          <div className="mono text-[10.5px] text-slate-500 mt-1">Accepted {c.acceptedAt}</div>
        </div>
      </div>

      {/* Critical path */}
      <div className="mb-6">
        <CriticalPathStrip stages={CRITICAL_PATH} />
      </div>

      {/* Burn-down + Handoff side-by-side */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        <div className="col-span-12 lg:col-span-4">
          <BurnDownCard caseData={c} />
        </div>
        <div className="col-span-12 lg:col-span-8">
          <HandoffTimeline handoffs={HANDOFFS} />
        </div>
      </div>

      {/* Privileges */}
      <div className="mb-6">
        <SectionHeader
          eyebrow="Track 01 · Privileging"
          title="Clinical Privileges · facility-specific"
          right={
            <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
              Authority: Department of Surgery · Credentials Cmte
            </span>
          }
        />
        <PrivilegeTracker privileges={PRIVILEGES} />
      </div>

      {/* Payers */}
      <div className="mb-6">
        <SectionHeader
          eyebrow="Track 02 · Payer Enrollment"
          title="Payer Matrix · TIN reassignment + roster delegation"
          right={
            <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
              SOR: PECOS · Medi-Cal PAVE
            </span>
          }
        />
        <PayerMatrix payers={PAYERS} />
      </div>

      {/* Onboarding */}
      <div className="mb-6">
        <SectionHeader
          eyebrow="Track 03 · Onboarding Compliance"
          title="Cleared-to-Schedule Checklist"
          right={
            <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
              Authority: Employee Health · MSO · Education
            </span>
          }
        />
        <OnboardingTasks tasks={ONBOARDING_TASKS} />
      </div>

      {/* Footer principles */}
      <div className="mt-10 border-t border-slate-200 pt-6 grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4">
          <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">Principle 01</div>
          <div className="text-[13px] font-semibold text-slate-900 mb-1">No black-box ETAs</div>
          <p className="text-[12px] text-slate-600 leading-[1.55]">Every day-count is a P50 with a P10/P90 range and a model version. Decisions get bounds, not point estimates.</p>
        </div>
        <div className="col-span-12 md:col-span-4">
          <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">Principle 02</div>
          <div className="text-[13px] font-semibold text-slate-900 mb-1">Owners are people, not queues</div>
          <p className="text-[12px] text-slate-600 leading-[1.55]">Each blocker is assigned to a named human or named system, with a chain-of-custody receipt at every handoff.</p>
        </div>
        <div className="col-span-12 md:col-span-4">
          <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-2">Principle 03</div>
          <div className="text-[13px] font-semibold text-slate-900 mb-1">Privileges are not permissions</div>
          <p className="text-[12px] text-slate-600 leading-[1.55]">Clinical privileges follow facility bylaws and FPPE plans. We surface the policy; we don't manufacture authorization.</p>
        </div>
      </div>
    </div>
  );
}
window.ViewActivation = ViewActivation;
