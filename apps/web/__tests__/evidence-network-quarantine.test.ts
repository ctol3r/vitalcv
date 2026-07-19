import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const WEB = resolve(process.cwd());
const read = (rel: string) => readFileSync(resolve(WEB, rel), 'utf8');

/**
 * SHD-0.3 (P0) — the legacy public force-directed knowledge graph must never
 * reach a public visitor: no synthetic clinician-like nodes, no physics/debug
 * controls, no claim that nodes are real people. These guard the quarantine.
 */
describe('SHD-0.3 — legacy public knowledge graph is quarantined', () => {
  for (const route of ['app/evidence-network/page.tsx', 'app/clinician/graph/page.tsx']) {
    describe(route, () => {
      const src = read(route);

      it('renders no synthetic clinician graph (does not import CareerGraph or its mount)', () => {
        expect(src).not.toMatch(/CareerGraph/);
        expect(src).not.toMatch(/EvidenceNetworkMount/);
        expect(src).not.toMatch(/career-graph/);
      });

      it('is a redirect to a truthful public surface, not a rendered graph', () => {
        expect(src).toMatch(/redirect\(/);
        expect(src).toMatch(/'\/trust'/);
      });

      it('exposes no force-layout / physics / debug controls', () => {
        for (const banned of ['Repel force', 'Link distance', 'Center force', 'Node size', 'GRAPH VIEW', 'illustrative structure']) {
          expect(src).not.toContain(banned);
        }
      });

      it('makes no claim that nodes represent real clinicians', () => {
        // No invented "Dr. …" node labels in the source.
        expect(src).not.toMatch(/Dr\.\s/);
      });
    });
  }

  it('the public mount that rendered the synthetic graph is gone', () => {
    expect(() => read('app/evidence-network/EvidenceNetworkMount.tsx')).toThrow();
  });

  it('the homepage no longer links to the legacy graph, and it is not a public self-chromed surface', () => {
    expect(read('app/HomePageClient.tsx')).not.toContain("href: '/evidence-network'");
    expect(read('components/layout/publicSurfaceRoutes.ts')).not.toContain("'/evidence-network'");
  });
});
