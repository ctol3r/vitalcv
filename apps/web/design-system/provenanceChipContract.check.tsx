/**
 * provenanceChipContract.check.tsx — compile-time proof of the W1082 contract
 * on ProvenanceChip (UX-02 Step 1).
 *
 * Never imported and never rendered: this file exists to be TYPE-CHECKED.
 * apps/web/tsconfig.json includes every .tsx file outside __tests__, and
 * next.config.mjs enforces TypeScript on build, so `next build` validates the
 * assertions below on every deploy. (It deliberately does NOT live in
 * __tests__ — that directory is excluded from the tsconfig, so an
 * @ts-expect-error there is never checked by anything. The glob that includes
 * this file cannot be written inside this comment: its two characters
 * star-slash would terminate the comment — which is also why this paragraph
 * spells it out in words.)
 *
 * Note also that `pnpm typecheck` does NOT cover the app — the type gate here
 * is `next build`. Proving this file works means breaking it and watching the
 * BUILD fail, not the typecheck.
 *
 * Each @ts-expect-error is load-bearing in both directions: if ProvenanceChip
 * ever stops requiring attribution — the exact regression W1082 exists to
 * prevent — the suppression becomes unused and the build fails.
 *
 * Sibling contract: lib/vital/stateChipContract.check.tsx (StateChip). When
 * StateChip is retired into this component, that file goes and this one stays.
 */
import * as React from 'react';

import { ProvenanceChip } from '@/design-system/components/ProvenanceChip';

declare function assertCompiles(node: React.ReactNode): void;

// ── The core requirement ────────────────────────────────────────────────────
// A chip must state its attribution. Forgetting is a build failure, not a
// review comment. Before this contract, six mounted call sites rendered a bare
// state word with no attribution at all.
assertCompiles(
  // @ts-expect-error — attribution is required at the type level (W1082)
  <ProvenanceChip state="checked" />,
);

// A source form cannot silently omit the as-of: `null` must be written, so
// "no timestamp" is always an explicit statement, never an accident.
assertCompiles(
  // @ts-expect-error — asOf is required inside a source attribution (W1082)
  <ProvenanceChip state="checked" attribution={{ source: 'NPPES' }} />,
);

// The declared form must name who declared it. An empty declaration is the
// same silence the contract exists to prevent.
assertCompiles(
  // @ts-expect-error — `declared` requires the actor, in words
  <ProvenanceChip state="selfAttested" attribution={{ declared: undefined }} />,
);

// The three forms are mutually exclusive. A chip cannot claim a source AND
// declare itself unsourced — that is two different truth claims at once.
assertCompiles(
  // @ts-expect-error — `source` and `declared` cannot coexist
  <ProvenanceChip state="checked" attribution={{ source: 'NPPES', asOf: null, declared: 'holder' }} />,
);

// An illustrative chip must say so explicitly; `legend` is never inferred.
assertCompiles(
  // @ts-expect-error — legend must be the literal `true`, not a truthy value
  <ProvenanceChip state="checked" attribution={{ legend: 'yes' }} />,
);

// ── The legal forms, pinned so a widening of the union shows up in review ────

// (a) A source answered, with a time.
assertCompiles(
  <ProvenanceChip state="checked" attribution={{ source: 'NPPES', asOf: '2026-07-14T09:12:00Z' }} />,
);

// (b) A source answered; the as-of was not recorded. Explicit, and rendered.
assertCompiles(<ProvenanceChip state="checked" attribution={{ source: 'OIG LEIE', asOf: null }} />);

// (c) A source answered "no record" — a finding, and never affirmative.
assertCompiles(
  <ProvenanceChip
    state="notFound"
    attribution={{ source: 'PECOS', asOf: '2026-07-14T09:12:00Z', detail: 'no row for this NPI' }}
  />,
);

// (d) Nobody was queried; the state names its own actor.
assertCompiles(<ProvenanceChip state="selfAttested" attribution={{ declared: 'entered by holder' }} />);

// (e) A vocabulary example, with illustrative provenance.
assertCompiles(
  <ProvenanceChip state="stale" attribution={{ legend: true, source: 'State board', detail: '214d ago' }} />,
);

// (f) A vocabulary example with nothing illustrative to show.
assertCompiles(<ProvenanceChip state="previewOnly" attribution={{ legend: true }} />);

// (g) The fail-closed register still takes ordinary attribution.
assertCompiles(
  <ProvenanceChip state="revoked" attribution={{ source: 'Issuer', asOf: '2026-06-30T00:00:00Z' }} />,
);

export {};
