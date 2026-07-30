'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Lock, AlertTriangle, Circle } from 'lucide-react';

/**
 * WorkflowStoryTabs — the Anyscale "workload tabs" pattern translated to the
 * clinician career workflow: Recognize → Prepare → Match → Apply → Accept.
 * One step is shown at a time (short explanation + an illustrative product
 * panel), which replaces the static five-card "how it works" loop with a single
 * interactive component — less to read, more product proof.
 *
 * Honesty: the panels are ILLUSTRATIVE of the product and use the real
 * source-state vocabulary — source-backed / checked / gated / needs review /
 * access-required — never a bare "verified" and never a fabricated score,
 * probability, or salary. A footnote says so.
 *
 * A11y: proper tablist / tab / tabpanel roles, roving tabindex, ←/→/Home/End
 * keyboard control, the active tab reflected in the URL hash (replaceState, no
 * scroll jump), and a fixed-min-height panel so switching never shifts layout.
 */

type StateKind = 'ok' | 'checked' | 'gated' | 'attention' | 'neutral';

interface PanelRow {
  label: string;
  detail: string;
  state: StateKind;
}

interface Step {
  id: string;
  n: string;
  label: string;
  title: string;
  blurb: string;
  bullets: readonly string[];
  panelHeading: string;
  rows: readonly PanelRow[];
  action: string;
}

const STEPS: readonly Step[] = [
  {
    id: 'recognize',
    n: '1',
    label: 'Recognize',
    title: 'Start with one NPI',
    blurb:
      'Enter a National Provider Identifier and VitalCV resolves the public identity and runs the first source checks — no account required.',
    bullets: [
      'Identity from the NPPES registry',
      'Federal exclusion check (OIG / LEIE)',
      'Medicare enrollment lookup (PECOS)',
      'Taxonomy and practice location',
    ],
    panelHeading: 'Identity',
    rows: [
      { label: 'Identity', detail: 'Confirmed through NPPES', state: 'ok' },
      { label: 'OIG / LEIE', detail: 'Checked · no match returned', state: 'checked' },
      { label: 'PECOS', detail: 'Enrollment not found', state: 'attention' },
    ],
    action: 'Open readiness snapshot',
  },
  {
    id: 'prepare',
    n: '2',
    label: 'Prepare',
    title: 'See what is ready — and what is missing',
    blurb:
      'The source checks become a readiness snapshot: every dimension named, with its state and the single next-best action.',
    bullets: [
      'Readiness by dimension',
      'Credential gaps surfaced',
      'Missing documents flagged',
      'One clear next step',
    ],
    panelHeading: 'Readiness snapshot',
    rows: [
      { label: 'Identity', detail: 'Source-backed', state: 'ok' },
      { label: 'Exclusions', detail: 'Checked', state: 'checked' },
      { label: 'Licensure', detail: 'State-board access required', state: 'gated' },
      { label: 'Enrollment', detail: 'Needs your attention', state: 'attention' },
    ],
    action: 'Fix the next gap',
  },
  {
    id: 'match',
    n: '3',
    label: 'Match',
    title: 'Match on evidence and preference',
    blurb:
      'MATCHA compares your source-backed record and your stated preferences against real openings — and shows its reasoning, never a black-box score.',
    bullets: [
      'Requirement-by-requirement fit',
      'Location and schedule preferences',
      'Explainable match reasoning',
      'No fabricated probability or salary',
    ],
    panelHeading: 'Match reasoning',
    rows: [
      { label: 'Specialty', detail: 'Meets requirement', state: 'ok' },
      { label: 'State license', detail: 'Access required to confirm', state: 'gated' },
      { label: 'Preference · location', detail: 'Within your radius', state: 'neutral' },
    ],
    action: 'See why it matched',
  },
  {
    id: 'apply',
    n: '4',
    label: 'Apply',
    title: 'Apply without starting over',
    blurb:
      'Reuse the same wallet to send an employer-ready packet. You choose what to disclose, and every share leaves a consent receipt.',
    bullets: [
      'Reusable application package',
      'Selective disclosure you control',
      'Employer-specific proof packet',
      'A consent receipt on every share',
    ],
    panelHeading: 'Proof packet',
    rows: [
      { label: 'Identity', detail: 'Source-backed', state: 'ok' },
      { label: 'Exclusions', detail: 'Checked', state: 'checked' },
      { label: 'Licensure', detail: 'Gated — shown as gated', state: 'gated' },
      { label: 'Shared with', detail: 'Cardiology review', state: 'neutral' },
    ],
    action: 'Send proof packet',
  },
  {
    id: 'accept',
    n: '5',
    label: 'Accept',
    title: 'Accepted as a head start',
    blurb:
      'An employer reviews the packet, asks for anything missing, and can accept it as a head start — which becomes your VitalCV Recognition and moves the start date up. Institution review remains the final step.',
    bullets: [
      'Employer review queue',
      'Clarification requests',
      'Accept as a head start',
      'A Recognition receipt you keep',
    ],
    panelHeading: 'Employer decision',
    rows: [
      { label: 'Packet', detail: 'Reviewed', state: 'neutral' },
      { label: 'Head start', detail: 'Accepted', state: 'ok' },
      { label: 'Recognition', detail: 'Issued to your wallet', state: 'ok' },
      { label: 'Start window', detail: 'Moved up', state: 'attention' },
    ],
    action: 'View Recognition',
  },
] as const;

const STATE_STYLE: Record<StateKind, { chip: string; icon: React.ReactNode }> = {
  ok: {
    chip: 'border-transparent bg-[color-mix(in_oklab,var(--vt-state-source-confirmed)_14%,transparent)] text-[var(--vt-state-source-confirmed)]',
    icon: <CheckCircle2 size={12} aria-hidden="true" />,
  },
  checked: {
    chip: 'border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] text-[var(--vt-text-secondary)]',
    icon: <CheckCircle2 size={12} aria-hidden="true" />,
  },
  gated: {
    chip: 'border-transparent bg-[color-mix(in_oklab,#a16408_14%,transparent)] text-[#a16408]',
    icon: <Lock size={12} aria-hidden="true" />,
  },
  attention: {
    chip: 'border-transparent bg-[color-mix(in_oklab,#a16408_14%,transparent)] text-[#a16408]',
    icon: <AlertTriangle size={12} aria-hidden="true" />,
  },
  neutral: {
    chip: 'border-[var(--vt-border)] bg-transparent text-[var(--vt-text-muted)]',
    icon: <Circle size={11} aria-hidden="true" />,
  },
};

export function WorkflowStoryTabs() {
  const [active, setActive] = React.useState(0);
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  // Reflect / restore the active step in the URL hash (#step-<id>) without a
  // scroll jump, so a shared link opens the right step.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromHash = window.location.hash.replace('#step-', '');
    const idx = STEPS.findIndex((s) => s.id === fromHash);
    if (idx >= 0) setActive(idx);
  }, []);

  const select = React.useCallback((idx: number, focus = false) => {
    setActive(idx);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#step-${STEPS[idx].id}`);
    }
    if (focus) tabRefs.current[idx]?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (active + 1) % STEPS.length;
    else if (e.key === 'ArrowLeft') next = (active - 1 + STEPS.length) % STEPS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = STEPS.length - 1;
    if (next >= 0) {
      e.preventDefault();
      select(next, true);
    }
  };

  const step = STEPS[active];

  return (
    <section
      aria-label="How VitalCV works"
      data-home-loop=""
      data-home-workflow-tabs=""
      className="mt-16"
    >
      <p className="mz-eyebrow">How it works</p>
      <h2 className="mz-h1" style={{ marginTop: 14, maxWidth: 620 }}>
        One NPI, all the way to <em className="mz-accent">accepted.</em>
      </h2>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="VitalCV workflow steps"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="mt-6 flex flex-wrap gap-2"
      >
        {STEPS.map((s, i) => {
          const selected = i === active;
          return (
            <button
              key={s.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`tab-${s.id}`}
              aria-selected={selected}
              aria-controls={`panel-${s.id}`}
              tabIndex={selected ? 0 : -1}
              data-home-loop-step={s.n}
              onClick={() => select(i)}
              className={[
                'inline-flex items-center gap-2 rounded-[4px] border px-3.5 py-2 text-[13px] font-semibold transition-colors',
                selected
                  ? 'border-transparent bg-[var(--vt-text-primary)] text-[var(--vt-bg)]'
                  : 'border-[var(--vt-border)] bg-[var(--vt-surface)] text-[var(--vt-text-secondary)] hover:border-[var(--vt-text-muted)] hover:text-[var(--vt-text-primary)]',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
                  selected
                    ? 'bg-[var(--vt-bg)]/20 text-[var(--vt-bg)]'
                    : 'bg-[var(--vt-surface-subtle)] text-[var(--vt-text-muted)]',
                ].join(' ')}
              >
                {s.n}
              </span>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Panel — fixed min-height prevents layout shift between steps */}
      <div
        role="tabpanel"
        id={`panel-${step.id}`}
        aria-labelledby={`tab-${step.id}`}
        tabIndex={0}
        key={step.id}
        className="workflow-fade-in mt-4 grid min-h-[300px] gap-6 rounded-[12px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-6 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"
      >
        {/* Left: explanation */}
        <div>
          <h3 className="text-[20px] font-semibold leading-snug text-[var(--vt-text-primary)]">
            {step.title}
          </h3>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[var(--vt-text-secondary)]">
            {step.blurb}
          </p>
          <ul className="mt-4 space-y-2">
            {step.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-[13px] text-[var(--vt-text-primary)]">
                <CheckCircle2
                  size={14}
                  className="mt-0.5 shrink-0 text-[var(--vt-state-source-confirmed)]"
                  aria-hidden="true"
                />
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Right: illustrative product panel */}
        <div className="rounded-[8px] border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">
            {step.panelHeading}
          </p>
          <ul className="mt-3 space-y-2.5">
            {step.rows.map((r) => (
              <li key={r.label} className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-medium text-[var(--vt-text-primary)]">{r.label}</span>
                <span
                  className={[
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                    STATE_STYLE[r.state].chip,
                  ].join(' ')}
                >
                  {STATE_STYLE[r.state].icon}
                  {r.detail}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-[4px] bg-[var(--vt-text-primary)] px-3 py-1.5 text-[12px] font-semibold text-[var(--vt-bg)]">
            {step.action}
            <ArrowRight size={13} aria-hidden="true" />
          </div>
        </div>
      </div>

      <p className="mt-3 text-[12px] text-[var(--vt-text-muted)]">
        Illustrative of the product — every field shows its real source state (source-backed, checked,
        gated, or needs review). Institution review remains the final step.
      </p>
    </section>
  );
}

export default WorkflowStoryTabs;
