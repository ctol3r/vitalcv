'use client';

/**
 * Agent Ops — Wave L0.
 *
 * The first surface that reads the Start Agent's decision ledger. Inherits the
 * Founder Dashboard treatment verbatim (mz / mz-persona-admin); introduces no
 * new visual language.
 *
 * The headline renders `loopState`, not uptime. Doctrine L2: success and
 * vacancy must never share a colour, so `not_enrolled` is deliberately NOT
 * green — an idle loop reads as idle, and an enrolled loop that stopped
 * running reads as a fault.
 */
import * as React from 'react';
import type { AgentLoopState, AgentOpsReport } from '@/lib/agent/ops/agent-ops-report';

const LOOP_STATE_LABEL: Record<AgentLoopState, string> = {
  not_enrolled: 'Loop idle — nobody enrolled',
  enrolled_idle: 'Loop stalled',
  running: 'Loop running',
  unknown: 'Telemetry unreadable',
};

/** Deliberately: only `running` is green. */
function loopStateColor(state: AgentLoopState): string {
  if (state === 'running') return 'var(--ok)';
  if (state === 'enrolled_idle' || state === 'unknown') return 'var(--p0)';
  return 'var(--watch)';
}

function loopStateChip(state: AgentLoopState): string {
  if (state === 'running') return 'mz-chip-ok';
  if (state === 'enrolled_idle' || state === 'unknown') return 'mz-chip-p0';
  return 'mz-chip-watch';
}

function pct(value: number | null): string {
  if (value == null) return '—';
  return `${Math.round(value * 100)}%`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="mz-glass rounded-[12px] p-5">
      <div className="mz-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-400)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-[var(--ink-900)]">{value}</div>
      {hint && <p className="mt-2 text-[11.5px] leading-5 text-[var(--ink-500)]">{hint}</p>}
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mz-eyebrow">{title}</h2>
      {subtitle && <p className="mt-2 max-w-2xl text-[12.5px] leading-5 text-[var(--ink-500)]">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mz-glass rounded-[12px] px-4 py-6 text-center text-[12.5px] text-[var(--ink-500)]">
      {children}
    </div>
  );
}

export default function AgentOpsClient({ initialReport }: { initialReport: AgentOpsReport }) {
  const [report, setReport] = React.useState<AgentOpsReport>(initialReport);
  const [refreshing, setRefreshing] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/agent-ops', { cache: 'no-store' });
      if (res.ok) setReport((await res.json()) as AgentOpsReport);
    } catch {
      /* keep last good report */
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [refresh]);

  const { cohort, activity, agreement, refusals, deltas } = report;

  return (
    <main className="mz mz-paper mz-persona-admin mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mz-eyebrow">Production · Start Agent</div>
          <h1 className="mz-h1 mt-3 flex items-center gap-3">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: loopStateColor(report.loopState) }}
            />
            {LOOP_STATE_LABEL[report.loopState]}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--ink-600)]">{report.loopStateDetail}</p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="mz-btn mz-btn-ghost mz-btn-sm disabled:opacity-50"
        >
          {refreshing ? 'Reading…' : 'Refresh'}
        </button>
      </header>

      {report.degraded && (
        <div
          className="mt-5 rounded-[8px] border px-4 py-3 text-[12.5px]"
          style={{ borderColor: 'var(--p0-rule)', background: 'var(--p0-bg)' }}
        >
          Agent telemetry could not be read. Every figure below is unknown, not zero.
        </div>
      )}

      <Panel
        title="Cohort"
        subtitle="Row existence in agent_subject_schedules is the allowlist. There is no predicate that can widen it, and this surface does not manage enrolment."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Enrolled" value={String(cohort.enrolled)} hint={cohort.enrolled === 0 ? 'The loop cannot run.' : undefined} />
          <Stat label="Enabled" value={String(cohort.enabled)} hint={cohort.disabled > 0 ? `${cohort.disabled} paused` : undefined} />
          <Stat label="Due now" value={String(cohort.dueNow)} />
          <Stat
            label="Next due"
            value={cohort.nextDueAt ? new Date(cohort.nextDueAt).toISOString().replace('T', ' ').slice(0, 16) : '—'}
            hint={cohort.failing > 0 ? `${cohort.failing} with consecutive failures` : undefined}
          />
        </div>
      </Panel>

      <Panel title={`Activity · last ${report.windowDays} days`}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Runs 24h" value={String(activity.runs24h)} />
          <Stat label={`Runs ${report.windowDays}d`} value={String(activity.runs7d)} />
          <Stat
            label="Scheduled"
            value={String(activity.byTrigger.scheduled)}
            hint={`${activity.byTrigger.interactive} interactive · ${activity.byTrigger.event} event`}
          />
          <Stat
            label="Shadow / live"
            value={`${activity.byMode.shadow} / ${activity.byMode.live}`}
            hint={activity.byMode.live === 0 && activity.byMode.shadow > 0 ? 'Recorded everything, acted on nothing.' : undefined}
          />
        </div>
        {activity.policyVersions.length > 0 && (
          <div className="mz-glass mt-4 rounded-[12px] p-5">
            <div className="mz-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-400)]">Policy versions in window</div>
            <ul className="mt-2 space-y-1.5">
              {activity.policyVersions.map((p) => (
                <li key={p.policyVersion} className="flex items-center justify-between gap-3 text-[12.5px]">
                  <span className="mz-mono text-[var(--ink-800)]">{p.policyVersion}</span>
                  <span className="mz-mono text-[var(--ink-500)]">{p.runs} runs</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <Panel
        title="Agreement"
        subtitle="Override rate is the quality headline: how often a human took a different action than the one the agent ranked first. A rate of “—” means nothing has been presented yet, which is not the same as agreement."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Override rate" value={pct(agreement.overrideRate)} hint={`${agreement.overridden} of ${agreement.presented} presented`} />
          <Stat label="Accepted" value={String(agreement.accepted)} />
          <Stat label="Dismissed" value={String(agreement.dismissed)} />
          <Stat label="Completed / failed" value={`${agreement.completed} / ${agreement.failed}`} />
        </div>

        {agreement.byActionType.length === 0 ? (
          <div className="mt-4">
            <EmptyRow>No action has been presented to a human in this window.</EmptyRow>
          </div>
        ) : (
          <div className="mz-glass mt-4 overflow-x-auto rounded-[12px]">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="mz-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-400)]">
                  <th scope="col" className="px-4 py-3 font-normal">Action type</th>
                  <th scope="col" className="px-4 py-3 text-right font-normal">Presented</th>
                  <th scope="col" className="px-4 py-3 text-right font-normal">Accepted</th>
                  <th scope="col" className="px-4 py-3 text-right font-normal">Dismissed</th>
                  <th scope="col" className="px-4 py-3 text-right font-normal">Overridden</th>
                  <th scope="col" className="px-4 py-3 text-right font-normal">Override rate</th>
                </tr>
              </thead>
              <tbody>
                {agreement.byActionType.map((row) => (
                  <tr key={row.actionType} className="border-t" style={{ borderColor: 'var(--rule)' }}>
                    <td className="mz-mono px-4 py-3 text-[var(--ink-800)]">{row.actionType}</td>
                    <td className="mz-mono px-4 py-3 text-right text-[var(--ink-600)]">{row.presented}</td>
                    <td className="mz-mono px-4 py-3 text-right text-[var(--ink-600)]">{row.accepted}</td>
                    <td className="mz-mono px-4 py-3 text-right text-[var(--ink-600)]">{row.dismissed}</td>
                    <td className="mz-mono px-4 py-3 text-right text-[var(--ink-600)]">{row.overridden}</td>
                    <td className="mz-mono px-4 py-3 text-right text-[var(--ink-900)]">{pct(row.overrideRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Refusals"
        subtitle="What the agent declined to do, and why. A rising refusal rate is either a source problem or a policy problem; distinguishing them is the point."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Blocked events" value={String(refusals.blocked)} />
        </div>
        {refusals.byStatus.length === 0 ? (
          <div className="mt-4">
            <EmptyRow>No non-ready actions recorded in this window.</EmptyRow>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {refusals.byStatus.map((row) => (
              <li key={row.status} className="mz-glass flex items-center justify-between gap-3 rounded-[8px] px-4 py-3 text-[12.5px]">
                <span className="mz-mono text-[var(--ink-800)]">{row.status}</span>
                <span className="mz-mono text-[var(--ink-500)]">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Plan deltas"
        subtitle="What changed about the recommended next step. Most rows are immaterial by design and are recorded for the learning loop, never surfaced to a clinician."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total" value={String(deltas.total)} />
          <Stat label="Material" value={String(deltas.material)} />
          <Stat label="Immaterial" value={String(deltas.immaterial)} />
        </div>
        {deltas.byKind.length > 0 && (
          <ul className="mt-4 space-y-2">
            {deltas.byKind.map((row) => (
              <li
                key={`${row.kind}-${String(row.material)}`}
                className="mz-glass flex items-center justify-between gap-3 rounded-[8px] px-4 py-3 text-[12.5px]"
              >
                <span className="flex items-center gap-2">
                  <span className={`mz-chip ${row.material ? 'mz-chip-watch' : 'mz-chip-ok'}`}>
                    <span className="mz-gl" aria-hidden="true" />
                    {row.material ? 'material' : 'immaterial'}
                  </span>
                  <span className="mz-mono text-[var(--ink-800)]">{row.kind}</span>
                </span>
                <span className="mz-mono text-[var(--ink-500)]">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {report.notes.length > 0 && (
        <Panel title="Notes">
          <ul className="space-y-2">
            {report.notes.map((note, idx) => (
              <li
                key={idx}
                className="rounded-[8px] border px-4 py-3 text-[12.5px] text-[var(--ink-700)]"
                style={{ borderColor: 'var(--watch-rule)', background: 'var(--watch-bg)' }}
              >
                {note}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <p className="mz-mono mt-8 text-[10px] uppercase tracking-[0.1em] text-[var(--ink-400)]">
        Read-only · generated {report.generatedAt}
      </p>
    </main>
  );
}
