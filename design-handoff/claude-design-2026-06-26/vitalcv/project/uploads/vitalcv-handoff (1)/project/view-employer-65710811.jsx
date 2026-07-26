// VIEW 3 — Employer Review Console (Decision Surface)

function ViewEmployer({ lanes, onBack, application, onRequestInfo, onAccept }) {
  const [expanded, setExpanded] = React.useState('identity');
  const [decision, setDecision] = React.useState(null); // 'accept' | 'refresh' | 'reject'
  const [refreshing, setRefreshing] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [diffOpen, setDiffOpen] = React.useState(false);
  const checklistRef = React.useRef(null);
  const gate = React.useMemo(() => evaluateAcceptance(lanes), [lanes]);
  const scrollToChecklist = () => {
    const el = checklistRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const top = rect.top + window.pageYOffset - 24;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  const verified = lanes.filter(l => l.state === 'verified').length;
  const pending  = lanes.filter(l => l.state === 'pending').length;
  const access   = lanes.filter(l => l.state === 'access').length;
  const blocked  = lanes.filter(l => l.state === 'blocked').length;

  const waiting = application.status === 'waiting_on_clinician';

  const blockers = [
    { icon: Icon.Clock, tone: 'amber',  title: 'Sanctions verification pending',  sub: 'OIG/LEIE scan in flight · expected < 1 min',                actionLabel: 'Re-run now' },
    { icon: Icon.Clock, tone: 'amber',  title: 'Medicare enrollment pending',     sub: 'PECOS scan in flight · expected < 1 min',                   actionLabel: 'Re-run now' },
    { icon: Icon.Lock,  tone: 'indigo', title: 'Licensure requires board access', sub: 'CA Physician Assistant Board · authenticated PSV required', actionLabel: 'Invoke PSV' },
  ];

  const doRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setDiffOpen(true);
    }, 1400);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 pb-[150px]">
      {/* Acceptance banner — the "system of record" moment */}
      {decision === 'accept' && (
        <AcceptanceBanner receipt={ACCEPTANCE_RECEIPT} />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[11.5px] text-slate-500 mb-5">
        <button onClick={onBack} className="hover:text-slate-900 inline-flex items-center gap-1.5">
          <Icon.Building size={12} /> Credentialing queue
        </button>
        <Icon.ChevronRight size={12} />
        <span className="text-slate-700">Open applicants</span>
        <Icon.ChevronRight size={12} />
        <span className="mono text-slate-900">MILLER, MACIE · {PROVIDER.npi}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-6 flex-wrap mb-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-md bg-slate-900 text-white flex items-center justify-center font-semibold text-[15px]">
            {PROVIDER.initials}
          </div>
          <div>
            <div className="mono text-[10.5px] uppercase tracking-[0.16em] text-slate-500 mb-1">Applicant · Req {EMPLOYER.reqId}</div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="text-[26px] font-semibold tracking-tightish text-slate-900 leading-none">
                Macie Miller, PA-C
              </h1>
              {waiting
                ? <Chip state="access" size="md">Waiting on Clinician</Chip>
                : <Chip state="pending" size="md">In Review</Chip>}
            </div>
            <div className="mt-2 flex items-center flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-slate-600">
              <span className="mono text-slate-900">NPI {PROVIDER.npi}</span>
              <span className="text-slate-300">·</span>
              <span>{PROVIDER.taxonomy}</span>
              <span className="text-slate-300">·</span>
              <span>Packet submitted <span className="mono text-slate-700">{application.sealedAt}</span></span>
              <span className="text-slate-300">·</span>
              <span>Reviewer: <span className="text-slate-900">J. Okafor</span> · Cedar Health</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" iconLeft={<Icon.Copy size={13} />}>Copy applicant link</Button>
          <Button size="sm" variant="outline" iconLeft={<Icon.FileText size={13} />}>Export audit bundle</Button>
        </div>
      </div>

      {/* Lifecycle Timeline */}
      <div className="mb-6">
        <LifecycleTimeline
          stages={LIFECYCLE_STAGES.map(s => ({
            ...s,
            at: application.timestamps[s.id] || s.at,
          }))}
          currentId={application.currentStage}
          waitingOnClinician={waiting}
          waitingLanes={application.requestedLaneIds}
        />
      </div>

      {/* Enriched identity profile */}
      <div className="mb-6">
        <IdentityFieldsCard
          fields={IDENTITY_FIELDS_EMPLOYER}
          title="Applicant profile · Confidence Doctrine"
          note="Inferred = AI-extracted from clinician documents. Never treat as verified. Contradicted = two sources disagree; see Evidence → Current Employer."
        />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-md overflow-hidden mb-8">
        <KPI label="Verified sources"   value={`${verified}/${lanes.length}`} tone="emerald" sub="Federal registries confirmed" />
        <KPI label="Open checks"        value={pending}                       tone="amber"   sub="Will auto-resolve · ≤ 1 min ETA" />
        <KPI label="Access required"    value={access}                        tone="indigo"  sub="Needs employer invocation" />
        <KPI label="Blockers"           value={blocked}                       tone="slate"   sub="No OIG exclusions · no revocations" zero />
      </div>

      {/* Acceptance Gate — enforces published ruleset before decision */}
      {decision !== 'accept' && (
        <AcceptanceGateBanner
          gate={gate}
          onScrollToChecklist={scrollToChecklist}
        />
      )}

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-8 space-y-8">

          {/* Velocity Metrics */}
          <VelocityMetrics saved={45} estimateLow={14} estimateHigh={21} industry={90} />

          {/* Evidence Table */}
          <section>
            <SectionHeader
              eyebrow="Evidence · source-backed"
              title="Verification lanes"
              right={
                <div className="flex items-center gap-2">
                  <button
                    onClick={doRefresh}
                    className={cn(
                      'inline-flex items-center gap-1.5 text-[11.5px] text-slate-600 hover:text-slate-900',
                      refreshing && 'text-slate-400 cursor-wait'
                    )}
                  >
                    <Icon.Refresh size={12} className={refreshing ? 'animate-spin' : ''} />
                    <span>{refreshing ? 'Re-running…' : 'Re-run pending'}</span>
                  </button>
                  <span className="h-3 w-px bg-slate-200" />
                  <span className="mono text-[10.5px] uppercase tracking-[0.12em] text-slate-400">Run {NOW_LABEL.toLowerCase()}</span>
                </div>
              }
            />
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-md overflow-hidden bg-white">
              {lanes.map(lane => (
                <LaneRow
                  key={lane.id}
                  lane={lane}
                  expanded={expanded === lane.id}
                  onToggle={() => setExpanded(expanded === lane.id ? null : lane.id)}
                  mode="employer"
                />
              ))}
            </div>
            <div className="mt-2 px-1 text-[10.5px] text-slate-500 leading-snug">
              This output aligns with primary source verification requirements for initial screening but does not replace full committee credentialing.
            </div>
          </section>

          {/* Event log */}
          <MonitoringFeed />

          {/* Event log */}
          <section>
            <SectionHeader
              eyebrow="Run log · last 60 seconds"
              title="Audit trail"
              right={<span className="mono text-[10.5px] uppercase tracking-[0.12em] text-slate-400">{EVENTS.length} events</span>}
            />
            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 grid grid-cols-12 gap-3 mono text-[10.5px] uppercase tracking-[0.1em] text-slate-500">
                <div className="col-span-2">Time</div>
                <div className="col-span-2">Source</div>
                <div className="col-span-7">Event</div>
                <div className="col-span-1 text-right">State</div>
              </div>
              <div className="divide-y divide-slate-100">
                {EVENTS.map((e, i) => {
                  const m = STATE_META[e.state] || STATE_META.info;
                  return (
                    <div key={i} className="px-4 py-2.5 grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-2 mono text-[11.5px] text-slate-500">{e.t}</div>
                      <div className="col-span-2 mono text-[11px] text-slate-700 uppercase tracking-[0.08em]">{e.src}</div>
                      <div className="col-span-7 text-[12.5px] text-slate-700">{e.msg}</div>
                      <div className="col-span-1 flex justify-end">
                        <span className={cn('h-2 w-2 rounded-full', m.dot, e.state === 'pending' && 'pulse-soft')} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>
        </div>

        {/* Side rails */}
        <aside className="col-span-12 xl:col-span-4 space-y-6">
          {/* Blocker Summary */}
          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon.AlertTri size={14} className="text-amber-600" />
                <div className="text-[13px] font-semibold text-slate-900">What's slowing this down?</div>
              </div>
              <span className="mono text-[10.5px] uppercase tracking-[0.12em] text-slate-400">3 items</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {blockers.map((b, i) => {
                const tones = {
                  amber: 'text-amber-600 bg-amber-50 ring-amber-600/20',
                  indigo: 'text-indigo-600 bg-indigo-50 ring-indigo-600/20',
                };
                return (
                  <li key={i} className="px-5 py-3.5 flex items-start gap-3">
                    <div className={cn('h-7 w-7 rounded-md flex items-center justify-center ring-1 ring-inset flex-shrink-0', tones[b.tone])}>
                      <b.icon size={13} strokeWidth={2.25} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-slate-900 font-medium leading-snug">{b.title}</div>
                      <div className="text-[11.5px] text-slate-500 mt-0.5">{b.sub}</div>
                    </div>
                    <button className="text-[11.5px] text-slate-600 hover:text-slate-900 whitespace-nowrap mt-0.5">
                      {b.actionLabel} →
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 text-[11.5px] text-slate-500 flex items-center justify-between">
              <span>Nothing here is blocking. No OIG exclusion. No revoked license.</span>
            </div>
          </Card>

          {/* Pending clinician request (shown when waiting) */}
          {waiting && (
            <Card className="overflow-hidden border-amber-300">
              <div className="px-5 py-3 border-b border-amber-200 bg-amber-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500 pulse-soft" />
                  <div className="text-[13px] font-semibold text-amber-900">Request routed to clinician</div>
                </div>
                <span className="mono text-[10.5px] uppercase tracking-[0.12em] text-amber-700">{application.lastRequestAt}</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {application.requestedLaneIds.map(id => {
                  const lane = REQUESTABLE_LANES.find(l => l.id === id);
                  if (!lane) return null;
                  return (
                    <li key={id} className="px-5 py-3 flex items-start gap-2">
                      <Icon.ArrowRight size={12} className="text-slate-400 mt-1" />
                      <div>
                        <div className="text-[12.5px] text-slate-900 font-medium">{lane.label}</div>
                        <div className="text-[11.5px] text-slate-500">{lane.hint}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {/* Policy fit */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Icon.ShieldCheck size={14} className="text-slate-700" />
              <div className="text-[13px] font-semibold text-slate-900">Policy fit · Cedar Health PA track</div>
            </div>
            <ul className="space-y-2 text-[12.5px]">
              <PolicyRow ok label="Active NPI in good standing" />
              <PolicyRow ok label="Valid Type-1 individual enumeration" />
              <PolicyRow pending label="No OIG exclusion (check pending)" />
              <PolicyRow access label="CA PA license verification (PSV required)" />
              <PolicyRow ok label="Taxonomy matches requisition (363A00000X)" />
            </ul>
          </Card>

          {/* Decision outcome */}
          {decision && (
            <Card className={cn('p-5',
              decision === 'accept' && 'border-emerald-300 bg-emerald-50/50',
              decision === 'refresh' && 'border-amber-300 bg-amber-50/50',
              decision === 'reject' && 'border-slate-300 bg-slate-50'
            )}>
              <div className="flex items-start gap-3">
                <div className={cn('h-7 w-7 rounded-md flex items-center justify-center ring-1 ring-inset flex-shrink-0',
                  decision === 'accept' && 'bg-emerald-100 text-emerald-700 ring-emerald-600/20',
                  decision === 'refresh' && 'bg-amber-100 text-amber-700 ring-amber-600/20',
                  decision === 'reject' && 'bg-slate-200 text-slate-700 ring-slate-400/30'
                )}>
                  {decision === 'accept' ? <Icon.CheckCircle size={14} /> : decision === 'refresh' ? <Icon.Refresh size={14} /> : <Icon.ArrowUp size={14} />}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-slate-900">
                    {decision === 'accept' && 'Cleared for Credentialing'}
                    {decision === 'refresh' && 'Refresh requested'}
                    {decision === 'reject' && 'Rejected / Archived'}
                  </div>
                  <div className="text-[11.5px] text-slate-600 mt-1">
                    {decision === 'accept' && 'Packet forwarded to MSO with verified identity sealed. Pending checks continue to update on the record.'}
                    {decision === 'refresh' && 'Stale sources re-queued. You\'ll be notified as results land.'}
                    {decision === 'reject' && 'Applicant declined and archived. Receipt signed with org key.'}
                  </div>
                  <div className="mono text-[10.5px] text-slate-400 mt-2 uppercase tracking-[0.1em]">
                    Logged · {NOW_LABEL.toLowerCase()} · by J. Okafor
                  </div>
                </div>
                <button onClick={() => setDecision(null)} className="text-slate-400 hover:text-slate-700">
                  <Icon.X size={14} />
                </button>
              </div>
            </Card>
          )}
        </aside>
      </div>

      {/* PSV Checklist — the strict table */}
      {decision !== 'accept' && (
        <section ref={checklistRef} className="mt-8 scroll-mt-6">
          <div className="mb-3 flex items-end justify-between flex-wrap gap-2">
            <div>
              <div className="mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Ruleset · {gate.ruleset.id} · v{gate.ruleset.version}</div>
              <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-slate-900 mt-1 leading-tight">
                Primary-Source Verifications required before acceptance
              </h3>
              <p className="text-[12px] text-slate-600 mt-1 max-w-[680px] leading-[1.5]">
                VitalCV enforces the same NCQA CR §3 ruleset your MSO is audited against. Each unmet
                requirement is shown with its owner, the minimum trust tier that will satisfy it, and
                the governing standard.
              </p>
            </div>
            <div className="mono text-[10.5px] text-slate-500 uppercase tracking-[0.12em]">
              Effective {gate.ruleset.effective}
            </div>
          </div>
          <PSVChecklist gate={gate} />
        </section>
      )}

      {/* Sticky action rail */}
      <ActionRail
        gate={gate}
        onScrollToChecklist={scrollToChecklist}
        onDecide={(d) => {
          setDecision(d);
          if (d === 'accept' && typeof onAccept === 'function') onAccept();
        }}
        decision={decision}
        onOpenRequestInfo={() => setModalOpen(true)}
      />

      {/* Request Missing Info Modal */}
      <RequestMissingInfoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={(laneIds, note) => {
          onRequestInfo(laneIds, note);
          setModalOpen(false);
        }}
      />

      {/* Verification Delta Modal */}
      <RefreshDiffModal
        open={diffOpen}
        onClose={() => setDiffOpen(false)}
      />
    </div>
  );
}

function KPI({ label, value, tone, sub, zero }) {
  const tones = {
    emerald: 'text-emerald-700',
    amber:   'text-amber-700',
    indigo:  'text-indigo-700',
    slate:   'text-slate-700',
  };
  return (
    <div className="bg-white p-4">
      <div className="mono text-[10.5px] uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={cn('text-[26px] font-semibold tracking-tightish leading-none', zero ? 'text-slate-900' : tones[tone])}>{value}</span>
        {zero && <span className="text-[11px] text-slate-400 ml-1">none</span>}
      </div>
      <div className="text-[11.5px] text-slate-500 mt-2">{sub}</div>
    </div>
  );
}

function PolicyRow({ ok, pending, access, label }) {
  let I = Icon.Check, cls = 'text-emerald-600';
  if (pending) { I = Icon.Clock; cls = 'text-amber-600'; }
  if (access)  { I = Icon.Lock;  cls = 'text-indigo-600'; }
  return (
    <li className="flex items-center gap-2.5">
      <I size={13} className={cls} strokeWidth={2.25} />
      <span className="text-slate-700">{label}</span>
    </li>
  );
}

function ActionRail({ onDecide, decision, onOpenRequestInfo, gate, onScrollToChecklist }) {
  const ready = gate ? gate.ready : true;
  const statuses = [
    { id: 'yes',         label: 'YES',         sub: 'Proceed',   tone: 'emerald' },
    { id: 'conditional', label: 'CONDITIONAL', sub: 'Pending',   tone: 'amber'   },
    { id: 'no',          label: 'NO',          sub: 'Block',     tone: 'rose'    },
  ];
  const activeStatus =
    decision === 'accept'  ? 'yes'         :
    decision === 'reject'  ? 'no'          :
    decision === 'refresh' ? 'conditional' :
    ready                   ? 'yes'         :
    'conditional';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/97 backdrop-blur border-t border-slate-200">
      <div className="max-w-[1400px] mx-auto px-6 pt-2.5 pb-2.5">
        {/* Row 1 — the question + tri-state readout */}
        <div className="flex items-center gap-4 flex-wrap pb-2 border-b border-slate-100">
          <div className="flex items-center gap-3 pr-4 mr-auto">
            <div className="h-8 w-8 rounded-md bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
              <Icon.Gauge size={14} />
            </div>
            <div className="min-w-0">
              <div className="mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500 leading-none">Decision Console · Req {EMPLOYER.reqId}</div>
              <div className="text-[13px] font-semibold text-slate-900 leading-tight mt-1">Can this provider move forward?</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mono">
            {statuses.map(s => {
              const active = activeStatus === s.id;
              const toneMap = {
                emerald: active ? 'bg-emerald-600 text-white border-emerald-600'   : 'bg-white text-emerald-700 border-emerald-600/30',
                amber:   active ? 'bg-amber-500 text-white border-amber-500'       : 'bg-white text-amber-700 border-amber-600/30',
                rose:    active ? 'bg-rose-600 text-white border-rose-600'         : 'bg-white text-rose-700 border-rose-600/30',
              };
              return (
                <div key={s.id}
                  title={active ? `Current status: ${s.label}` : `${s.label} — status derived from open checks & gated sources`}
                  className={cn(
                    'flex items-center gap-2 px-2.5 py-1.5 border rounded-[3px] transition-colors whitespace-nowrap',
                    toneMap[s.tone],
                    !active && 'opacity-55'
                  )}>
                  <span className={cn(
                    'inline-block h-1.5 w-1.5 rounded-full',
                    s.tone === 'emerald' && (active ? 'bg-white' : 'bg-emerald-600'),
                    s.tone === 'amber'   && (active ? 'bg-white' : 'bg-amber-500'),
                    s.tone === 'rose'    && (active ? 'bg-white' : 'bg-rose-600'),
                  )} />
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] leading-none">[ {s.label} ]</span>
                  <span className="text-[9.5px] uppercase tracking-[0.1em] opacity-70 leading-none">{s.sub}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 2 — operational actions */}
        <div className="flex items-center gap-2 pt-2 flex-wrap">
          <span className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500 mr-1">// Action</span>
          <OpButton
            variant="primary"
            label="Clear for Credentialing"
            sub={ready ? 'Forward to MSO with verified identity sealed.' : `Locked · ${gate ? gate.counts.required - gate.counts.met : '–'} req. unmet`}
            icon={ready ? null : <Icon.Lock size={11} />}
            onClick={() => ready ? onDecide('accept') : onScrollToChecklist && onScrollToChecklist()}
            active={decision === 'accept'}
            disabled={!ready}
          />
          <OpButton
            variant="outline"
            label="Route to MSO / Request Info"
            sub="Send specific lanes back to clinician or MSO."
            onClick={onOpenRequestInfo}
          />
          <OpButton
            variant="ghost"
            label="Reject / Archive"
            sub="Decline packet. Logged & signed."
            onClick={() => onDecide('reject')}
            active={decision === 'reject'}
          />
          <span className="ml-auto mono text-[10px] text-slate-500 hidden md:block">
            // Every decision signed with org key · reviewer: J. Okafor
          </span>
        </div>
      </div>
    </div>
  );
}

function OpButton({ variant, label, sub, onClick, active, disabled, icon }) {
  const base = 'group flex flex-col items-start text-left px-3 py-1.5 rounded-md border transition-colors';
  const styles = {
    primary: cn(
      disabled
        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed hover:bg-slate-100'
        : 'bg-slate-900 text-white border-slate-900 hover:bg-black',
      active && !disabled && 'ring-2 ring-slate-900 ring-offset-1'
    ),
    outline: cn('bg-white text-slate-900 border-slate-300 hover:border-slate-500', active && 'ring-2 ring-slate-900 ring-offset-1'),
    ghost:   cn('bg-transparent text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-100', active && 'ring-2 ring-slate-300'),
  };
  const subCls = {
    primary: disabled ? 'text-slate-400' : 'text-slate-300 group-hover:text-slate-200',
    outline: 'text-slate-500',
    ghost:   'text-slate-500',
  };
  return (
    <button
      onClick={onClick}
      title={disabled ? 'Acceptance gate: required verifications are not yet met.' : undefined}
      aria-disabled={disabled ? 'true' : 'false'}
      className={cn(base, styles[variant])}
    >
      <span className="text-[12.5px] font-semibold leading-tight whitespace-nowrap inline-flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className={cn('text-[10.5px] mt-0.5 leading-snug whitespace-nowrap', subCls[variant])}>{sub}</span>
    </button>
  );
}

/* ---------- Request Missing Info modal ---------- */
function RequestMissingInfoModal({ open, onClose, onSubmit }) {
  const [selected, setSelected] = React.useState(() => new Set(
    REQUESTABLE_LANES.filter(l => l.recommended).map(l => l.id)
  ));
  const [note, setNote] = React.useState('');
  const [priority, setPriority] = React.useState('normal');

  React.useEffect(() => {
    if (open) {
      setSelected(new Set(REQUESTABLE_LANES.filter(l => l.recommended).map(l => l.id)));
      setNote('');
      setPriority('normal');
    }
  }, [open]);

  const toggle = (id) => {
    setSelected(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const count = selected.size;

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={`Req ${EMPLOYER.reqId} · Macie Miller, PA-C`}
      title="Request Missing Info"
      width="lg"
      footer={
        <>
          <div className="mr-auto text-[11.5px] text-slate-500">
            Clinician receives a secure, time-boxed link. Lifecycle will move to <span className="mono text-slate-900">Waiting on Clinician</span>.
          </div>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={count === 0}
            iconRight={<Icon.ArrowRight size={14} />}
            onClick={() => onSubmit([...selected], note)}
          >
            Route Request to Clinician
          </Button>
        </>
      }
    >
      <p className="text-[12.5px] text-slate-600 leading-[1.55] mb-4">
        Select which trust lanes require action from the clinician. Only lanes that cannot be resolved from
        federal sources should be routed here — federal checks (NPPES, OIG, PECOS) are already auto-verified.
      </p>

      <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">Trust lanes · select any</div>
      <ul className="border border-slate-200 rounded-md overflow-hidden divide-y divide-slate-100">
        {REQUESTABLE_LANES.map(lane => {
          const isOn = selected.has(lane.id);
          return (
            <li key={lane.id}>
              <label className={cn('flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors',
                isOn && 'bg-slate-50')}>
                <span className={cn(
                  'mt-0.5 h-4 w-4 rounded-[3px] border flex items-center justify-center flex-shrink-0 transition-colors',
                  isOn ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300'
                )}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isOn}
                    onChange={() => toggle(lane.id)}
                  />
                  {isOn && <Icon.Check size={11} strokeWidth={3} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-slate-900">{lane.label}</span>
                    {lane.recommended && (
                      <span className="mono text-[9.5px] uppercase tracking-[0.12em] text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-[1px]">Recommended</span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-slate-500 mt-0.5">{lane.hint}</div>
                </div>
                <Chip state={lane.state === 'access' ? 'access' : 'unknown'} size="sm">
                  {lane.state === 'access' ? 'Gated' : 'Not on file'}
                </Chip>
              </label>
            </li>
          );
        })}
      </ul>

      {/* Note + priority */}
      <div className="grid grid-cols-12 gap-4 mt-5">
        <div className="col-span-12 md:col-span-8">
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1.5">Message to clinician · optional</div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="e.g., Please upload a current COI. Our MSO needs carrier name + policy number."
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-[12.5px] text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
          />
        </div>
        <div className="col-span-12 md:col-span-4">
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500 mb-1.5">Priority</div>
          <div className="flex flex-col gap-1">
            {[
              { id: 'normal',   label: 'Normal',   sub: 'Respond within 72h' },
              { id: 'expedite', label: 'Expedite', sub: 'Respond within 24h' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPriority(p.id)}
                className={cn(
                  'text-left px-3 py-2 rounded-md border transition-colors',
                  priority === p.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-400'
                )}
              >
                <div className="text-[12.5px] font-medium text-slate-900">{p.label}</div>
                <div className="text-[11px] text-slate-500">{p.sub}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-3 text-[11.5px]">
        <span className="text-slate-500">{count} lane{count !== 1 && 's'} selected</span>
        <span className="text-slate-500 mono">
          Receipt will be signed · Audit: <span className="text-slate-900">request_info · v1</span>
        </span>
      </div>
    </Modal>
  );
}

window.ViewEmployer = ViewEmployer;
