import { Icon } from '@/components/Icon';
import { HireToStartEmployerControls } from './HireToStartEmployerControls';
import type {
  HireToStartCase,
  HireToStartLoadResult,
  HireToStartRequirement,
  HireToStartStage,
} from '@/lib/applications/hireToStart';

const STAGE_LABEL: Record<HireToStartStage, string> = {
  application_submitted: 'Application submitted',
  employer_review: 'Employer review',
  clarification: 'Clarification requested',
  head_start_accepted: 'Accepted as a head start',
  requirements_in_progress: 'Requirements in progress',
  start_ready: 'Start-ready recorded',
  started: 'Actual first day confirmed',
  not_proceeding: 'Not proceeding',
  cancelled: 'Cancelled',
};

const MILESTONE_LABEL: Record<HireToStartCase['milestones'][number]['type'], string> = {
  application_submitted: 'Application submitted',
  employer_first_review: 'Employer first review',
  decision_recorded: 'Decision recorded',
  head_start_accepted: 'Accepted as a head start',
  start_ready_recorded: 'Start-ready recorded',
  actual_start_confirmed: 'Actual first day confirmed',
};

function formatDate(value: string | null, includeTime = false): string {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unavailable';
  return parsed.toLocaleString([], includeTime
    ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

function normalized(value: string): string {
  return value.replaceAll('_', ' ');
}

function isResolved(requirement: HireToStartRequirement): boolean {
  return ['met', 'waived', 'not_applicable'].includes(requirement.status);
}

function CaseBody({ data, dark }: { data: HireToStartCase; dark: boolean }) {
  const primary = dark ? 'text-white' : 'text-[var(--vt-text-primary)]';
  const secondary = dark ? 'text-white/65' : 'text-[var(--vt-text-secondary)]';
  const border = dark ? 'border-white/10' : 'border-[var(--vt-border-subtle)]';
  const surface = dark ? 'bg-black/20' : 'bg-[var(--vt-surface-raised)]';

  return (
    <>
      <div className={`grid gap-3 sm:grid-cols-3 ${primary}`}>
        <div className={`rounded-2xl border p-4 ${border} ${surface}`}>
          <p className={`text-xs uppercase tracking-[0.14em] ${secondary}`}>Current stage</p>
          <p className="mt-2 text-sm font-semibold">{STAGE_LABEL[data.currentStage]}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${border} ${surface}`}>
          <p className={`text-xs uppercase tracking-[0.14em] ${secondary}`}>Intended start</p>
          <p className="mt-2 text-sm font-semibold">{formatDate(data.intendedStartDate)}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${border} ${surface}`}>
          <p className={`text-xs uppercase tracking-[0.14em] ${secondary}`}>Actual first day</p>
          <p className="mt-2 text-sm font-semibold">{formatDate(data.actualStart?.actualFirstDay ?? null)}</p>
          {data.actualStart ? <p className={`mt-1 text-xs ${secondary}`}>Employer confirmed</p> : null}
        </div>
      </div>

      <div className={`mt-4 rounded-2xl border p-4 ${border} ${surface}`}>
        <div className="flex items-start gap-3">
          <Icon name="list-checks" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
          <div>
            <p className={`text-xs uppercase tracking-[0.14em] ${secondary}`}>Primary next action · {normalized(data.primaryNextAction.owner)}</p>
            <p className={`mt-1 text-sm font-semibold ${primary}`}>{data.primaryNextAction.label}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="hire-to-start-requirements">
          <div className="flex items-center justify-between gap-3">
            <h3 id="hire-to-start-requirements" className={`text-sm font-semibold ${primary}`}>Remaining requirements</h3>
            <span className={`text-xs ${secondary}`}>{data.blockerSummary.length} open blocker{data.blockerSummary.length === 1 ? '' : 's'}</span>
          </div>
          {data.requirements.length === 0 ? (
            <p className={`mt-3 text-sm ${secondary}`}>
              {data.decision?.state === 'accepted_as_head_start'
                ? 'No remaining requirements are recorded.'
                : 'The requirement ledger opens only after an exact packet is accepted as a head start.'}
            </p>
          ) : (
            <ul className="mt-2">
              {data.requirements.map((requirement) => (
                <li key={requirement.id} className={`border-t py-3 first:border-t-0 ${border}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-medium ${primary}`}>{requirement.label}</p>
                      <p className={`mt-1 text-xs ${secondary}`}>
                        {normalized(requirement.owner)} owns this · {normalized(requirement.necessity)}
                        {requirement.dueAt ? ` · due ${formatDate(requirement.dueAt)}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${isResolved(requirement) ? 'border-emerald-500/30 text-emerald-500' : 'border-amber-500/30 text-amber-500'}`}>
                      {normalized(requirement.status)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="hire-to-start-milestones">
          <h3 id="hire-to-start-milestones" className={`text-sm font-semibold ${primary}`}>Milestone history</h3>
          <ol className="mt-2">
            {data.milestones.map((item) => (
              <li key={`${item.type}-${item.occurredAt}`} className={`flex gap-3 border-t py-3 first:border-t-0 ${border}`}>
                <Icon name="waypoints" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                <div>
                  <p className={`text-sm font-medium ${primary}`}>{MILESTONE_LABEL[item.type]}</p>
                  <time className={`text-xs ${secondary}`} dateTime={item.occurredAt}>{formatDate(item.occurredAt, true)}</time>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className={`mt-5 flex items-start gap-3 border-t pt-4 ${border}`}>
        <Icon name="arrow-right" className={`mt-0.5 h-4 w-4 shrink-0 ${secondary}`} aria-hidden="true" />
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${secondary}`}>External system sync</p>
          <p className={`mt-1 text-sm ${primary}`}>Not configured for this case</p>
          <p className={`mt-1 text-xs leading-5 ${secondary}`}>{data.externalSystemSync.limitations.join(' ')}</p>
        </div>
      </div>

      {(data.packetBinding.limitations.length > 0 || data.limitations.length > 0) ? (
        <div className={`mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 ${primary}`}>
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
          <p className="text-xs leading-5">{[...data.packetBinding.limitations, ...data.limitations].join(' ')}</p>
        </div>
      ) : null}
    </>
  );
}

export function HireToStartCasePanel({
  result,
  variant = 'clinician',
}: {
  result: HireToStartLoadResult;
  variant?: 'clinician' | 'employer';
}) {
  if (result.status === 'not_found' || result.status === 'unauthorized') return null;
  const dark = variant === 'employer';
  const shell = dark
    ? 'rounded-[28px] border border-white/10 bg-white/[0.04] p-4 text-white sm:p-6'
    : 'mz mt-4 rounded-[10px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4';

  return (
    <section aria-label="Hire-to-start case" data-hire-to-start-case={variant} className={shell}>
      <div className="mb-4 flex items-center gap-3">
        <Icon name="clock" className="h-5 w-5 text-emerald-500" aria-hidden="true" />
        <div>
          <p className={dark ? 'text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80' : 'mz-eyebrow'}>Hire-to-start case</p>
          <h2 className={dark ? 'mt-1 text-xl font-semibold' : 'mt-1 text-sm font-semibold text-[var(--vt-text-primary)]'}>One joined path to the confirmed first day</h2>
        </div>
      </div>
      {result.status === 'error'
        ? <p className={dark ? 'text-sm text-white/65' : 'text-sm text-[var(--vt-text-secondary)]'}>{result.message}</p>
        : (
          <>
            <CaseBody data={result.data} dark={dark} />
            {variant === 'employer' ? (
              <HireToStartEmployerControls
                applicationId={result.data.application.id}
                decisionState={result.data.decision?.state ?? null}
                currentStage={result.data.currentStage}
                requirements={result.data.requirements}
              />
            ) : null}
          </>
        )}
    </section>
  );
}
