import { Icon, type IconName } from '@/components/Icon';

export type ActivationPathAudience = 'clinician' | 'pilot';

type ActivationStep = {
  label: string;
  title: string;
  body: string;
  icon: IconName;
};

const CLINICIAN_STEPS: readonly ActivationStep[] = [
  {
    label: 'Your number',
    title: 'Start with your NPI',
    body: 'VitalCV reads the public NPPES record first. An NPI match is a registry identity record, not a license check.',
    icon: 'search',
  },
  {
    label: 'Your evidence',
    title: 'See every source state',
    body: 'What was read, what needs access, and what is unavailable stay separate instead of collapsing into one green answer.',
    icon: 'file-search',
  },
  {
    label: 'Your CV Wallet',
    title: 'Keep the record you control',
    body: 'Sign in only when you want to save it. Nothing goes to an employer until you choose the exact evidence to present.',
    icon: 'wallet',
  },
  {
    label: 'Your opportunity',
    title: 'Find a role worth moving for',
    body: 'Browse source-labelled opportunities, then decide whether to continue at the original listing or apply with VitalCV.',
    icon: 'waypoints',
  },
] as const;

const PILOT_RESPONSE_STEP: ActivationStep = {
  label: 'The response',
  title: 'Record what the employer did',
  body: 'Clarification, a head-start acceptance, or a do-not-proceed decision stays tied to the exact submitted packet.',
  icon: 'message-question',
};

export function activationSteps(audience: ActivationPathAudience): readonly ActivationStep[] {
  return audience === 'pilot' ? [...CLINICIAN_STEPS, PILOT_RESPONSE_STEP] : CLINICIAN_STEPS;
}

export function ActivationPath({
  audience = 'clinician',
  compact = false,
  heading = 'One record. One visible next move.',
}: {
  audience?: ActivationPathAudience;
  compact?: boolean;
  heading?: string;
}) {
  const steps = activationSteps(audience);

  return (
    <section aria-label="From NPI to first opportunity" data-activation-path={audience}>
      <div className={compact ? undefined : 'grid gap-4 lg:grid-cols-[0.72fr_1.28fr] lg:items-end'}>
        <div>
          <p className="mz-eyebrow">From NPI to first opportunity</p>
          <h2 className={`${compact ? 'text-xl' : 'mz-h2'} mt-2 text-[var(--vt-text-primary)]`}>
            {heading}
          </h2>
        </div>
        {!compact ? (
          <p className="mz-small max-w-2xl lg:justify-self-end">
            Each moment says what happened, what did not, and who controls the next action.
          </p>
        ) : null}
      </div>

      <ol
        className={
          compact
            ? 'mt-5 divide-y divide-[var(--vt-border)] border-y border-[var(--vt-border)]'
            : 'mt-7 grid list-none border-l border-t border-[var(--vt-border)] sm:grid-cols-2 xl:grid-cols-5'
        }
      >
        {steps.map((step, index) => (
          <li
            key={step.title}
            data-activation-step={index + 1}
            className={
              compact
                ? 'grid grid-cols-[2.75rem_1fr] gap-3 py-3.5'
                : 'min-w-0 border-b border-r border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 sm:p-5'
            }
          >
            <span
              className="inline-flex size-11 shrink-0 items-center justify-center border border-[var(--vt-border)] text-[var(--vt-accent-editorial)]"
              aria-hidden="true"
            >
              <Icon name={step.icon} className="size-5" strokeWidth={1.5} />
            </span>
            <div className={compact ? 'min-w-0' : 'mt-8'}>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--vt-text-muted)]">
                {String(index + 1).padStart(2, '0')} · {step.label}
              </p>
              <h3 className="mt-2 text-sm font-semibold text-[var(--vt-text-primary)]">
                {step.title}
              </h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--vt-text-secondary)]">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default ActivationPath;
