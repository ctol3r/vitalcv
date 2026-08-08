/**
 * stateChipContract.check.tsx — compile-time proof of the W1082 contract.
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
 * Each @ts-expect-error is load-bearing in both directions: if StateChip ever
 * stops requiring attribution — the exact regression W1082 exists to prevent —
 * the suppression becomes unused and the build fails.
 */
import * as React from 'react';

import { StateChip } from '@/components/vital/StateChip';

declare function assertCompiles(node: React.ReactNode): void;

// A chip must state its attribution. Forgetting is a build failure, not a
// review comment.
assertCompiles(
  // @ts-expect-error — attribution is required at the type level (W1082)
  <StateChip state="checked" />,
);

// A source form cannot silently omit the as-of: null must be written, so
// "no timestamp" is always an explicit statement, never an accident.
assertCompiles(
  // @ts-expect-error — asOf is required inside a source attribution (W1082)
  <StateChip state="checked" attribution={{ source: 'NPPES' }} />,
);

// The legal forms, pinned so a widening of the union shows up in review.
assertCompiles(<StateChip state="source_backed" attribution={{ source: 'NPPES', asOf: 'Jul 15, 2026' }} />);
assertCompiles(<StateChip state="checked" attribution={{ source: 'OIG LEIE', asOf: null }} />);
assertCompiles(<StateChip state="self_attested" attribution="declared" />);
assertCompiles(<StateChip state="unavailable" attribution="legend" />);

export {};
