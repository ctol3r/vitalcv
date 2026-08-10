'use client';

/**
 * EvidenceCapsule — ONE document object, in every state the homepage shows it.
 *
 * The recovery direction (#1060, Concept C) is built on a single persistent
 * artifact: the same record forms while a visitor is typing, resolves when a
 * source answers, carries their travel decisions, arrives at an employer as a
 * subset, and closes as a seal. Those are FACES OF ONE OBJECT, not five cards
 * that happen to sit on the same page — so the shell, the header, the row and
 * the rules below are exported and shared, and the live lookup renders through
 * exactly the same parts as the illustrative chapters.
 *
 * WHAT THIS COMPONENT MAY SAY is still decided entirely by
 * `evidenceCapsuleModel`. This file renders rows; it does not invent them and
 * does not decide what state a row is in — the model sets that explicitly at
 * the point where it knows what a source actually returned.
 *
 * STYLE OWNER: `styles/home.css`, imported by `app/page.tsx`. This is the fix
 * for the defect that motivated the recovery — the capsule's classes lived only
 * in two stylesheets that a direct push orphaned, so the surface produced by
 * the site's primary action rendered unstyled in production while CI stayed
 * green (the tests read the CSS off disk instead of asserting the route imports
 * it). The capsule is now styled by the page it appears on.
 *
 * NO LUCIDE. `check-design-lint` LINT-02 ratchets raw `lucide-react` imports.
 * State marks come from `ProvenanceChip`, the canonical provenance atom, which
 * renders a dot SHAPE as well as a hue so state never rides on colour alone.
 */

import Link from 'next/link';
import * as React from 'react';

import { ProvenanceChip } from '@/design-system/components/ProvenanceChip';

import {
  GROUP_LABEL,
  provenanceParts,
  rowsOfKind,
  type EvidenceCapsuleModel,
  type EvidenceRow,
} from './evidenceCapsuleModel';

/** The shared shell. `face` is a data attribute only — styling, never meaning. */
export function CapsuleShell({
  face,
  className,
  children,
  ...rest
}: {
  face: 'forming' | 'resolved' | 'resolving' | 'system' | 'deciding' | 'traveling' | 'sealed';
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['evidence-capsule', face === 'resolving' ? 'evidence-capsule--resolving' : '', face === 'system' ? 'evidence-capsule--system' : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      data-evidence-capsule={face}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * The header. `illustrative` is not decoration and not optional: any capsule
 * showing returned data that did not come from THIS visitor's own lookup must
 * say so, in the same mono as the facts, above the facts.
 */
export function CapsuleHead({
  eyebrow,
  illustrative,
  name,
  npi,
  detail,
}: {
  eyebrow: string;
  illustrative?: string;
  name?: string | null;
  npi?: string | null;
  detail?: string | null;
}) {
  return (
    <header className="evidence-capsule__head">
      <div className="evidence-capsule__head-top">
        <span className="evidence-capsule__eyebrow">{eyebrow}</span>
        {illustrative ? (
          <span className="evidence-capsule__illustrative">{illustrative}</span>
        ) : null}
      </div>
      {name || npi || detail ? (
        <div className="evidence-capsule__identity">
          {name ? <p className="evidence-capsule__name">{name}</p> : null}
          {npi ? <p className="evidence-capsule__npi">{npi}</p> : null}
          {detail ? <p className="evidence-capsule__detail">{detail}</p> : null}
        </div>
      ) : null}
    </header>
  );
}

/**
 * One row of the record.
 *
 * `trailing` is the row's state. It is a `ProvenanceChip` on every evidence
 * face and a travel mark on the permission face — the same slot either way, so
 * the eye learns one place to look for "what is true about this line".
 */
export function CapsuleRow({
  claim,
  returned,
  provenance,
  trailing,
}: {
  claim: string;
  returned?: string | null;
  provenance?: string[] | null;
  trailing?: React.ReactNode;
}) {
  return (
    <li className="evidence-capsule__row">
      <div className="evidence-capsule__row-main">
        <p className="evidence-capsule__claim">{claim}</p>
        {returned ? <p className="evidence-capsule__returned">{returned}</p> : null}
        {provenance && provenance.length > 0 ? (
          <p className="evidence-capsule__provenance">
            {provenance.map((part, index) => (
              <React.Fragment key={part}>
                {index > 0 ? <span aria-hidden="true"> · </span> : null}
                <span>{part}</span>
              </React.Fragment>
            ))}
          </p>
        ) : null}
      </div>
      {trailing}
    </li>
  );
}

/** A row built from the model. The state comes from the model, never from here. */
export function CapsuleModelRow({ row }: { row: EvidenceRow }) {
  return (
    <CapsuleRow
      claim={row.claim}
      returned={row.returned}
      provenance={provenanceParts(row)}
      trailing={
        <ProvenanceChip
          state={row.state}
          // The row already paints the full provenance line via
          // `provenanceParts`, so the chip must not repeat it — but it still
          // has to STATE its attribution. `row.source` is null exactly when no
          // source answered, which is the `declared` case rather than a source
          // with an unrecorded as-of.
          attribution={
            row.source
              ? { source: row.source, asOf: row.observedAt }
              : { declared: 'no source answered' }
          }
          // The row paints the provenance; the chip states it for assistive
          // tech without repeating it visually.
          provenanceLine="hidden"
          shape="stamp"
          size="sm"
        />
      }
    />
  );
}

export function CapsuleRows({ children }: { children: React.ReactNode }) {
  return <ul className="evidence-capsule__rows">{children}</ul>;
}

export function CapsuleFoot({ children }: { children: React.ReactNode }) {
  return <div className="evidence-capsule__foot">{children}</div>;
}

/* -------------------------------------------------------------- live faces */

export function EvidenceCapsuleResolved({
  model,
  onReset,
}: {
  model: EvidenceCapsuleModel;
  onReset: () => void;
}) {
  const { identity, npi, nextAction } = model;

  /*
    Only non-empty groups are announced. Reading "0 returned by source, 0
    needing attention" aloud is noise, and — worse — it puts the words
    "returned by source" into the page on a lookup where no source returned
    anything, which is the one thing this capsule must never imply.
  */
  const spoken = (['returned', 'attention', 'unavailable'] as const)
    .map((kind) => ({ kind, n: rowsOfKind(model, kind).length }))
    .filter(({ n }) => n > 0)
    .map(({ kind, n }) =>
      kind === 'returned'
        ? `${n} returned by a named source`
        : kind === 'attention'
          ? `${n} needing attention`
          : `${n} unavailable without additional access`,
    );

  return (
    <CapsuleShell face="resolved" data-home-tone="trust">
      {/* A concise announcement. The card itself is not a live region — reading
          every row aloud on arrival buries the part that matters. */}
      <p className="sr-only" role="status">
        {spoken.length > 0
          ? `Lookup complete for NPI ${npi}. ${spoken.join(', ')}.`
          : `Lookup complete for NPI ${npi}. No source returned a result.`}
      </p>

      <CapsuleHead
        eyebrow="Evidence record"
        name={identity.name ?? `NPI ${npi}`}
        npi={identity.fromRegistry ? `NPI ${npi} · located in NPPES` : `NPI ${npi}`}
        detail={
          identity.detail ?? (identity.fromRegistry ? null : 'Registry identity unavailable right now')
        }
      />

      {/*
        Rows stay GROUPED by kind, and each row also carries its own state chip.
        The grouping is what a screen-reader user navigates by and what the
        truth e2e reads; the per-row chip is what stops a heading from being the
        only thing a sighted reader sees. Both, not either — the group label was
        never the problem, an unqualified group label was.
      */}
      {(['returned', 'attention', 'unavailable'] as const).map((kind) => {
        const rows = rowsOfKind(model, kind);
        if (rows.length === 0) return null;
        return (
          <section key={kind} className="evidence-capsule__group" data-evidence-group={kind}>
            <h3 className="evidence-capsule__group-title">{GROUP_LABEL[kind]}</h3>
            <CapsuleRows>
              {rows.map((row) => (
                <CapsuleModelRow key={row.id} row={row} />
              ))}
            </CapsuleRows>
          </section>
        );
      })}

      <div className="evidence-capsule__actions">
        <Link href="/onboarding" className="evidence-capsule__reset" data-home-next-step="">
          {/*
            Was "Claim your free CV Wallet". CD-13 retires wallet, crypto and
            DID vocabulary from the entire acquisition path, and `wallet` is in
            the shipped BUYER_BANNED_STRINGS list — so the homepage's own
            success state was carrying a term the product bans everywhere else.
            The honest next step is the one the route actually performs.
          */}
          Keep this record
        </Link>
        <button type="button" onClick={onReset} className="evidence-capsule__reset">
          Check another NPI
        </button>
      </div>

      <CapsuleFoot>
        {nextAction ? <p className="evidence-capsule__limit">{nextAction}</p> : null}
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
      </CapsuleFoot>
    </CapsuleShell>
  );
}

export function EvidenceCapsuleResolving({ children }: { children: React.ReactNode }) {
  return (
    <CapsuleShell face="resolving" data-home-tone="paper" aria-live="polite">
      {children}
    </CapsuleShell>
  );
}

export function EvidenceCapsuleError({ npi, onReset }: { npi: string; onReset: () => void }) {
  return (
    <CapsuleShell face="system" data-home-tone="paper">
      {/*
        A SYSTEM state, deliberately not styled as a finding. No danger surface,
        no red mark, no failed-credential vocabulary: the registry did not
        answer, which says nothing whatsoever about this provider.
      */}
      {/* Same announcement pattern as the resolved face: one concise sentence in
          a live region, so a screen-reader user learns the lookup ended without
          having to go find the card. The card itself is not the live region. */}
      <p className="sr-only" role="status">
        Lookup could not complete for NPI {npi}. No source answered, so there is no result to read.
      </p>

      <CapsuleHead eyebrow="Evidence record" name="We couldn't reach the registry" />
      <CapsuleFoot>
        <p className="evidence-capsule__limit">
          This is a system state, not a finding about NPI {npi}. No source answered, so there is no
          result to read in either direction. Check the number and try again.
        </p>
      </CapsuleFoot>
      <div className="evidence-capsule__actions">
        <button type="button" onClick={onReset} className="evidence-capsule__reset">
          Try another NPI
        </button>
      </div>
    </CapsuleShell>
  );
}
