'use client';

import * as React from 'react';

import { getLaneSnapshots } from '@/lib/source-health/getLaneSnapshots';
import { LaneHealthSection } from './LaneHealthSection';

/**
 * Page-side mount wrapper. Uses the deterministic placeholder seed from
 * `getLaneSnapshots` until live probe results are wired in. Kept as its
 * own component so existing pages can drop this in with a one-line diff.
 */
export function LaneHealthMount({ heading }: { heading?: string }) {
  // Memoize so repeated renders don't shift `observedAt` strings.
  const snapshots = React.useMemo(() => getLaneSnapshots(), []);
  return <LaneHealthSection snapshots={snapshots} heading={heading} />;
}

export default LaneHealthMount;
