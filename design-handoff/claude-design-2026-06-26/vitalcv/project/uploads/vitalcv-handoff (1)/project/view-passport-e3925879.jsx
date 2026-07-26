// VIEW 2 — Clinician Passport (Readiness Snapshot + Active Application)

function ViewPassport({ onContinue, lanes, application, onSubmitApplication, requestedLaneIds = [] }) {
  const [expanded, setExpanded] = React.useState('identity');
  const [submitting, setSubmitting] = React.useState(false);

  const frozen = application.status !== 'draft';
  const snapshotLanes = frozen ? application.frozenLanes : lanes;

  const handleSubmit = () => {
    setSubmitting(true);
    setTimeout(() => {
      onSubmitApplication(lanes);
      setSubmitting(false);
    }, 1400);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-10">
      {/* Identity header */}
      <div className="grid grid-cols-12 gap-6 mb-8">
        <div className="col-span-12 lg:col-span-8">
          <div className="mono text-[10.5px] uppercase tracking-[0.16em] text-slate-500 mb-2">Clinician Passport</div>
          <div className="flex items-end gap-5 flex-wrap">
            <Avatar initials={PROVIDER.initials} />
            <div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <h1 className="text-[34px] font-semibold tracking-[-0.02em] text-slate-900 leading-none">
                  {PROVIDER.fullName}
                </h1>
                <span className="mono text-[13px] text-slate-500 uppercase tracking-[0.1em]">{PROVIDER.credential}</span>
              </div>
              <div className="mt-2 flex items-center flex-wrap gap-x-5 gap-y-1 text-[13px] text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Icon.User size={13} className="text-slate-400" />
                  {PROVIDER.role}
                </span>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon.Hash size={13} className="text-slate-400" />
                  <span>NPI</span>
                  <span className="mono text-[13px] text-slate-900">{PROVIDER.npi}</span>
                </span>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon.Calendar size={13} className="text-slate-400" />
                  <span>Enumerated {PROVIDER.enumeratedDate}</span>
                </span>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon.MapPin size={13} className="text-slate-400" />
                  {PROVIDER.city}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-12 lg:col-span-4 flex lg:justify-end items-start gap-2">
          <Button variant="outline" size="sm" iconLeft={<Icon.Link size={14} />}>Share link</Button>
          <Button variant="outline" size="sm" iconLeft={<Icon.Download size={14} />}>Provisional snapshot</Button>
        </div>
      </div>

      {/* Global readiness banner */}
      <ReadinessBanner lanes={lanes} />

      {/* Enriched identity profile */}
      <div className="mt-8">
        <IdentityFieldsCard
          fields={IDENTITY_FIELDS}
          title="Enriched profile · Confidence Doctrine"
          note="Only Verified fields are primary-source checked. Inferred fields come from AI-extracted documents — never treated as credentialing truth."
        />
      </div>

      {/* Accepted-by-employer state — shown when application reaches terminal acceptance */}
      {(application.status === 'approved' || application.status === 'credentialing') && (
        <div className="mt-8">
          <AcceptedByEmployerCard receipt={ACCEPTANCE_RECEIPT} employerName={EMPLOYER.name} />
        </div>
      )}

      {/* ======= Active Application block (replaces old Target Employer) ======= */}
      <div className="mt-8">
        <ActiveApplication
          application={application}
          lanes={lanes}
          onSubmit={handleSubmit}
          submitting={submitting}
          requestedLaneIds={requestedLaneIds}
        />
      </div>

      {/* Source lanes + sidebar */}
      <div className="grid grid-cols-12 gap-6 mt-10">
        <div className="col-span-12 lg:col-span-8">
          <SectionHeader
            eyebrow={frozen ? 'Frozen snapshot · source lanes' : 'Source lanes · live'}
            title={frozen ? 'What the employer will see in this packet' : 'What each authority says, right now'}
            right={
              <div className="flex items-center gap-2 text-[11.5px] text-slate-500">
                {frozen ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Icon.Lock size={12} className="text-slate-500" />
                    <span>Sealed <span className="mono text-slate-700">{application.sealedAt}</span></span>
                  </span>
                ) : (
                  <>
                    <Icon.Info size={13} className="text-slate-400" />
                    <span>Unknown is not negative — missing data means <span className="mono text-slate-700">not yet checked</span>.</span>
                  </>
                )}
              </div>
            }
          />
          <div className={cn('divide-y divide-slate-200 border border-slate-200 rounded-md overflow-hidden bg-white',
            frozen && 'ring-1 ring-inset ring-slate-200')}>
            {snapshotLanes.map(lane => (
              <LaneRow
                key={lane.id}
                lane={lane}
                expanded={expanded === lane.id}
                onToggle={() => setExpanded(expanded === lane.id ? null : lane.id)}
                mode="clinician"
              />
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3 text-[11.5px] text-slate-500">
            <Legend state="verified" label="Checked against source of truth" />
            <Legend state="pending"  label="Query in flight — will auto-update" />
            <Legend state="access"   label="Employer must invoke gated feed" />
            <Legend state="blocked"  label="Reserved for OIG exclusion / revoked license" />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="col-span-12 lg:col-span-4 space-y-5">
          {/* Acceptance-readiness summary — shows the clinician exactly what an employer will require */}
          <RequirementsSummary gate={evaluateAcceptance(snapshotLanes)} />

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Icon.Badge size={15} className="text-slate-700" />
              <div className="text-[13px] font-semibold text-slate-900">Your passport, explained</div>
            </div>
            <p className="text-[12.5px] leading-[1.55] text-slate-600">
              This is not a score. It's a <span className="text-slate-900 font-medium">provenance map</span> of
              what federal and state sources say about you, right now. You control who sees it and for how long.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <MiniStat icon={Icon.CheckCircle} tone="emerald" k="Sources verified" v={`${lanes.filter(l=>l.state==='verified').length} of ${lanes.length}`} />
              <MiniStat icon={Icon.Clock}       tone="amber"   k="Checks in flight" v={`${lanes.filter(l=>l.state==='pending').length}`} />
              <MiniStat icon={Icon.Lock}        tone="indigo"  k="Needs employer access" v={`${lanes.filter(l=>l.state==='access').length}`} />
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Icon.Stamp size={15} className="text-slate-700" />
              <div className="text-[13px] font-semibold text-slate-900">Cryptographic receipt</div>
            </div>
            <p className="text-[12.5px] text-slate-600 leading-[1.55]">Every check is stamped. A verifier can replay it without trusting VitalCV.</p>
            <div className="mt-3 bg-slate-50 border border-slate-200 rounded p-3">
              <div className="mono text-[10.5px] text-slate-400 uppercase tracking-[0.12em] mb-1">{frozen ? 'Application snapshot hash' : 'Snapshot hash'}</div>
              <div className="mono text-[11.5px] text-slate-900 break-all">{application.snapshotHashFull || '0x8a41f0b9e2f67d4c1a3e9b0a2c7d2'}</div>
            </div>
            <button className="mt-3 text-[11.5px] text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5">
              <Icon.Copy size={12} /> Copy receipt
            </button>
          </Card>

          <CareerAutopilot />
        </aside>
      </div>

      {/* Bottom action bar — only when draft */}
      {!frozen && (
        <div className="mt-10 border border-slate-200 rounded-md bg-white p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-[13px] font-semibold text-slate-900">Ready to preview the employer view?</div>
            <div className="text-[12px] text-slate-500 mt-0.5">
              Jump to the review console to see how your packet will read on the other side.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" iconLeft={<Icon.Download size={14} />}>
              Download Provisional Snapshot
            </Button>
            <Button variant="primary" iconRight={<Icon.ArrowRight size={14} />} onClick={onContinue}>
              Continue to Employer Review
            </Button>
          </div>
        </div>
      )}

      {/* Submission overlay */}
      {submitting && <SubmittingOverlay />}
    </div>
  );
}

/* ---------- Active Application block ---------- */
function ActiveApplication({ application, lanes, onSubmit, submitting, requestedLaneIds }) {
  const frozen = application.status !== 'draft';
  const verifiedN = lanes.filter(l => l.state === 'verified').length;
  const pendingN  = lanes.filter(l => l.state === 'pending').length;
  const accessN   = lanes.filter(l => l.state === 'access').length;

  return (
    <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
        <div className="flex items-center gap-2">
          <Icon.Building size={14} className="text-slate-700" />
          <div className="text-[13px] font-semibold text-slate-900">
            {frozen ? 'Active application' : 'Target employer'}
          </div>
          {frozen && <Chip state={applicationChipState(application.status)} size="sm">{applicationChipLabel(application.status)}</Chip>}
        </div>
        <div className="mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500">
          Req <span className="text-slate-900">{EMPLOYER.reqId}</span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-0">
        {/* Left: employer identity */}
        <div className="col-span-12 md:col-span-5 p-5 border-b md:border-b-0 md:border-r border-slate-200">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center">
              <Icon.ShieldCheck size={16} className="text-slate-700" />
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-slate-900 leading-tight">{EMPLOYER.name}</div>
              <div className="text-[12px] text-slate-500 mt-0.5">{EMPLOYER.legal}</div>
            </div>
          </div>
          <dl className="mt-4 border-t border-slate-100 pt-3 space-y-1.5">
            <AppKV k="Role"     v={EMPLOYER.role} />
            <AppKV k="Location" v={EMPLOYER.location} />
            <AppKV k="Contact"  v={EMPLOYER.contact} />
            {frozen && <AppKV k="Submitted" v={application.sealedAt} mono />}
          </dl>
        </div>

        {/* Right: immutability + CTA */}
        <div className="col-span-12 md:col-span-7 p-5">
          {!frozen ? (
            <>
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-md flex items-center justify-center bg-slate-100 border border-slate-200 flex-shrink-0">
                  <Icon.Stamp size={13} className="text-slate-700" />
                </div>
                <div>
                  <div className="text-[13.5px] font-semibold text-slate-900">Submit will freeze this packet</div>
                  <p className="text-[12.5px] text-slate-600 leading-[1.55] mt-1">
                    Your current source-backed state is bundled into a <span className="mono text-slate-900">cryptographically-bound</span> snapshot and delivered to {EMPLOYER.name}.
                    The employer sees exactly this evidence — nothing more, nothing less. Live checks on your passport
                    continue independently.
                  </p>
                </div>
              </div>

              {/* Freeze preview */}
              <div className="mt-4 grid grid-cols-3 gap-px bg-slate-200 border border-slate-200 rounded-md overflow-hidden">
                <FreezeCell label="Verified"  value={verifiedN} tone="emerald" />
                <FreezeCell label="Pending"   value={pendingN}  tone="amber" />
                <FreezeCell label="Gated"     value={accessN}   tone="indigo" />
              </div>

              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="text-[11.5px] text-slate-500">
                  By submitting you authorize {EMPLOYER.name} to query gated sources on your behalf.
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={onSubmit}
                  disabled={submitting}
                  iconRight={<Icon.ArrowRight size={14} />}
                >
                  Submit Application Snapshot
                </Button>
              </div>
            </>
          ) : (
            <FrozenApplicationPanel application={application} requestedLaneIds={requestedLaneIds} />
          )}
        </div>
      </div>
    </div>
  );
}

function FrozenApplicationPanel({ application, requestedLaneIds }) {
  const waiting = application.status === 'waiting_on_clinician';
  return (
    <>
      <div className="flex items-start gap-3">
        <div className={cn('h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 ring-1 ring-inset',
          waiting ? 'bg-amber-50 text-amber-700 ring-amber-600/20' : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20')}>
          {waiting ? <Icon.Clock size={13} strokeWidth={2.25} /> : <Icon.CheckCircle size={13} strokeWidth={2.25} />}
        </div>
        <div>
          <div className="text-[13.5px] font-semibold text-slate-900">
            {waiting ? `${EMPLOYER.name} requested additional info` : `Snapshot transmitted to ${EMPLOYER.name}`}
          </div>
          <p className="text-[12.5px] text-slate-600 leading-[1.55] mt-1">
            {waiting
              ? 'The credentialing reviewer has flagged specific trust lanes that need your attention. Complete these items below — your snapshot will re-seal automatically.'
              : 'Your application is sealed and en route. The reviewer will progress it through the lifecycle and may request additional info if needed.'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-px bg-slate-200 border border-slate-200 rounded-md overflow-hidden">
        <FreezeCell label="Submitted"     value={application.sealedAt} mono tone="slate" />
        <FreezeCell label="Current stage" value={stageLabel(application.currentStage)} tone="slate" />
      </div>

      {waiting && requestedLaneIds.length > 0 && (
        <div className="mt-4 border border-amber-200 bg-amber-50 rounded-md p-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-amber-800">Action required · {requestedLaneIds.length} item{requestedLaneIds.length !== 1 && 's'}</div>
            <span className="mono text-[10.5px] text-amber-700">{application.lastRequestAt}</span>
          </div>
          <ul className="space-y-1.5">
            {requestedLaneIds.map(id => {
              const lane = REQUESTABLE_LANES.find(l => l.id === id);
              if (!lane) return null;
              return (
                <li key={id} className="flex items-start gap-2 text-[12.5px]">
                  <Icon.ArrowRight size={12} className="text-amber-700 mt-1" />
                  <div>
                    <span className="text-slate-900 font-medium">{lane.label}</span>
                    <span className="text-slate-600"> — {lane.hint}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" variant="primary">Respond to request</Button>
            <Button size="sm" variant="ghost">View details</Button>
          </div>
        </div>
      )}
    </>
  );
}

function FreezeCell({ label, value, tone, mono }) {
  const tones = {
    emerald: 'text-emerald-700',
    amber:   'text-amber-700',
    indigo:  'text-indigo-700',
    slate:   'text-slate-900',
  };
  return (
    <div className="bg-white p-3">
      <div className="mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className={cn('mt-1 text-[15px] font-semibold tracking-tightish', mono && 'mono text-[13px] font-medium', tones[tone] || 'text-slate-900')}>
        {value}
      </div>
    </div>
  );
}

function AppKV({ k, v, mono }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="mono text-[10.5px] uppercase tracking-[0.1em] text-slate-500 whitespace-nowrap">{k}</dt>
      <dd className={cn('text-[12.5px] text-slate-900 text-right truncate', mono && 'mono text-[11.5px]')}>{v}</dd>
    </div>
  );
}

function applicationChipState(status) {
  if (status === 'submitted' || status === 'viewed' || status === 'in_review') return 'pending';
  if (status === 'waiting_on_clinician') return 'access';
  if (status === 'approved' || status === 'started') return 'verified';
  return 'pending';
}
function applicationChipLabel(status) {
  return {
    submitted: 'Submitted',
    viewed: 'Viewed',
    in_review: 'In Review',
    credentialing: 'Credentialing',
    approved: 'Approved',
    started: 'Started',
    waiting_on_clinician: 'Action Required',
  }[status] || 'Active';
}
function stageLabel(id) {
  return (LIFECYCLE_STAGES.find(s => s.id === id) || {}).label || id;
}

/* ---------- Submitting overlay ---------- */
function SubmittingOverlay() {
  const [phase, setPhase] = React.useState(0);
  const phases = [
    'Freezing source evidence…',
    'Computing Merkle root of packet…',
    'Signing with your passport key…',
    'Transmitting to Cedar Health…',
  ];
  React.useEffect(() => {
    const t = setInterval(() => setPhase(p => Math.min(p + 1, phases.length - 1)), 320);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="fixed inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center">
      <div className="border border-slate-200 rounded-md bg-white p-7 w-[460px] text-center">
        <div className="mono text-[10.5px] uppercase tracking-[0.18em] text-slate-500 mb-3">Submitting</div>
        <div className="text-[18px] font-semibold text-slate-900 tracking-tightish">
          Application Snapshot generated and<br />cryptographically bound.
        </div>
        <div className="text-[12.5px] text-slate-600 mt-2">Transmitting to {EMPLOYER.name}.</div>

        <div className="mt-5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-slate-900 transition-all" style={{ width: `${((phase + 1) / phases.length) * 100}%` }} />
        </div>
        <div className="mono text-[11px] text-slate-500 mt-3 h-4">{phases[phase]}</div>
      </div>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function Avatar({ initials }) {
  return (
    <div className="h-14 w-14 rounded-md bg-slate-900 text-white flex items-center justify-center font-semibold text-[18px] tracking-tight">
      {initials}
    </div>
  );
}

function ReadinessBanner({ lanes }) {
  const verified = lanes.filter(l => l.state === 'verified').length;
  const total = lanes.length;
  return (
    <div className="border border-slate-200 rounded-md overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-stretch">
        <div className="flex-1 p-5 bg-white">
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">Readiness</div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <div className="text-[26px] font-semibold text-slate-900 tracking-tightish leading-none">Conditional Ready</div>
            <Chip state="pending" size="md">In progress</Chip>
          </div>
          <p className="mt-3 text-[13px] text-slate-600 max-w-[640px] leading-[1.55]">
            Identity confirmed via federal registry. Other checks are in progress or require institutional access.
            <span className="text-slate-500"> No blocking sanctions detected.</span>
          </p>
        </div>
        <div className="md:w-[380px] bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">Source coverage</div>
            <div className="mono text-[11px] text-slate-700">{verified}/{total}</div>
          </div>
          <LaneBar lanes={lanes} />
          <div className="mt-3 flex items-center justify-between text-[11.5px] text-slate-500">
            <span>Run started {NOW_LABEL.toLowerCase()}</span>
            <span>Auto-refresh <span className="mono text-slate-700">ON</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LaneBar({ lanes }) {
  return (
    <div className="flex items-center gap-1 h-2.5">
      {lanes.map((l, i) => {
        const m = STATE_META[l.state];
        return (
          <div key={i} className="flex-1 h-full rounded-sm overflow-hidden bg-slate-200 relative">
            <div className={cn('absolute inset-0', m.bar, l.state === 'pending' && 'opacity-70')} />
            {l.state === 'pending' && <div className="shimmer absolute inset-0" />}
          </div>
        );
      })}
    </div>
  );
}

function MiniStat({ icon: I, tone, k, v }) {
  const tones = {
    emerald: 'text-emerald-700',
    amber:   'text-amber-700',
    indigo:  'text-indigo-700',
    slate:   'text-slate-600',
  };
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-2 text-[12px] text-slate-600">
        <I size={13} className={tones[tone]} />
        {k}
      </span>
      <span className="mono text-[12px] text-slate-900">{v}</span>
    </div>
  );
}

function Legend({ state, label }) {
  const m = STATE_META[state];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-full', m.dot)} />
      <span className="text-slate-600">{label}</span>
    </span>
  );
}

/* ---------- Shared lane row (used by both passport + employer) ---------- */
function LaneRow({ lane, expanded, onToggle, mode = 'clinician' }) {
  const m = STATE_META[lane.state];
  return (
    <div className={cn('bg-white', expanded && 'bg-slate-50/40')}>
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-center gap-5 hover:bg-slate-50/60 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-[240px]">
          <div className={cn('h-9 w-9 rounded-md flex items-center justify-center ring-1 ring-inset', m.chip)}>
            <m.Icon size={16} strokeWidth={2.25} />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-slate-900 leading-tight">{lane.label}</div>
            <div className="mono text-[11px] text-slate-500 uppercase tracking-[0.08em] mt-0.5">{lane.source}</div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-slate-700 truncate">{lane.summary}</div>
          <div className="mono text-[11px] text-slate-400 mt-0.5 uppercase tracking-[0.08em] truncate">{lane.authority}</div>
        </div>

        <div className="flex items-center gap-5 flex-shrink-0">
          {mode === 'employer' && (
            <div className="hidden lg:block">
              <NCQATag laneId={lane.id} />
            </div>
          )}
          {mode === 'employer' && lane.receipt && (
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="mono text-[10px] text-slate-400 uppercase tracking-[0.1em]">Receipt</span>
              <span className="mono text-[11px] text-slate-700">{lane.receipt}</span>
            </div>
          )}
          <div className="hidden xl:flex flex-col items-end gap-1">
            <TrustTierBadge tier={(LANE_AUTHORITY[lane.id] && LANE_AUTHORITY[lane.id].tier) || 'T1'} />
            <DelegationBadge laneId={lane.id} compact />
          </div>
          <div className="flex flex-col items-end text-right min-w-[120px]">
            <Chip state={lane.state}>{lane.state === 'verified' ? 'Checked' : lane.state === 'pending' ? 'Pending' : lane.state === 'access' ? 'Access Required' : STATE_META[lane.state].label}</Chip>
            <span className="mono text-[11px] text-slate-400 mt-1 tabular-nums">{lane.checkedAt}</span>
            <FreshnessIndicator laneId={lane.id} state={lane.state} />
          </div>
          <Icon.ChevronDown
            size={16}
            className={cn('text-slate-400 transition-transform', expanded && 'rotate-180')}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 pt-1">
          {lane.state === 'contradicted' && lane.conflict && (
            <div className="mb-4">
              <ConflictResolution conflict={lane.conflict} />
            </div>
          )}

          {mode === 'employer' && lane.id === 'identity' && (
            <div className="mb-4">
              <ReceiptDrawer lane={lane} />
            </div>
          )}

          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-7">
              <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">Evidence</div>
              <div className="border border-slate-200 rounded-md bg-white">
                {lane.evidence.map((e, i) => (
                  <KV key={i} k={e.k} v={e.v} mono={e.mono} className="px-4" />
                ))}
              </div>
            </div>
            <div className="col-span-12 md:col-span-5">
              <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">Provenance</div>
              <div className="border border-slate-200 rounded-md bg-white p-4 text-[12.5px] text-slate-600 leading-[1.55]">
                <div className="flex items-center gap-2 mb-2">
                  <Icon.ShieldCheck size={14} className="text-slate-500" />
                  <span className="text-slate-900 font-medium">{lane.authority}</span>
                </div>
                <p>{lane.sourceLong}.</p>
                {lane.receipt ? (
                  <div className="mt-3 bg-slate-50 border border-slate-200 rounded p-2.5">
                    <div className="mono text-[10.5px] text-slate-400 uppercase tracking-[0.1em] mb-0.5">Receipt</div>
                    <div className="mono text-[11px] text-slate-900 break-all">{lane.receiptFull || lane.receipt}</div>
                  </div>
                ) : lane.state === 'pending' ? (
                  <div className="mt-3 flex items-center gap-2 text-amber-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 pulse-soft" />
                    <span className="mono text-[11px] uppercase tracking-[0.1em]">Check in flight · receipt pending</span>
                  </div>
                ) : lane.state === 'access' ? (
                  <div className="mt-3 flex items-center gap-2 text-indigo-700">
                    <Icon.Lock size={12} />
                    <span className="mono text-[11px] uppercase tracking-[0.1em]">Receipt issued on employer invocation</span>
                  </div>
                ) : null}
                <a href="#" className="mt-3 inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-[11.5px]">
                  <Icon.ExternalLink size={12} />
                  <span>Open authoritative source</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.ViewPassport = ViewPassport;
window.LaneRow = LaneRow;

/* ---------- Cryptographic Receipt drawer (brutalist mono) ---------- */
function ReceiptDrawer({ lane }) {
  return (
    <div className="border border-slate-300 rounded-md overflow-hidden bg-slate-900 text-slate-100">
      <div className="px-4 py-2 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Stamp size={12} className="text-slate-300" />
          <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-300">Cryptographic receipt · {lane.source}</span>
        </div>
        <span className="mono text-[10px] uppercase tracking-[0.12em] text-emerald-400">replayable</span>
      </div>
      <div className="px-4 py-3 mono text-[11.5px] leading-[1.75]">
        <ReceiptLine k="Source"          v="U.S. Centers for Medicare & Medicaid Services" />
        <ReceiptLine k="Dataset"         v="NPPES · Type 1 · Individual" />
        <ReceiptLine k="Observed_At"     v="2026-04-18T14:22:01Z" />
        <ReceiptLine k="Parser_Version"  v="v2.1.4" />
        <ReceiptLine k="Payload_Hash"    v="0x8a41f0b9e2f67d4c1a3e9b0a2c7d2..." />
        <ReceiptLine k="Signature_Alg"   v="ed25519 · org-key:vitalcv/prod/2026" />
        <ReceiptLine k="Merkle_Root"     v="0x7d1fa9c3...e04b" />
      </div>
      <div className="px-4 py-2.5 border-t border-slate-700 flex items-center justify-between bg-black/30">
        <span className="mono text-[10.5px] text-slate-400">Anyone with the receipt can replay this verification without trusting VitalCV.</span>
        <div className="flex items-center gap-2">
          <button className="text-[11px] text-slate-300 hover:text-white mono uppercase tracking-[0.1em] px-2 h-7 border border-slate-700 rounded">
            View Raw JSON Artifact
          </button>
          <button className="text-[11px] text-slate-300 hover:text-white inline-flex items-center gap-1 px-2 h-7 border border-slate-700 rounded">
            <Icon.Copy size={11} /> <span className="mono uppercase tracking-[0.1em]">Copy hash</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiptLine({ k, v }) {
  return (
    <div className="flex gap-3">
      <span className="text-slate-400 w-[130px] shrink-0">{k}:</span>
      <span className="text-slate-100 break-all">{v}</span>
    </div>
  );
}

window.ReceiptDrawer = ReceiptDrawer;
