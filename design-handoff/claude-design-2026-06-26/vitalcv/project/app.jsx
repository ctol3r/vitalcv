// Root app — orchestrates views + transitions + application state

function App() {
  return (
    <ModeProvider>
      <AppInner />
    </ModeProvider>
  );
}

function AppInner() {
  const { mode, setMode, chosen } = useMode();
  const [view, setView] = React.useState(() => {
    try { return localStorage.getItem('vitalcv.view') || 'home'; } catch (_) { return 'home'; }
  });
  const [switchOpen, setSwitchOpen] = React.useState(false);
  const [dark, setDark] = React.useState(() => {
    try { return localStorage.getItem('vitalcv.dark') === '1'; } catch (_) { return false; }
  });
  const [printing, setPrinting] = React.useState(false);
  const [lanes, setLanes] = React.useState(LANES);
  const [resolving, setResolving] = React.useState(false);

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', dark && !printing);
    document.documentElement.classList.toggle('print-mode', printing);
    try { localStorage.setItem('vitalcv.dark', dark ? '1' : '0'); } catch (_) {}
  }, [dark, printing]);

  const toggleDark = () => setDark(d => !d);
  const enterPrint = () => {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrinting(false), 300);
    }, 400);
  };

  // Application state (shared across views)
  const [application, setApplication] = React.useState({
    status: 'draft',           // draft | submitted | viewed | in_review | credentialing | approved | started | waiting_on_clinician
    currentStage: 'submitted', // stage id used to drive timeline
    sealedAt: null,
    snapshotHashFull: null,
    frozenLanes: null,
    requestedLaneIds: [],
    lastRequestAt: null,
    timestamps: {
      submitted: null,
      viewed: null,
      in_review: null,
      credentialing: null,
      approved: null,
      started: null,
    },
  });

  React.useEffect(() => {
    try { localStorage.setItem('vitalcv.view', view); } catch (_) {}
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [view]);

  React.useEffect(() => {
    if (view === 'home') return;
    const t1 = setTimeout(() => {
      setLanes(ls => ls.map(l => l.id === 'sanctions' ? {
        ...l,
        state: 'verified',
        checkedAt: '6s ago',
        summary: 'No exclusions found in LEIE monthly dataset.',
        receipt: 'vc2:oig:0x3f9d…b12a',
        receiptFull: 'vc2:oig:0x3f9d71cb2e40a6f18c4b01d33b12a',
        evidence: [
          ...l.evidence,
          { k: 'Result',   v: 'No match · cleared' },
          { k: 'Checked',  v: '2026-04-18 14:32:13 UTC', mono: true },
        ],
      } : l));
    }, 6000);
    return () => clearTimeout(t1);
  }, [view]);

  const handleResolve = (npi) => {
    setResolving(true);
    setTimeout(() => {
      setResolving(false);
      setView('passport');
    }, 900);
  };

  const handleSubmitApplication = (currentLanes) => {
    const sealedAt = '2026-04-18 14:22 UTC';
    setApplication(app => ({
      ...app,
      status: 'in_review',
      currentStage: 'in_review',
      sealedAt,
      snapshotHashFull: '0x8a41f0b9e2f67d4c1a3e9b0a2c7d2e5f3910ab77c06de91f',
      frozenLanes: currentLanes.map(l => ({ ...l })),
      timestamps: {
        submitted:    '2026-04-18 14:22 UTC',
        viewed:       '2026-04-18 14:24 UTC',
        in_review:    '2026-04-18 14:32 UTC',
        credentialing: null,
        approved: null,
        started: null,
      },
    }));
    // Auto-advance to employer view to show the receiving end
    setTimeout(() => setView('employer'), 300);
  };

  const handleRequestInfo = (laneIds) => {
    setApplication(app => ({
      ...app,
      status: 'waiting_on_clinician',
      requestedLaneIds: laneIds,
      lastRequestAt: '2026-04-18 14:35 UTC',
    }));
  };

  // Mode-aware: if no mode chosen, show the chooser. If user selects a mode,
  // land them on Public Entry inside that mode so the product stays explorable.
  const handleChooseMode = (m) => {
    setMode(m);
    setSwitchOpen(false);
    // Route into a sensible landing view for the chosen mode
    if (m === 'trust') {
      // Trust Mode leads with the Badge artifact (it's what the mode is FOR)
      setView('trust_badge');
    } else {
      // Credentialing Mode leads with the Employer Console / File view
      setView('employer');
    }
  };

  // First-run: no mode chosen → chooser becomes the whole view
  if (!chosen) {
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <TopChromeMinimal />
        <ModeChooser onChoose={handleChooseMode} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <TopChrome view={view} setView={setView} dark={dark} onToggleDark={toggleDark} onPrint={enterPrint} mode={mode} />
      <ModeRibbon onSwitch={() => setSwitchOpen(true)} />
      <ModeSwitchDialog
        open={switchOpen}
        onClose={() => setSwitchOpen(false)}
        onSwitch={handleChooseMode}
        currentMode={mode}
      />

      {printing && (
        <div className="print-header max-w-[1400px] mx-auto px-6">
          <div className="mono text-[10px] uppercase tracking-[0.2em] text-black">VitalCV · Trust Infrastructure</div>
          <div className="text-[22px] font-semibold tracking-tightish text-black mt-1">VITALCV CRYPTOGRAPHIC AUDIT ARTIFACT</div>
          <div className="mono text-[11px] text-black mt-1 tabular-nums">
            Subject: MILLER, MACIE · NPI 1346053246 · Generated 2026-04-18 14:32:51 UTC · Run vc.2026.04.18-a
          </div>
        </div>
      )}

      {resolving && <ResolveOverlay />}

      <main>
        {view === 'home' &&
          <ViewHome onSubmit={handleResolve} />}
        {view === 'passport' &&
          <ViewPassport
            lanes={lanes}
            application={application}
            requestedLaneIds={application.requestedLaneIds}
            onSubmitApplication={handleSubmitApplication}
            onContinue={() => setView('employer')}
          />}
        {view === 'employer' &&
          <ViewEmployer
            lanes={application.status !== 'draft' && application.frozenLanes ? application.frozenLanes : lanes}
            application={application}
            onRequestInfo={handleRequestInfo}
            onAccept={() => setApplication(app => ({
              ...app,
              status: 'approved',
              currentStage: 'approved',
              timestamps: {
                ...app.timestamps,
                credentialing: app.timestamps.credentialing || '2026-04-23 09:10 UTC',
                approved: '2026-04-23 09:14 UTC',
              },
            }))}
            onBack={() => setView('passport')}
          />}
        {view === 'file' &&
          <ViewFile
            lanes={application.status !== 'draft' && application.frozenLanes ? application.frozenLanes : lanes}
          />}
        {view === 'application' &&
          (window.ViewApplicationV2 ? <ViewApplicationV2 /> : <ViewApplication />)}
        {view === 'inbox' &&
          <ViewInbox />}
        {view === 'activation' &&
          (typeof ViewActivationV2 === 'function' ? <ViewActivationV2 /> : <ViewActivation />)}
        {view === 'autopilot' &&
          (typeof ViewAutopilotV2 === 'function' ? <ViewAutopilotV2 /> : <ViewAutopilot />)}
        {view === 'roi' &&
          (typeof ViewROIV2 === 'function' ? <ViewROIV2 /> : <ViewROI />)}
        {view === 'dossier' &&
          <ViewDossier />}
        {view === 'trust_badge' &&
          <ViewTrustBadge
            onUpgrade={() => {
              // Upgrade bridge: carry the user into Credentialing Mode on the file view.
              handleChooseMode('cred');
            }}
          />}
        {view === 'verify' &&
          <ViewVerify />}
        {view === 'mode_chooser' &&
          <ModeChooser onChoose={handleChooseMode} currentMode={mode} />}
      </main>
    </div>
  );
}

// Minimal chrome for the chooser — brandmark only, no tabs (they don't make sense yet)
function TopChromeMinimal() {
  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="bg-slate-900 text-slate-200 text-[11px]">
        <div className="max-w-[1400px] mx-auto px-6 h-7 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="uppercase tracking-[0.14em] text-slate-400 font-medium">Prototype</span>
            <span className="text-slate-500">—</span>
            <span>Walking scenario: <span className="mono text-white">MACIE MILLER, PA-C</span> · NPI <span className="mono text-white">1346053246</span></span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <span>Env: <span className="mono text-slate-200">sandbox</span></span>
            <span className="h-3 w-px bg-slate-700" />
            <span>Build <span className="mono text-slate-200">vc.2026.04.18-a</span></span>
          </div>
        </div>
      </div>
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        <Brandmark />
        <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500">Select a mode to continue</div>
      </div>
    </div>
  );
}

function ResolveOverlay() {
  return (
    <div className="fixed inset-0 z-40 bg-white/85 backdrop-blur-sm flex items-center justify-center">
      <div className="text-center">
        <div className="mono text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-4">Resolving identity</div>
        <div className="flex items-center justify-center gap-2 text-slate-900">
          <span className="h-2 w-2 rounded-full bg-slate-900 pulse-soft" />
          <span className="h-2 w-2 rounded-full bg-slate-900 pulse-soft" style={{ animationDelay: '0.2s' }} />
          <span className="h-2 w-2 rounded-full bg-slate-900 pulse-soft" style={{ animationDelay: '0.4s' }} />
        </div>
        <div className="mt-5 mono text-[11px] text-slate-500">
          NPPES · OIG/LEIE · PECOS · CA State Board
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
