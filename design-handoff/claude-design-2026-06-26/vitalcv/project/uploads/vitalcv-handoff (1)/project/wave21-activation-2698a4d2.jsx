// WAVE 21 · Activation Launchpad components
// Employer pilot-onboarding wizard. 4 steps to first usable receipt.
//
// Conventions:
//  - Every numeric estimate carries an inline qualifier from LABEL_QUALIFIER.
//  - "Verified" is reserved for PSV claims; we use "Complete" for done steps.
//  - The dollar field on the ROI preview only renders when ORG.defaultWageUsd is set.
//  - No HRIS / PSV-vendor logos. No promised time-to-decision.

/* ---------- Step state pip ---------- */
function StepStatePip({ state }) {
  const meta = STEP_STATUS_META[state];
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] ring-1 ring-inset text-[10.5px] font-medium uppercase tracking-[0.06em]',
      meta.cls
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

/* ---------- One step card ---------- */
function ActivationStep({ step, state, locked, lockedReason, completedAt, children, onActivate, isOpen }) {
  const meta = STEP_STATUS_META[state];
  const headerCls = cn(
    'border border-slate-200 rounded-[3px] bg-white transition-all',
    locked && 'opacity-60',
    isOpen && 'ring-1 ring-slate-900/10'
  );
  return (
    <div className={headerCls}>
      <button
        type="button"
        onClick={() => !locked && onActivate?.()}
        className={cn(
          'w-full flex items-start gap-4 px-5 py-4 text-left',
          !locked && 'hover:bg-slate-50/60 cursor-pointer',
          locked && 'cursor-not-allowed'
        )}
        disabled={locked}
      >
        {/* Step number */}
        <div className={cn(
          'h-9 w-9 rounded-full flex items-center justify-center mono text-[13px] tabular-nums font-semibold flex-shrink-0',
          state === 'complete' ? 'bg-emerald-600 text-white' :
          state === 'in-progress' ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-300' :
          state === 'blocked-on-org-input' ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-300' :
          'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
        )}>
          {state === 'complete' ? <Icon.Check size={14} strokeWidth={3} /> : String(step.num).padStart(2, '0')}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-[15px] font-semibold text-slate-900 tracking-tightish">
              Step {step.num} · {step.title}
            </div>
            <StepStatePip state={state} />
            {completedAt && (
              <span className="mono text-[10.5px] text-slate-500">Completed {completedAt}</span>
            )}
          </div>
          <p className="mt-1 text-[12.5px] text-slate-600 leading-[1.55] max-w-[72ch]">
            {step.sub}
          </p>
          {locked && lockedReason && (
            <BlockedStepReason reason={lockedReason} />
          )}
        </div>

        <div className="flex-shrink-0 self-center">
          <Icon.ChevronRight
            size={16}
            className={cn('text-slate-400 transition-transform', isOpen && 'rotate-90')}
          />
        </div>
      </button>

      {isOpen && !locked && (
        <div className="border-t border-slate-100 px-5 py-5 bg-slate-50/30">
          {children}
        </div>
      )}
    </div>
  );
}

/* ---------- Inline gate-reason ---------- */
function BlockedStepReason({ reason }) {
  return (
    <div className="mt-2 inline-flex items-start gap-2 mono text-[10.5px] text-slate-600 bg-white border border-slate-200 rounded-[2px] px-2 py-1">
      <Icon.Lock size={11} className="mt-0.5 text-slate-500 flex-shrink-0" />
      <span><span className="uppercase tracking-[0.12em] text-slate-500">Gated · </span>{reason}</span>
    </div>
  );
}

/* ---------- Step 1 · Org Profile Form ---------- */
function OrgProfileForm({ org, onSave }) {
  const [name, setName] = React.useState(org.displayName || '');
  const [states, setStates] = React.useState(org.baselinePolicy?.statesServed || ['CA']);
  const [sla, setSla] = React.useState(org.baselinePolicy?.decisionSlaDays ?? 7);
  const [wage, setWage] = React.useState(org.defaultWageUsd ?? '');
  const [showWage, setShowWage] = React.useState(org.defaultWageUsd != null);

  const valid = name.trim().length >= 2 && states.length >= 1;

  const toggleState = (code) => {
    setStates(s => s.includes(code) ? s.filter(x => x !== code) : [...s, code]);
  };

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* Display name */}
      <div className="col-span-12 md:col-span-7">
        <label className="block mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1.5">
          Display name <span className="text-rose-600 normal-case">required</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Cedar Health Surgical Pavilion"
          className="w-full border border-slate-300 rounded-[2px] px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
        />
      </div>

      {/* Decision SLA */}
      <div className="col-span-12 md:col-span-5">
        <label className="block mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1.5">
          Decision SLA target
        </label>
        <select
          value={sla}
          onChange={e => setSla(Number(e.target.value))}
          className="w-full border border-slate-300 rounded-[2px] px-3 py-2 text-[13px] text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
        >
          {SLA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* States served */}
      <div className="col-span-12">
        <label className="block mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1.5">
          States served <span className="text-slate-400 normal-case">· at least one</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {STATES_OPTIONS.map(s => {
            const active = states.includes(s.code);
            return (
              <button
                key={s.code}
                type="button"
                onClick={() => toggleState(s.code)}
                className={cn(
                  'mono text-[11px] uppercase tracking-[0.1em] px-2.5 py-1 rounded-[2px] ring-1 ring-inset transition',
                  active
                    ? 'bg-slate-900 text-white ring-slate-900'
                    : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'
                )}
              >
                {s.code}
              </button>
            );
          })}
        </div>
      </div>

      {/* Default wage (optional) */}
      <div className="col-span-12">
        <div className="flex items-center justify-between mb-1.5">
          <label className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
            Default reviewer wage
            <span className="ml-2 normal-case text-slate-400">· optional · used for ROI math</span>
          </label>
          {!showWage && (
            <button
              type="button"
              onClick={() => setShowWage(true)}
              className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-700 hover:underline"
            >
              + Add wage
            </button>
          )}
        </div>
        {showWage ? (
          <div className="flex items-center gap-2">
            <span className="mono text-[12px] text-slate-500">$</span>
            <input
              type="number"
              value={wage}
              onChange={e => setWage(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="65"
              className="w-32 border border-slate-300 rounded-[2px] px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
            <span className="mono text-[11px] text-slate-500">/ hour</span>
            <span className="text-[11.5px] text-slate-500">
              · ROI preview shows hours-only until you set this
            </span>
          </div>
        ) : (
          <p className="text-[11.5px] text-slate-500 leading-[1.55]">
            Skip if you'd rather see ROI in hours only. You can add a wage later in Settings.
          </p>
        )}
      </div>

      {/* Save */}
      <div className="col-span-12 flex items-center justify-between pt-2 border-t border-slate-200 mt-1">
        <p className="text-[11px] text-slate-500 leading-[1.55] max-w-[60ch]">
          We use this profile to scope ROI math and policy display. None of these fields claim integration with an HRIS or PSV vendor.
        </p>
        <Button
          variant="primary"
          size="sm"
          disabled={!valid}
          onClick={() => onSave({
            displayName: name.trim(),
            baselinePolicy: { statesServed: states, decisionSlaDays: sla },
            defaultWageUsd: wage === '' ? null : Number(wage),
          })}
        >
          Save profile
        </Button>
      </div>
    </div>
  );
}

/* ---------- Step 2 · Sample Upload Dropzone + Ingestion Table ---------- */
function SampleUploadDropzone({ onAddDemoFile }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={e => { e.preventDefault(); setHover(false); onAddDemoFile?.(); }}
      className={cn(
        'border border-dashed rounded-[3px] px-6 py-8 text-center transition',
        hover ? 'border-slate-900 bg-slate-50' : 'border-slate-300 bg-white'
      )}
    >
      <Icon.Upload size={22} className="text-slate-500 mx-auto mb-3" />
      <div className="text-[13.5px] font-semibold text-slate-900 mb-1">
        Drop sample credential bundles here
      </div>
      <p className="text-[11.5px] text-slate-600 leading-[1.55] max-w-[52ch] mx-auto">
        PDFs work best · multi-file accepted · 5+ samples unlocks Step&nbsp;3.
        We parse them in your browser, then stage extracted fields in the Inbox for review.
      </p>
      <div className="mt-4 inline-flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onAddDemoFile}>
          <Icon.Plus size={12} className="mr-1.5" />
          Add demo file
        </Button>
        <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          or drag-drop
        </span>
      </div>
    </div>
  );
}

function IngestionProgressTable({ uploads, onRetry }) {
  if (!uploads.length) {
    return (
      <div className="text-[12px] text-slate-500 italic px-1 py-2">
        No uploads yet. Drop or add a demo file above.
      </div>
    );
  }
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Layers size={12} className="text-slate-700" />
          <span className="text-[12.5px] font-semibold text-slate-900">Ingestion progress</span>
          <span className="mono text-[10.5px] text-slate-500">
            · {uploads.length} file{uploads.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          uploaded → parsed → extracted → staged
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {uploads.map(u => {
          const m = UPLOAD_STATE_META[u.state];
          const failed = u.state === 'failed';
          return (
            <li key={u.id} className="px-4 py-3 grid grid-cols-12 gap-3 items-center">
              <div className="col-span-5 min-w-0">
                <div className="text-[12.5px] text-slate-900 truncate">{u.filename}</div>
                <div className="mono text-[10.5px] text-slate-500 mt-0.5 tabular-nums">
                  {(u.sizeKb / 1024).toFixed(2)} MB · {u.uploadedAt}
                </div>
              </div>
              <div className="col-span-2">
                <span className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] ring-1 ring-inset text-[10.5px] font-medium uppercase tracking-[0.06em]',
                  m.cls
                )}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
                  {m.label}
                </span>
              </div>
              <div className="col-span-3">
                <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full',
                      failed ? 'bg-rose-500' :
                      u.state === 'staged-in-inbox' ? 'bg-emerald-600' :
                      u.state === 'extracted' ? 'bg-amber-500' :
                      'bg-slate-500'
                    )}
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
              </div>
              <div className="col-span-2 text-right">
                {failed ? (
                  <button
                    onClick={() => onRetry?.(u.id)}
                    className="mono text-[10.5px] uppercase tracking-[0.14em] text-rose-700 hover:underline"
                  >
                    Re-upload →
                  </button>
                ) : (
                  <span className="mono text-[10.5px] text-slate-500 truncate">
                    {u.parsedAt ? `parsed ${u.parsedAt}` : '—'}
                  </span>
                )}
              </div>
              {u.notes && (
                <div className="col-span-12 text-[11.5px] text-slate-600 leading-[1.5] pt-0.5 -mt-1">
                  {u.notes}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Step 3 · Baseline form ---------- */
function BaselineForm({ baseline, onSave }) {
  const [days, setDays] = React.useState(baseline?.currentTimeToFirstDecisionDays ?? '');
  const valid = days !== '' && Number(days) > 0 && Number(days) < 365;
  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-12 md:col-span-7">
        <label className="block mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1.5">
          Your current time-to-first-decision <span className="text-rose-600 normal-case">required</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={days}
            onChange={e => setDays(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="21"
            className="w-32 border border-slate-300 rounded-[2px] px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
          <span className="mono text-[11px] text-slate-500">days</span>
        </div>
        <p className="mt-2 text-[11.5px] text-slate-600 leading-[1.55] max-w-[60ch]">
          {LABEL_QUALIFIER.baseline}.
          Most pilots enter a number between 14 and 28 days for first decision.
        </p>
      </div>
      <div className="col-span-12 md:col-span-5">
        <div className="border border-slate-200 rounded-[3px] bg-white px-4 py-3">
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1">
            Why we ask
          </div>
          <p className="text-[12px] text-slate-700 leading-[1.55]">
            ROI is measured against this number. We never use industry-average baselines without your input — your number is your number.
          </p>
        </div>
      </div>
      <div className="col-span-12 flex items-center justify-end pt-2 border-t border-slate-200 mt-1">
        <Button
          variant="primary"
          size="sm"
          disabled={!valid}
          onClick={() => onSave({ currentTimeToFirstDecisionDays: Number(days) })}
        >
          Save baseline
        </Button>
      </div>
    </div>
  );
}

/* ---------- First-decision countdown ---------- */
function FirstDecisionCountdown({ rate }) {
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon.Clock size={13} className="text-slate-700" />
        <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          First usable receipt
        </span>
      </div>
      <div className="flex items-end gap-2">
        <div className="text-[28px] font-semibold tracking-[-0.02em] text-slate-900 leading-none tabular-nums">
          ~{rate.estimatedHoursToFirstReceipt}h
        </div>
        <div className="text-[12px] text-slate-600 mb-0.5">to go</div>
      </div>
      <p className="mt-2 text-[11px] text-slate-500 leading-[1.5]">
        {LABEL_QUALIFIER.countdown} of {rate.observedFilesPerHour} files / hr.
        Updates as ingestion continues. Model {rate.modelVersion}.
      </p>
    </div>
  );
}

/* ---------- ROI preview side card ---------- */
function RoiPreviewCard({ org, projection, baseline, eligible }) {
  if (!eligible) {
    return (
      <div className="border border-dashed border-slate-300 rounded-[3px] bg-slate-50/40 px-4 py-4">
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1">
          ROI preview
        </div>
        <p className="text-[12px] text-slate-600 leading-[1.55]">
          Set your org profile (Step 1) and baseline (Step 3) to see the projection.
        </p>
      </div>
    );
  }

  const hours = projection.projectedHoursSavedWeek2;
  const wage = org.defaultWageUsd;
  const dollarsK = wage != null ? Math.round((hours * wage) / 100) / 10 : null; // tenths of $K

  return (
    <div className="border border-slate-200 rounded-[3px] bg-white px-4 py-4">
      <div className="flex items-center justify-between mb-2">
        <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
          ROI preview · week 2
        </div>
        <span className="mono text-[10px] text-slate-500">{projection.modelVersion}</span>
      </div>

      {/* Hours line — always rendered */}
      <div className="flex items-end gap-2">
        <div className="text-[28px] font-semibold tracking-[-0.02em] text-slate-900 leading-none tabular-nums">
          ~{hours}h
        </div>
        <div className="text-[12px] text-slate-600 mb-0.5">reviewer-hours saved</div>
      </div>
      <div className="mono text-[10.5px] text-slate-500 mt-1">
        {LABEL_QUALIFIER.hours}
      </div>

      {/* Dollars — gated on wage */}
      {wage != null ? (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-end gap-2">
            <div className="text-[20px] font-semibold tracking-[-0.01em] text-slate-900 leading-none tabular-nums">
              ~${dollarsK}K
            </div>
            <div className="text-[12px] text-slate-600 mb-0.5">at your default wage</div>
          </div>
          <div className="mono text-[10.5px] text-slate-500 mt-1">
            {LABEL_QUALIFIER.dollars} of ${wage}/hr
          </div>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="text-[11.5px] text-slate-600 leading-[1.55]">
            Add a default wage in Step 1 to see dollar equivalents. Hours-only is fine — the math doesn't change.
          </div>
        </div>
      )}

      {baseline && (
        <div className="mt-3 pt-3 border-t border-slate-100 mono text-[10.5px] text-slate-500 leading-[1.5]">
          Comparison vs. your baseline of {baseline.currentTimeToFirstDecisionDays}d.
        </div>
      )}
    </div>
  );
}

/* ---------- Step 4 · Go-Live confirm ---------- */
function GoLiveConfirm({ rate, projection, org, baseline, onGoLive }) {
  const [confirm, setConfirm] = React.useState(false);
  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-12 md:col-span-7 space-y-3">
        <FirstDecisionCountdown rate={rate} />
        <div className="border border-slate-200 rounded-[3px] bg-white p-4">
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">
            What changes when you go live
          </div>
          <ul className="text-[12px] text-slate-700 leading-[1.7] space-y-1 list-disc pl-5">
            <li>Org status flips from <span className="font-medium">Activating</span> to <span className="font-medium">Active</span>.</li>
            <li>Inbox starts staging real intake (sample files stay tagged as samples).</li>
            <li>ROI Console and Monitoring become accessible.</li>
            <li>You can pause activation later from Settings if needed.</li>
          </ul>
          <p className="mt-3 text-[11px] text-slate-500 leading-[1.55]">
            Going live does not claim integration with any HRIS or PSV vendor. If you use one, you can connect it later in Settings.
          </p>
        </div>
        <label className="flex items-start gap-2 text-[12px] text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={confirm}
            onChange={e => setConfirm(e.target.checked)}
            className="mt-0.5 accent-slate-900"
          />
          <span>I understand the countdown is an estimate, not a guarantee, and that ROI numbers are projections subject to volume.</span>
        </label>
      </div>
      <div className="col-span-12 md:col-span-5">
        <RoiPreviewCard org={org} baseline={baseline} projection={projection} eligible />
      </div>
      <div className="col-span-12 flex items-center justify-end pt-2 border-t border-slate-200 mt-1">
        <Button
          variant="primary"
          size="sm"
          disabled={!confirm}
          onClick={onGoLive}
        >
          <Icon.Check size={12} className="mr-1.5" />
          Go live
        </Button>
      </div>
    </div>
  );
}

/* ---------- Post-go-live handoff card ---------- */
function HandoffCard({ org, targets, onNavigate }) {
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white">
      <div className="px-6 py-5 border-b border-slate-200 bg-emerald-50/40">
        <div className="flex items-center gap-2 mb-1">
          <Icon.CheckCircle size={14} className="text-emerald-700" />
          <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-emerald-800">
            Activation complete
          </span>
        </div>
        <h2 className="text-[22px] font-semibold tracking-[-0.015em] text-slate-900 leading-tight">
          {org.displayName || 'Your org'} is now Active.
        </h2>
        <p className="mt-1 text-[12.5px] text-slate-600 leading-[1.55] max-w-[64ch]">
          Sample uploads are staged in the Inbox. You can monitor ingestion in real surfaces below — and report on value as decisions accumulate.
        </p>
      </div>
      <div className="grid grid-cols-2 divide-x divide-slate-100">
        {Object.entries(targets).map(([k, t]) => (
          <button
            key={k}
            type="button"
            onClick={() => onNavigate?.(k)}
            className="text-left px-6 py-5 hover:bg-slate-50/60 transition"
          >
            <div className="flex items-center gap-2 mb-1">
              {k === 'roi' ? <Icon.BarChart size={13} className="text-slate-700" /> : <Icon.Activity size={13} className="text-slate-700" />}
              <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
                {t.sub}
              </span>
            </div>
            <div className="text-[15px] font-semibold text-slate-900 inline-flex items-center gap-2">
              {t.label}
              <Icon.ArrowRight size={13} className="text-slate-500" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

window.StepStatePip = StepStatePip;
window.ActivationStep = ActivationStep;
window.BlockedStepReason = BlockedStepReason;
window.OrgProfileForm = OrgProfileForm;
window.SampleUploadDropzone = SampleUploadDropzone;
window.IngestionProgressTable = IngestionProgressTable;
window.BaselineForm = BaselineForm;
window.FirstDecisionCountdown = FirstDecisionCountdown;
window.RoiPreviewCard = RoiPreviewCard;
window.GoLiveConfirm = GoLiveConfirm;
window.HandoffCard = HandoffCard;
