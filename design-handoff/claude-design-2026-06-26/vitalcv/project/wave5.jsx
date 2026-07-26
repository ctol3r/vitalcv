// Wave 5 — Continuous Trust & Career Autopilot
// Components: CareerAutopilot (clinician), MonitoringFeed (employer), RefreshDiffModal (both)

/* ---------- Career Autopilot ----------
 * Not a job board. A strategic readiness terminal: what does your current
 * trust state already pre-qualify you for, and what specific primary-source
 * artifacts would unlock additional mobility?
 */
function CareerAutopilot() {
  const m = MOBILITY;
  return (
    <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon.Route size={14} className="text-slate-700" />
          <span className="text-[13px] font-semibold text-slate-900">Career autopilot</span>
        </div>
        <span className="mono text-[10px] uppercase tracking-[0.14em] text-slate-400">Next Best Action</span>
      </div>

      {/* Current mobility readout */}
      <div className="px-5 py-4">
        <div className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Current mobility</div>
        <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
          <span className="mono text-[26px] font-semibold tracking-tightish text-slate-900 leading-none">{m.qualifiedReqs}</span>
          <span className="text-[12px] text-slate-500">open requisitions · VitalCV network</span>
        </div>
        <p className="text-[12px] leading-[1.55] text-slate-600 mt-2">
          Your <span className="text-slate-900 font-medium">active CA PA license</span> and{' '}
          <span className="text-slate-900 font-medium">clear OIG status</span> pre-qualify you for{' '}
          <span className="mono text-slate-900">{m.qualifiedReqs}</span> roles across{' '}
          <span className="mono text-slate-900">{m.networkReqs}</span> listed in-network.
        </p>

        {/* Coverage bar */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${Math.round((m.qualifiedReqs / m.networkReqs) * 100)}%` }} />
          </div>
          <span className="mono text-[10px] text-slate-500 uppercase tracking-[0.12em]">
            {Math.round((m.qualifiedReqs / m.networkReqs) * 100)}% coverage
          </span>
        </div>
      </div>

      {/* Next best actions */}
      <div className="border-t border-slate-200">
        <div className="px-5 py-2.5 flex items-center justify-between border-b border-slate-100">
          <span className="mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Unlock more · primary-source artifacts</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {m.actions.map(a => (
            <li key={a.id} className="px-5 py-3 flex items-start gap-3">
              <div className="h-6 w-6 mt-0.5 rounded-sm bg-slate-100 ring-1 ring-inset ring-slate-200 flex items-center justify-center flex-shrink-0">
                <Icon.ArrowUp size={12} className="text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium text-slate-900 leading-snug">{a.label}</div>
                <div className="mono text-[10.5px] text-slate-500 mt-0.5 leading-snug">{a.sub}</div>
              </div>
              <button className="text-[11.5px] text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-500 rounded px-2 py-1 whitespace-nowrap mono uppercase tracking-[0.08em]">
                [ {a.cta} ]
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50 mono text-[10px] text-slate-500 leading-snug">
        // Logic-based · derived from your live trust state. No ads. No behavioral scoring.
      </div>
    </div>
  );
}

/* ---------- Proactive Monitoring Feed ----------
 * Terminal-style compliance feed. Automated events that prove the system
 * works quietly in the background.
 */
function MonitoringFeed() {
  const feed = MONITORING_FEED;
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">Continuous Monitoring · last 30 days</div>
          <div className="text-[15px] font-semibold text-slate-900 tracking-tightish mt-0.5">Background compliance feed</div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-soft" />
            <span className="mono uppercase tracking-[0.12em]">monitor · live</span>
          </span>
          <span className="h-3 w-px bg-slate-200" />
          <span className="mono uppercase tracking-[0.1em] text-slate-400">{feed.length} events</span>
        </div>
      </div>

      <div className="border border-slate-800 bg-slate-950 text-slate-100 rounded-md overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500/70" />
              <span className="h-2 w-2 rounded-full bg-amber-500/70" />
              <span className="h-2 w-2 rounded-full bg-emerald-500/70" />
            </div>
            <span className="mono text-[10px] text-slate-500 uppercase tracking-[0.14em] ml-2">vitalcv · monitor · req-2026-1184</span>
          </div>
          <span className="mono text-[10px] text-slate-500 uppercase tracking-[0.14em]">tail -f /var/log/compliance</span>
        </div>

        <ul className="divide-y divide-slate-800/70">
          {feed.map((e, i) => {
            const kindCls = {
              SYSTEM: 'text-slate-400',
              ALERT:  'text-amber-400',
            }[e.kind] || 'text-slate-400';
            const msgCls = {
              ok:    'text-emerald-300',
              warn:  'text-amber-200',
              info:  'text-slate-200',
              muted: 'text-slate-400',
            }[e.tone] || 'text-slate-200';
            return (
              <li key={i} className="px-4 py-2 mono text-[11.5px] leading-[1.5] flex gap-3 hover:bg-slate-900/40 transition-colors">
                <span className="text-slate-500 whitespace-nowrap">{e.t}</span>
                <span className={cn('uppercase tracking-[0.1em] whitespace-nowrap', kindCls)}>[{e.kind}]</span>
                <span className={cn('flex-1', msgCls)}>{e.msg}</span>
              </li>
            );
          })}
        </ul>
        <div className="px-4 py-2 border-t border-slate-800 bg-slate-900 mono text-[10px] text-slate-500 uppercase tracking-[0.14em] flex items-center justify-between">
          <span>// All events signed with org key · replayable</span>
          <span>↳ _</span>
        </div>
      </div>
    </section>
  );
}

/* ---------- Cryptographic Refresh Diff Modal ----------
 * When a refresh completes, show a brutalist code-diff of what changed.
 * Trust state as a commit log.
 */
function RefreshDiffModal({ open, onClose, onCommit }) {
  const [committed, setCommitted] = React.useState(false);

  React.useEffect(() => {
    if (open) setCommitted(false);
  }, [open]);

  const diff = [
    { lane: 'OIG/LEIE',     kind: 'unchanged',
      before: { k: 'OIG_Observed',     v: '2026-03-15T09:00Z' },
      after:  { k: 'OIG_Observed',     v: '2026-04-18T14:22Z' },
      result: 'UNCHANGED (No Exclusions)',
      tone: 'ok' },
    { lane: 'PECOS',        kind: 'unchanged',
      before: { k: 'PECOS_Enrollment', v: '2025-01-28 · active' },
      after:  { k: 'PECOS_Enrollment', v: '2026-04-18 · active' },
      result: 'UNCHANGED (No reassignment delta)',
      tone: 'ok' },
    { lane: 'NPPES',        kind: 'field_update',
      before: { k: 'NPPES_Address',    v: '2100 Jamboree Rd, Newport Beach CA' },
      after:  { k: 'NPPES_Address',    v: '1 Hoag Dr, Newport Beach CA' },
      result: 'FIELD UPDATED (Primary practice address)',
      tone: 'info' },
  ];

  const mergeHash = '0x7d1fa9c3b28e41a…e04';
  const runId = 'run-2026-04-18T14:32:51Z';

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={`Refresh run · ${runId}`}
      title="Verification Delta"
      width="lg"
      footer={
        <>
          <div className="mr-auto mono text-[10.5px] text-slate-500 leading-snug">
            3 lanes re-observed · 2 unchanged · 1 field updated · 0 exclusions
          </div>
          <Button variant="ghost" onClick={onClose}>Discard</Button>
          <Button
            variant="primary"
            iconRight={<Icon.ArrowRight size={14} />}
            onClick={() => {
              setCommitted(true);
              onCommit && onCommit();
              setTimeout(() => onClose && onClose(), 900);
            }}
          >
            {committed ? 'Committed ✓' : 'Commit Delta to Audit Trail'}
          </Button>
        </>
      }
    >
      <div className="mono text-[10.5px] text-slate-500 leading-snug mb-3">
        // Delta computed against prior run · cryptographic before/after digest below.
        Each line is a typed field observation, not a score.
      </div>

      <div className="border border-slate-800 bg-slate-950 text-slate-100 rounded-md overflow-hidden">
        {/* Terminal header */}
        <div className="px-4 py-2 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
          <span className="mono text-[10px] text-slate-500 uppercase tracking-[0.14em]">git diff · trust-state</span>
          <span className="mono text-[10px] text-slate-500">merge: {mergeHash}</span>
        </div>

        <div className="divide-y divide-slate-800/70">
          {diff.map((d, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="mono text-[10.5px] text-slate-500 uppercase tracking-[0.14em]">
                  @@ lane: <span className="text-slate-300">{d.lane}</span> @@
                </div>
                <span className={cn('mono text-[9.5px] uppercase tracking-[0.14em] px-1.5 py-[1px] rounded border',
                  d.kind === 'unchanged' ? 'text-emerald-300 border-emerald-400/30 bg-emerald-400/5'
                                         : 'text-sky-300 border-sky-400/30 bg-sky-400/5')}>
                  {d.kind === 'unchanged' ? 'UNCHANGED' : 'UPDATED'}
                </span>
              </div>
              <div className="mono text-[11.5px] leading-[1.6] space-y-[2px]">
                <div className="flex gap-2">
                  <span className="text-rose-400 select-none">-</span>
                  <span className="text-slate-500 line-through decoration-rose-500/60">
                    {d.before.k}: {d.before.v}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-emerald-400 select-none">+</span>
                  <span className="text-emerald-300">
                    {d.after.k}: {d.after.v}
                  </span>
                </div>
                <div className="flex gap-2 pt-1">
                  <span className="text-slate-600 select-none">=</span>
                  <span className={cn('uppercase tracking-[0.08em]',
                    d.tone === 'ok' ? 'text-emerald-300' : 'text-sky-300')}>
                    Result: {d.result}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-slate-800 bg-slate-900 flex items-center justify-between mono text-[10px] text-slate-500 uppercase tracking-[0.14em]">
          <span>↳ signed · ed25519 · org-key:vitalcv/prod/202</span>
          <span>{committed ? 'committed ✓' : 'ready to commit'}</span>
        </div>
      </div>

      <div className="mt-3 mono text-[10.5px] text-slate-500 leading-snug">
        Committing appends a signed delta record to the immutable audit trail for <span className="text-slate-900">Req {EMPLOYER.reqId}</span>.
        Prior state remains queryable by run_id.
      </div>
    </Modal>
  );
}

window.CareerAutopilot = CareerAutopilot;
window.MonitoringFeed = MonitoringFeed;
window.RefreshDiffModal = RefreshDiffModal;
