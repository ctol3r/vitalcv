'use client';

import { useState } from 'react';
import { BackgroundField } from '@/components/ui/BackgroundField';
import { SystemConsole } from '@/components/hero/SystemConsole';
import { TrustGraphPrimary, DEMO_NODES, DEMO_EDGES } from '@/components/graph/TrustGraphPrimary';
import type { GraphNode } from '@/components/graph/TrustGraphPrimary';
import { KnowledgePanel } from '@/components/graph/KnowledgePanel';
import { SectionReveal, GraphExpansion } from '@/components/motion/ScrollMotion';
import { LedgerTicker } from '@/components/marketing/LedgerTicker';
import { BentoGrid } from '@/components/marketing/BentoGrid';
import { GlobalTrustMap } from '@/components/network/GlobalTrustMap'; // Wave 96

// ── Wave 68: Infrastructure Interface Redesign ────────────────
export default function HomePage() {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  return (
    <BackgroundField className="min-h-screen">
      {/* Hero — System Console */}
      <SystemConsole />

      {/* Ledger Ticker */}
      <SectionReveal>
        <LedgerTicker />
      </SectionReveal>

      {/* Trust Graph — Primary Interface */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <SectionReveal>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold font-heading text-foreground">
                Trust Network
              </h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
                Interactive knowledge graph showing clinician credentials, issuing authorities,
                and clearance decisions. Click any node to explore.
              </p>
            </div>
          </SectionReveal>

          <GraphExpansion>
            <TrustGraphPrimary
              nodes={DEMO_NODES}
              edges={DEMO_EDGES}
              onNodeClick={setSelectedNode}
            />
          </GraphExpansion>
        </div>
      </section>

      {/* VitalCV Trust Network — Global Map (Wave 96) */}
      <section className="px-6 py-16 bg-infra-surface/50">
        <div className="mx-auto max-w-5xl">
          <SectionReveal>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold font-heading text-foreground">
                VitalCV Trust Network
              </h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
                Live view of every clinician, credentialing authority, verified credential,
                and hiring decision across the global trust fabric.
              </p>
            </div>
          </SectionReveal>
          <SectionReveal>
            <GlobalTrustMap height={440} />
          </SectionReveal>
        </div>
      </section>

      {/* Bento Grid */}
      <SectionReveal>
        <BentoGrid />
      </SectionReveal>

      {/* Knowledge Panel (slide-in on node click) */}
      <KnowledgePanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />
    </BackgroundField>
  );
}
