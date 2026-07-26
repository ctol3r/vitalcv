import type {
  ActivationRequirementStatus,
  ClinicianActivationView,
  ClinicianRequirementView,
  StartState,
} from '@/lib/applications/activationView';
import type { ActivationLoadResult } from '@/lib/applications/activationView';

/**
 * ClinicianStartPathPanel (ACT-7.1 read) — the owning clinician's "path to
 * start" for one application: the requirement ledger + the recorded start
 * state, rendered honestly.
 *
 * Truth rails:
 *   - an empty ledger is "hasn't begun", never a vacuous "ready";
 *   - `requirements_met` is "awaiting the employer's recorded decision", never
 *     "you can start" and never a credentialing claim;
 *   - a blocked or access-gated requirement is always shown, never folded into
 *     a generic "ready" summary;
 *   - `started` reads as "Start recorded", never "hired" or "credentialed".
 * Pure server render; no fabricated data — an unavailable read says so.
 */

const STATUS_LABEL: Record<ActivationRequirementStatus, string> = {
  not_started: 'Not started',
  requested: 'Requested',
  submitted: 'Submitted',
  under_review: 'Under review',
  met: 'Met',
  waived: 'Waived',
  not_applicable: 'Not applicable',
  blocked: 'Blocked',
  expired: 'Expired — needs refresh',
};

/** Semantic token per status — emerald=resolved, red=blocker, amber=attention. */
function statusColor(status: ActivationRequirementStatus): string {
  if (status === 'met' || status === 'waived' || status === 'not_applicable') {
    return 'var(--vt-accent-emerald)';
  }
  if (status === 'blocked') return 'var(--vt-state-blocked, #B91C1C)';
  if (status === 'expired') return 'var(--vt-state-pending, #92400E)';
  return 'var(--vt-text-muted)';
}

const START_STATE_LABEL: Record<StartState, string> = {
  not_ready: 'Start not yet recorded',
  start_ready: 'Marked start-ready by the employer',
  started: 'Start recorded',
  cancelled: 'Start cancelled',
};

function RequirementRow({ r }: { r: ClinicianRequirementView }) {
  return (
    <li
      data-activation-requirement={r.status}
      className="flex items-start justify-between gap-3 border-t border-[var(--vt-border-subtle)] py-2.5 first:border-t-0"
    >
      <div className="min-w-0">
        <p className="text-[13px] font-medium leading-snug text-[var(--vt-text-primary)]">{r.label}</p>
        <p className="mt-0.5 text-[11px] text-[var(--vt-text-muted)]">
          {r.necessity === 'required' ? 'Required' : 'Preferred'} · {r.category.replace('_', ' ')} ·{' '}
          {r.owner === 'clinician' ? 'yours to resolve' : r.owner === 'employer' ? 'employer to resolve' : r.owner === 'both' ? 'shared' : 'system'}
        </p>
      </div>
      <span
        data-requirement-status={r.status}
        className="mt-0.5 shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: statusColor(r.status), border: `1px solid ${statusColor(r.status)}` }}
      >
        {STATUS_LABEL[r.status]}
      </span>
    </li>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="Your path to start"
      data-clinician-start-path=""
      className="mz mt-4 rounded-[10px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4"
    >
      <p className="mz-eyebrow">Path to start</p>
      {children}
    </section>
  );
}

function ActivationBody({ data }: { data: ClinicianActivationView }) {
  if (data.phase === 'not_started') {
    return (
      <>
        <h3 className="mt-2 text-sm font-semibold text-[var(--vt-text-primary)]">
          Your path to start hasn&rsquo;t begun yet.
        </h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
          Activation requirements appear here after an employer accepts the packet you shared. Nothing is
          outstanding from you right now.
        </p>
      </>
    );
  }

  const { summary, requirements, startState } = data;
  const headline =
    data.phase === 'requirements_met'
      ? 'Every required item is met.'
      : `${summary.requiredOpen} required ${summary.requiredOpen === 1 ? 'item' : 'items'} still open.`;

  return (
    <>
      <h3 className="mt-2 text-sm font-semibold text-[var(--vt-text-primary)]">{headline}</h3>
      {data.phase === 'requirements_met' ? (
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
          This meets the requirement for a qualified start. The employer records the start-ready decision —
          it is not a credentialing or privileging decision, and it is not a completed start.
        </p>
      ) : (
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
          Each item below names who resolves it and its current state. Blocked or expired items are shown
          explicitly — nothing is hidden behind a &ldquo;ready&rdquo; label.
        </p>
      )}

      <ul className="mt-3">
        {requirements.map((r) => (
          <RequirementRow key={r.id} r={r} />
        ))}
      </ul>

      <p
        data-start-state={startState}
        className="mt-3 border-t border-[var(--vt-border-subtle)] pt-3 text-[12px] text-[var(--vt-text-muted)]"
      >
        {START_STATE_LABEL[startState]}
        {summary.hasHardBlocker ? ' · a blocker needs attention before start-ready' : ''}
      </p>
    </>
  );
}

export function ClinicianStartPathPanel({ result }: { result: ActivationLoadResult }) {
  // Unauthorized / not_found: the page's own guards already handle the missing
  // application. Render nothing rather than a misleading empty card.
  if (result.status === 'unauthorized' || result.status === 'not_found') return null;

  if (result.status === 'error') {
    return (
      <PanelShell>
        <p className="mt-2 text-[13px] text-[var(--vt-text-secondary)]">{result.message}</p>
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      <ActivationBody data={result.data} />
    </PanelShell>
  );
}

export default ClinicianStartPathPanel;
