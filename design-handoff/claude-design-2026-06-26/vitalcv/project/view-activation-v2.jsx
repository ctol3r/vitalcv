// VIEW · Wave 21 — Activation Launchpad (Credentialing Mode)
// Employer pilot-onboarding wizard. 4 steps to first usable receipt.
//
// State machine lives in this view; each step's children come from wave21-activation.jsx.

function ViewActivationV2() {
  // Local org + step state. We seed from the fixture so the demo lands somewhere
  // realistic but lets the user click through edits.
  const [org, setOrg] = React.useState(ACTIVATION_ORG);
  const [stepStates, setStepStates] = React.useState({
    'org-profile':     'in-progress',
    'sample-uploads':  'not-started',
    'baseline':        'not-started',
    'go-live':         'not-started',
  });
  const [completedAt, setCompletedAt] = React.useState({});
  const [openStep, setOpenStep] = React.useState('org-profile');
  const [uploads, setUploads] = React.useState(ACTIVATION_SAMPLE_UPLOADS.slice(0, 1));
  const [baseline, setBaseline] = React.useState(null);

  // Step 2 unlocks once Step 1 is complete.
  // Step 3 unlocks once 5+ files are staged.
  // Step 4 unlocks once Step 3 has a baseline.
  const stagedCount = uploads.filter(u => u.state === 'staged-in-inbox').length;

  const lockState = {
    'org-profile':    { locked: false },
    'sample-uploads': {
      locked: stepStates['org-profile'] !== 'complete',
      reason: 'Save your org profile in Step 1 first.'
    },
    'baseline': {
      locked: stagedCount < 5,
      reason: `Need 5 staged samples (currently ${stagedCount}). Add more in Step 2.`
    },
    'go-live': {
      locked: stepStates['baseline'] !== 'complete',
      reason: 'Save your time-to-decision baseline in Step 3 first.'
    },
  };

  const markComplete = (id) => {
    setStepStates(s => ({ ...s, [id]: 'complete' }));
    setCompletedAt(c => ({ ...c, [id]: 'just now' }));
  };

  const handleSaveProfile = (next) => {
    setOrg(o => ({ ...o, ...next }));
    markComplete('org-profile');
    setStepStates(s => ({ ...s, 'sample-uploads': 'in-progress' }));
    setOpenStep('sample-uploads');
  };

  const handleAddDemoFile = () => {
    // Pull next not-yet-shown sample from fixture; cycle around if needed.
    const next = ACTIVATION_SAMPLE_UPLOADS.find(s => !uploads.some(u => u.id === s.id));
    if (next) setUploads(u => [...u, next]);
  };

  const handleRetryUpload = (id) => {
    setUploads(us => us.map(u => u.id === id
      ? { ...u, state: 'parsed', notes: 'Re-uploaded · OCR pass-through · ready for extraction', parsedAt: 'just now' }
      : u));
  };

  // Step 2 auto-completes once stagedCount >= 5
  React.useEffect(() => {
    if (stagedCount >= 5 && stepStates['sample-uploads'] !== 'complete') {
      markComplete('sample-uploads');
      setStepStates(s => ({ ...s, 'baseline': 'in-progress' }));
      setOpenStep('baseline');
    }
  }, [stagedCount]);

  const handleSaveBaseline = (next) => {
    setBaseline(next);
    markComplete('baseline');
    setStepStates(s => ({ ...s, 'go-live': 'in-progress' }));
    setOpenStep('go-live');
  };

  const handleGoLive = () => {
    markComplete('go-live');
    setOrg(o => ({ ...o, state: 'active' }));
  };

  // Progress %
  const total = ACTIVATION_STEPS.length;
  const done = Object.values(stepStates).filter(s => s === 'complete').length;
  const pct = Math.round((done / total) * 100);

  const eligibleForRoiPreview = stepStates['org-profile'] === 'complete' && stepStates['baseline'] === 'complete';

  if (org.state === 'active') {
    return (
      <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
        <ActivationHeader org={org} pct={100} active />
        <HandoffCard
          org={org}
          targets={ACTIVATION_HANDOFF_TARGETS}
          onNavigate={(k) => {
            const route = ACTIVATION_HANDOFF_TARGETS[k]?.route;
            if (route?.startsWith('#/')) window.location.hash = route.slice(1);
          }}
        />
        <div className="text-[11px] text-slate-500 mono">
          Pilot ID {org.pilotId} · Started {org.pilotStartedAt} · Contact {org.pilotContact}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
      <ActivationHeader org={org} pct={pct} />

      <div className="grid grid-cols-12 gap-6">
        {/* Steps column */}
        <div className="col-span-12 lg:col-span-8 space-y-3">
          <ActivationStep
            step={ACTIVATION_STEPS[0]}
            state={stepStates['org-profile']}
            locked={lockState['org-profile'].locked}
            lockedReason={lockState['org-profile'].reason}
            completedAt={completedAt['org-profile']}
            isOpen={openStep === 'org-profile'}
            onActivate={() => setOpenStep(openStep === 'org-profile' ? null : 'org-profile')}
          >
            <OrgProfileForm org={org} onSave={handleSaveProfile} />
          </ActivationStep>

          <ActivationStep
            step={ACTIVATION_STEPS[1]}
            state={stagedCount >= 5 ? 'complete' : stepStates['sample-uploads']}
            locked={lockState['sample-uploads'].locked}
            lockedReason={lockState['sample-uploads'].reason}
            completedAt={completedAt['sample-uploads']}
            isOpen={openStep === 'sample-uploads'}
            onActivate={() => setOpenStep(openStep === 'sample-uploads' ? null : 'sample-uploads')}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
                  Sample target · {stagedCount} of 5 staged
                </div>
                <div className="h-1 w-32 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-600" style={{ width: `${Math.min(100, (stagedCount / 5) * 100)}%` }} />
                </div>
              </div>
              <SampleUploadDropzone onAddDemoFile={handleAddDemoFile} />
              <IngestionProgressTable uploads={uploads} onRetry={handleRetryUpload} />
            </div>
          </ActivationStep>

          <ActivationStep
            step={ACTIVATION_STEPS[2]}
            state={stepStates['baseline']}
            locked={lockState['baseline'].locked}
            lockedReason={lockState['baseline'].reason}
            completedAt={completedAt['baseline']}
            isOpen={openStep === 'baseline'}
            onActivate={() => setOpenStep(openStep === 'baseline' ? null : 'baseline')}
          >
            <BaselineForm baseline={baseline} onSave={handleSaveBaseline} />
          </ActivationStep>

          <ActivationStep
            step={ACTIVATION_STEPS[3]}
            state={stepStates['go-live']}
            locked={lockState['go-live'].locked}
            lockedReason={lockState['go-live'].reason}
            completedAt={completedAt['go-live']}
            isOpen={openStep === 'go-live'}
            onActivate={() => setOpenStep(openStep === 'go-live' ? null : 'go-live')}
          >
            <GoLiveConfirm
              rate={ACTIVATION_INGESTION_RATE}
              projection={ACTIVATION_ROI_PROJECTION}
              org={org}
              baseline={baseline}
              onGoLive={handleGoLive}
            />
          </ActivationStep>
        </div>

        {/* Side rail */}
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <RoiPreviewCard
            org={org}
            baseline={baseline}
            projection={ACTIVATION_ROI_PROJECTION}
            eligible={eligibleForRoiPreview}
          />
          <FirstDecisionCountdown rate={ACTIVATION_INGESTION_RATE} />
          <div className="border border-slate-200 rounded-[3px] bg-white px-4 py-3 text-[11.5px] text-slate-600 leading-[1.55]">
            <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1">
              About this surface
            </div>
            <p>
              The Launchpad is a wizard, not an integration. We don't claim a connection to any HRIS or PSV vendor here. After Go-live, real intake begins in the Inbox.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ActivationHeader({ org, pct, active }) {
  return (
    <div className="border border-slate-200 rounded-[3px] bg-white px-6 py-5">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1">
            Activation Launchpad · Wave 21 · Pilot {org.pilotId}
          </div>
          <h1 className="text-[26px] font-semibold tracking-[-0.018em] text-slate-900 leading-tight">
            {active ? 'Pilot active.' : 'Get to your first usable receipt.'}
          </h1>
          <p className="mt-1 text-[12.5px] text-slate-600 leading-[1.55] max-w-[68ch]">
            {active
              ? 'Your org is live. Sample bundles are staged in the Inbox; ROI Console and Monitoring are now accessible.'
              : 'Four short steps. Each step gates the next so estimates stay honest. We never promise a time-to-decision — only an estimated time-to-first-receipt based on the current ingestion rate.'}
          </p>
        </div>
        <div className="flex-shrink-0 min-w-[200px]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">Progress</span>
            <span className="mono text-[11px] tabular-nums text-slate-700">{pct}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={cn('h-full', active ? 'bg-emerald-600' : 'bg-slate-900')} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

window.ViewActivationV2 = ViewActivationV2;
