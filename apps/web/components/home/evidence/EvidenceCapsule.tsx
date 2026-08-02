'use client';

/**
 * EvidenceCapsule — the three faces of one object.
 *
 * Resolving, resolved and system-error are the SAME capsule in three states,
 * not three cards. They share a shell, a radius and a width so the container
 * does not resize as the lookup progresses.
 *
 * WHAT THIS COMPONENT MAY SAY is decided entirely by `evidenceCapsuleModel`.
 * This file renders rows; it does not invent them, does not group them by any
 * rule of its own, and does not know which source answered.
 *
 * NO LUCIDE. `check-design-lint` LINT-02 ratchets raw `lucide-react` imports
 * and there is no `components/Icon.tsx` in this repo. `TrustGlyph` maps an
 * `EvidenceState` — a claim about a source — and these marks label a GROUP, not
 * a claim, so the two are not interchangeable. The marks below are inline,
 * `aria-hidden`, and always accompanied by the group's text: state never rides
 * on a glyph or on colour. `LiveNpiResult` dropped its own lucide import in the
 * same change, so the ratchet moves DOWN.
 */

import Link from 'next/link';
import * as React from 'react';

import {
  GROUP_LABEL,
  provenanceParts,
  rowsOfKind,
  type EvidenceCapsuleModel,
  type EvidenceRowKind,
} from './evidenceCapsuleModel';

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Mark({ kind }: { kind: EvidenceRowKind }) {
  return (
    <svg viewBox="0 0 16 16" className="evidence-capsule__mark" aria-hidden="true" focusable="false" {...STROKE}>
      {kind === 'returned' ? (
        <>
          <circle cx="8" cy="8" r="6" />
          <path d="M5.2 8.2 L7.1 10.1 L10.8 6" />
        </>
      ) : kind === 'attention' ? (
        <>
          <path d="M8 2.6 L14.4 13.4 H1.6 Z" />
          <path d="M8 6.6 V9.4" />
          <circle cx="8" cy="11.4" r="0.75" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <rect x="3.4" y="7.2" width="9.2" height="6.4" rx="1.2" />
          <path d="M5.8 7.2 V5.4 a2.2 2.2 0 0 1 4.4 0 V7.2" />
        </>
      )}
    </svg>
  );
}

function Group({ kind, model }: { kind: EvidenceRowKind; model: EvidenceCapsuleModel }) {
  const rows = rowsOfKind(model, kind);
  if (rows.length === 0) return null;

  return (
    <section className="evidence-capsule__group" data-evidence-group={kind}>
      <h3 className="evidence-capsule__group-title">
        <Mark kind={kind} />
        {GROUP_LABEL[kind]}
      </h3>
      <ul className="evidence-capsule__rows">
        {rows.map((row) => {
          const parts = provenanceParts(row);
          return (
            <li key={row.id} className="evidence-capsule__row" data-evidence-row={row.id}>
              <p className="evidence-capsule__claim">{row.claim}</p>
              <p className="evidence-capsule__returned">{row.returned}</p>
              {/*
                SOURCE · CADENCE · LIMITATION. Absent parts are DROPPED, never
                filled in with a plausible default — an omitted cadence would
                read as "current", which is the claim this footer exists to
                prevent.
              */}
              {parts.length > 0 ? (
                <p className="evidence-capsule__provenance">
                  {parts.map((part, index) => (
                    <React.Fragment key={part}>
                      {index > 0 ? <span aria-hidden="true"> · </span> : null}
                      <span>{part}</span>
                    </React.Fragment>
                  ))}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function EvidenceCapsuleResolved({
  model,
  onReset,
}: {
  model: EvidenceCapsuleModel;
  onReset: () => void;
}) {
  const { identity, npi, nextAction } = model;
  const counts = {
    returned: rowsOfKind(model, 'returned').length,
    attention: rowsOfKind(model, 'attention').length,
    unavailable: rowsOfKind(model, 'unavailable').length,
  };

  return (
    <div className="evidence-capsule" data-evidence-capsule="resolved" data-home-tone="trust">
      {/* A concise announcement. The card itself is not a live region — reading
          every row aloud on arrival buries the part that matters. */}
      <p className="sr-only" role="status">
        {`Lookup complete for NPI ${npi}. ${counts.returned} returned by source, ` +
          `${counts.attention} needing attention, ${counts.unavailable} unavailable without additional access.`}
      </p>

      <header className="evidence-capsule__identity">
        <p className="evidence-capsule__name">{identity.name ?? `NPI ${npi}`}</p>
        {identity.detail ? <p className="evidence-capsule__detail">{identity.detail}</p> : null}
        <p className="evidence-capsule__npi">
          {identity.fromRegistry ? `NPI ${npi} · located in NPPES` : `NPI ${npi}`}
        </p>
        {!identity.fromRegistry ? (
          <p className="evidence-capsule__detail">Registry identity unavailable right now</p>
        ) : null}
      </header>

      <Group kind="returned" model={model} />
      <Group kind="attention" model={model} />
      <Group kind="unavailable" model={model} />

      <div className="evidence-capsule__next">
        <p className="evidence-capsule__next-label">Best next step</p>
        <p className="evidence-capsule__next-line">
          {nextAction
            ? `${nextAction} — claim your free CV Wallet to keep this snapshot with you.`
            : 'Claim your free CV Wallet to keep this snapshot with you and complete the missing evidence.'}
        </p>
        <Link href="/onboarding" className="evidence-capsule__cta">
          Claim your Wallet
          <svg viewBox="0 0 16 16" className="evidence-capsule__arrow" aria-hidden="true" focusable="false" {...STROKE}>
            <path d="M2.5 8 H12" />
            <path d="M8.4 4.4 L12 8 L8.4 11.6" />
          </svg>
        </Link>
      </div>

      <button type="button" onClick={onReset} className="evidence-capsule__reset">
        Check another NPI
      </button>

      {/*
        The limitation stays attached to the evidence, not parked in a footer
        three sections away. It also states what the capsule does NOT show — a
        per-check observation time — because the trust-state payload carries
        none, and silence there would read as "just now".
      */}
      <p className="evidence-capsule__limit">
        A public snapshot of what primary sources return, each at its own cadence shown above. No
        per-check observation time is available from these sources. This is not a completed
        credentialing decision — the reviewing institution makes that call.
      </p>
    </div>
  );
}

export function EvidenceCapsuleResolving({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="evidence-capsule evidence-capsule--resolving"
      data-evidence-capsule="resolving"
      data-home-tone="paper"
      aria-live="polite"
    >
      {children}
    </div>
  );
}

export function EvidenceCapsuleError({ npi, onReset }: { npi: string; onReset: () => void }) {
  return (
    <div className="evidence-capsule" data-evidence-capsule="system-error" data-home-tone="paper">
      {/*
        A SYSTEM state, deliberately not styled as a finding. No danger surface,
        no red mark, no failed-credential vocabulary: the registry did not
        answer, which says nothing whatsoever about this provider.
      */}
      <p className="evidence-capsule__name" role="status">
        We couldn&rsquo;t reach the registry
      </p>
      <p className="evidence-capsule__returned">
        This is a system state, not a finding about NPI {npi}. No source answered, so there is no
        result to read in either direction. Check the number and try again.
      </p>
      <button type="button" onClick={onReset} className="evidence-capsule__retry">
        Try another NPI
      </button>
    </div>
  );
}
