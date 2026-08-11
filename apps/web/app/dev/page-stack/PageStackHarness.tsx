'use client';

/**
 * Dev harness for the PageStack shell (G2).
 *
 * Public and env-gated (like /dev/matcha-deck) rather than under /holder,
 * because the holder layout is Clerk-gated and local dev / CI browsers cannot
 * cross it (production Clerk keys refuse localhost). It seeds provider-free
 * entity links (employer, evidence) so the pane stack, URL serialization, and
 * browser history can be exercised end to end without auth or a data provider.
 * The real opportunity pane is wired in the registry for product surfaces under
 * /holder; it is not seeded here because it needs the ClinicianMobile provider.
 */

import { useEffect } from 'react';

import { EntityLink } from '@/components/page-stack/EntityLink';
import { PageStack } from '@/components/page-stack/PageStack';
import { RelationshipDrawer } from '@/components/page-stack/RelationshipDrawer';
import { useEntityRelationships } from '@/hooks/useEntityRelationships';
import type { PaneKey } from '@/lib/page-stack/types';

const SEED_LINKS: readonly { key: PaneKey; label: string; relationship: string }[] = [
  { key: { type: 'employer', id: 'org_demo' }, label: 'Open an employer', relationship: 'offered_by' },
  { key: { type: 'evidence_claim', id: 'claim_demo' }, label: 'Open an evidence claim', relationship: 'backed_by' },
];

// A synthetic demo NPI (public evidence via /verify/:npi). Its evidence graph's
// real, typed relationships render in the drawer below; if it has none, the
// drawer shows its honest empty state — which is the expected result here.
//
// 1558395516 is check-digit-INVALID and absent from NPPES. It was 1003000126
// until 2026-08-10 — a real physician — which rendered that person's named
// record in a dev harness. Final digit (6) preserved: the sandbox connectors
// branch on it.
const DEMO_NPI = '1558395516';

function RelationshipsDemo() {
  const { state, load } = useEntityRelationships('clinician', DEMO_NPI);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={{ marginTop: 24 }}>
      <h2 className="mz-h3" style={{ marginBottom: 6 }}>
        Relationships
      </h2>
      <p style={{ opacity: 0.7, fontSize: 13, marginBottom: 10 }}>
        Bidirectional links from the clinician&apos;s real evidence graph — the same canonical edge,
        phrased for each direction.
      </p>
      <RelationshipDrawer
        outgoing={state.status === 'ready' ? state.data.outgoing : []}
        backlinks={state.status === 'ready' ? state.data.backlinks : []}
        loading={state.status === 'loading'}
      />
    </div>
  );
}

function HarnessRoot() {
  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <h1 className="mz-display" style={{ marginBottom: 8 }}>
        Page stack
      </h1>
      <p style={{ opacity: 0.75, marginBottom: 20 }}>
        Click a link to open its entity in a pane to the right. The stack is encoded in the URL —
        Back, Forward, refresh, and a shared link all restore it.
      </p>
      <nav aria-label="Seed entity links" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {SEED_LINKS.map(({ key, label, relationship }) => (
          <EntityLink
            key={`${key.type}:${key.id}`}
            entity={key}
            relationship={relationship}
            className="mz-chip mz-interactive"
          >
            {label}
          </EntityLink>
        ))}
      </nav>
      <RelationshipsDemo />
    </div>
  );
}

export function PageStackHarness() {
  return (
    <div className="mz mz-paper" data-page-stack-harness="true" style={{ minHeight: '100vh' }}>
      <PageStack root={<HarnessRoot />} />
    </div>
  );
}
