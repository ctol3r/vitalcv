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

import { PaneLink } from '@/components/page-stack/PaneLink';
import { PageStack } from '@/components/page-stack/PageStack';
import type { PaneKey } from '@/lib/page-stack/types';

const SEED_LINKS: readonly { key: PaneKey; label: string }[] = [
  { key: { type: 'employer', id: 'org_demo' }, label: 'Open an employer' },
  { key: { type: 'evidence_claim', id: 'claim_demo' }, label: 'Open an evidence claim' },
];

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
        {SEED_LINKS.map(({ key, label }) => (
          <PaneLink key={`${key.type}:${key.id}`} paneKey={key} className="mz-chip mz-interactive">
            {label}
          </PaneLink>
        ))}
      </nav>
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
