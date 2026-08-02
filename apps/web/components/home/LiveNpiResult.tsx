'use client';

/**
 * LiveNpiResult — the homepage "I watched it work" moment.
 *
 * When a clinician submits an NPI, the hero resolves the result IN PLACE
 * instead of routing away: a short progressive check sequence, then the real
 * NPPES identity and an honest breakdown of what each source returned.
 *
 * OWNERSHIP after Wave 3:
 *   - this file owns the FETCH and the phase (resolving / resolved / error);
 *   - `evidenceCapsuleModel` owns what the response is allowed to say;
 *   - `EvidenceCapsule` owns how it looks.
 * The three were one component, which is how a grouping claim ("Confirmed
 * today") ended up outranking the rows underneath it.
 *
 * Every value is REAL: `/api/identity/bootstrap/{npi}` (NPPES identity) and the
 * public `/api/trust-state/{npi}` (source-check states, blockers, next
 * actions). Nothing is fabricated, and — per the truth contract — no bare
 * "Verified". The identity header renders only registry-derived values
 * (`registryIdentity`): a registered account's self-entered display name never
 * appears under the "located in NPPES" framing.
 *
 * `registryIdentity` and `Bootstrap` moved to `evidence/evidenceCapsuleModel`
 * and are re-exported here — `live-npi-registry-identity.test.ts` pins that
 * import path, and the guard it protects is worth more than the tidier import.
 */

import * as React from 'react';

import { EvidenceCapsuleError, EvidenceCapsuleResolved, EvidenceCapsuleResolving } from '@/components/home/evidence/EvidenceCapsule';
import { buildEvidenceCapsule } from '@/components/home/evidence/evidenceCapsuleModel';
import {
  CHECK_SEQUENCE,
  SourceCheckNarration,
  useSourceCheckSequence,
  type TrustState,
} from '@/components/readiness/sourceCheckNarration';

export { registryIdentity } from '@/components/home/evidence/evidenceCapsuleModel';
export type { Bootstrap } from '@/components/home/evidence/evidenceCapsuleModel';

import type { Bootstrap } from '@/components/home/evidence/evidenceCapsuleModel';

export function LiveNpiResult({ npi, onReset }: { npi: string; onReset: () => void }) {
  const [boot, setBoot] = React.useState<Bootstrap | null>(null);
  const [trust, setTrust] = React.useState<TrustState | null>(null);
  const { step, phase, finish } = useSourceCheckSequence({ stepCount: CHECK_SEQUENCE.length });

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [bRes, tRes] = await Promise.all([
          fetch(`/api/identity/bootstrap/${npi}`, { cache: 'no-store' }),
          fetch(`/api/trust-state/${npi}`, { cache: 'no-store' }).catch(() => null),
        ]);
        if (!alive) return;
        if (!bRes.ok) {
          finish(false);
          return;
        }
        setBoot((await bRes.json()) as Bootstrap);
        // Trust-state is allowed to be absent: identity still resolved, and the
        // capsule renders every lane it did not hear from as unavailable rather
        // than silently dropping it.
        if (tRes && tRes.ok) setTrust((await tRes.json()) as TrustState);
        finish(true);
      } catch {
        if (alive) finish(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [npi, finish]);

  if (phase === 'error') {
    return <EvidenceCapsuleError npi={npi} onReset={onReset} />;
  }

  if (phase === 'resolving') {
    return (
      <EvidenceCapsuleResolving>
        <SourceCheckNarration step={step} />
      </EvidenceCapsuleResolving>
    );
  }

  return <EvidenceCapsuleResolved model={buildEvidenceCapsule(npi, boot, trust)} onReset={onReset} />;
}
