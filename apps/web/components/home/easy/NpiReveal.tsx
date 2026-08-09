'use client';

/**
 * NpiReveal — the recognition moment (UX-05). "Poof. VitalCV found me."
 *
 * Two pieces, both presentation over the existing real pipeline — no API,
 * auth, consent, or data-model change:
 *
 *  `ResolvingNarration` renders while the real pairing is in flight: the
 *  shared CHECK_SEQUENCE process steps (process-honest labels — what we are
 *  DOING, never result claims), one-shot reveal pacing via
 *  `useSourceCheckSequence`, no spinner, no percentage, nothing loops. The
 *  pacing hook's minimum duration means the reveal never beats the data;
 *  under prefers-reduced-motion it settles instantly, exactly as today.
 *
 *  `NpiReveal` renders when the registry names a person: the identity
 *  assembles first (registry-framed — only NPPES-derived values), then the
 *  REAL evidence rows from `buildEvidenceCapsule` — the same pure transform
 *  the old two-number summary was counted from, now shown as rows.
 *
 * Truth (EC-3 / EC-25 applied to a STATEFUL surface — EC-26: real returned
 * records only, no fixture path, no optimistic path):
 *  - Every row is exactly what the capsule model said: claim, what returned
 *    (plain words, never a verdict), the source that answered, its cadence
 *    and limitation behind one disclosure — progressive, not a provenance
 *    table.
 *  - Unknowns get EQUAL typographic confidence: an unavailable lane renders
 *    at full opacity in the same type as a returned one; only the state word
 *    and its hue differ (meaning stays in words — EC-4).
 *  - The demo path (`isDemo`) carries no capsule, so this view can never
 *    dress fixture data in row provenance.
 *  - Correction path: "Not you?" is a first-class action, not fine print.
 */

import { useEffect, useRef } from 'react';
import Link from 'next/link';

import {
  GROUP_LABEL,
  provenanceParts,
  rowsOfKind,
  type EvidenceCapsuleModel,
  type EvidenceRow,
  type EvidenceRowKind,
} from '@/components/home/evidence/evidenceCapsuleModel';
import {
  CHECK_SEQUENCE,
  useSourceCheckSequence,
} from '@/components/readiness/sourceCheckNarration';
import type { ClinicianCareerProfile } from '@/lib/career-loop/profile';

/* ── the resolving narration ─────────────────────────────────────────────── */

export function ResolvingNarration({
  done,
  onSettled,
}: {
  /** True once the real request has answered (ok or not). */
  done: boolean;
  /** Called after the pacing floor elapses — the caller swaps views. */
  onSettled: () => void;
}) {
  const { step, phase, finish } = useSourceCheckSequence({
    stepCount: CHECK_SEQUENCE.length,
  });
  const settledRef = useRef(false);

  useEffect(() => {
    if (done) finish(true);
  }, [done, finish]);

  useEffect(() => {
    if (phase !== 'resolving' && !settledRef.current) {
      settledRef.current = true;
      onSettled();
    }
  }, [phase, onSettled]);

  return (
    <div className="ezh-rv-narration" role="status" aria-live="polite">
      <span className="ezh-k">Reading public sources</span>
      <ul className="ezh-rv-steps">
        {CHECK_SEQUENCE.map((label, i) => {
          const position = i < step ? 'read' : i === step ? 'running' : 'queued';
          return (
            <li key={label} className={`ezh-rv-step is-${position}`}>
              <i className="ezh-rv-dot" aria-hidden="true" />
              {label}
              {position === 'running' ? <span className="ezh-rv-now">reading</span> : null}
            </li>
          );
        })}
      </ul>
      <p className="ezh-rv-narr-note">No account, nothing saved &mdash; this reads the public record.</p>
    </div>
  );
}

/* ── one evidence row, with its disclosure ───────────────────────────────── */

const STATE_WORD: Record<string, string> = {
  checked: 'Checked',
  reviewRequired: 'Review required',
  pending: 'Pending',
  notFound: 'Not found',
  accessRequired: 'Access required',
};

function RevealRow({ row }: { row: EvidenceRow }) {
  const parts = provenanceParts(row);
  return (
    <li className={`ezh-rv-row is-${row.kind}`} data-reveal-row={row.state}>
      <div className="ezh-rv-row-main">
        <span className="ezh-rv-claim">{row.claim}</span>
        <span className="ezh-rv-returned">{row.returned}</span>
        <span className={`ezh-rv-state s-${row.state}`}>{STATE_WORD[row.state] ?? row.state}</span>
      </div>
      {parts.length > 0 ? (
        <details className="ezh-rv-more">
          <summary>Source &amp; limits</summary>
          <p>{parts.join(' · ')}</p>
        </details>
      ) : null}
    </li>
  );
}

/* ── the recognition view ────────────────────────────────────────────────── */

const GROUP_ORDER: EvidenceRowKind[] = ['returned', 'attention', 'unavailable'];

export function NpiReveal({
  profile,
  capsule,
  isDemo,
  onKeep,
  onReset,
  children,
}: {
  profile: ClinicianCareerProfile;
  capsule: EvidenceCapsuleModel | null;
  isDemo: boolean;
  onKeep: () => void;
  onReset: () => void;
  /** The caller's match feed block, rendered between rows and actions. */
  children?: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Single-shot entrance: mount hidden, then one class flips the stagger.
  // Reduced motion never sees the hidden frame.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('is-in', 'is-instant');
      return;
    }
    const raf = requestAnimationFrame(() => root.classList.add('is-in'));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={rootRef} className="ezh-rv" role="status" data-npi-reveal="">
      {/* identity, registry-framed — assembles first */}
      <div className="ezh-rv-id">
        <span className="ezh-rv-mono" aria-hidden="true">{profile.monogram}</span>
        <div className="ezh-rv-id-text">
          <p className="ezh-rv-name">{profile.displayName}</p>
          <p className="ezh-rv-meta">
            {[profile.credential, profile.specialty, profile.location].filter(Boolean).join(' · ')
              || 'Named in the NPPES registry'}
          </p>
        </div>
      </div>
      <p className="ezh-rv-src">
        {isDemo
          ? 'Example profile — not a registry read'
          : `Named by NPPES for NPI ${profile.npi}`}
      </p>

      {/* the real rows — what each source said, and didn't */}
      {capsule && !capsule.empty ? (
        <div className="ezh-rv-rows">
          {GROUP_ORDER.map((kind) => {
            const rows = rowsOfKind(capsule, kind);
            if (rows.length === 0) return null;
            return (
              <section key={kind} className={`ezh-rv-group g-${kind}`}>
                <h3 className="ezh-rv-group-h">{GROUP_LABEL[kind]}</h3>
                <ul>
                  {rows.map((row) => (
                    <RevealRow key={row.id} row={row} />
                  ))}
                </ul>
              </section>
            );
          })}
          {capsule.nextAction ? (
            <p className="ezh-rv-next">
              <span className="ezh-k">One next step</span>
              {capsule.nextAction}
            </p>
          ) : null}
        </div>
      ) : null}

      {children}

      <div className="ezh-rv-actions">
        <Link href="/onboarding" className="ezh-rv-keep" onClick={onKeep}>
          Keep this record
        </Link>
        <button type="button" className="ezh-rv-again" onClick={onReset}>
          Not you? Check another NPI
        </button>
      </div>
      <p className="ezh-rv-note">
        Your profile continues in onboarding &mdash; you decide what gets shared, every time.
      </p>
    </div>
  );
}
