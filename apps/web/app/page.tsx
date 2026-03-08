'use client';

import { KnowledgePanel } from '@/components/graph/KnowledgePanel';
import type { GraphNode } from '@/components/graph/TrustGraphPrimary';
import { DEMO_EDGES, DEMO_NODES, TrustGraphPrimary } from '@/components/graph/TrustGraphPrimary';
import Footer from '@/components/Footer';
import { LiveTrustConsole } from '@/components/hero/LiveTrustConsole';
import { BentoGrid } from '@/components/marketing/BentoGrid';
import { LedgerTicker } from '@/components/marketing/LedgerTicker';
import { GraphExpansion, SectionReveal } from '@/components/motion/ScrollMotion';
import { GlobalTrustMap } from '@/components/network/GlobalTrustMap'; // Wave 96
import { BackgroundField } from '@/components/ui/BackgroundField';
import { useState } from 'react';

// ── Wave 68: Infrastructure Interface Redesign ────────────────
export default function HomePage() {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  return (
    <BackgroundField className="min-h-screen">
      {/* Hero — Live Trust Console */}
      <LiveTrustConsole />

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

      {/* Wave 181: Who are you? — Entry cards */}
      <section className="px-6 py-16 border-t border-border/30">
        <div className="mx-auto max-w-4xl">
          <SectionReveal>
            <div className="text-center mb-10">
              <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-2">Where would you like to start?</p>
              <h2 className="text-2xl font-semibold tracking-tight">Your path into VitalCV</h2>
            </div>
          </SectionReveal>
          <SectionReveal>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  href: '/holder/home',
                  emoji: '🩺',
                  title: "I'm a Clinician",
                  body: "Verify your credentials, build your trust passport, and get matched with roles.",
                  cta: 'Go to my workspace',
                  accent: 'border-trust-green/30 hover:border-trust-green/60',
                },
                {
                  href: '/verifier/home',
                  emoji: '🏥',
                  title: "I'm an Employer",
                  body: "Find prequalified clinicians, publish opportunities, and hire with confidence.",
                  cta: 'Go to employer dashboard',
                  accent: 'border-accent/30 hover:border-accent/60',
                },
                {
                  href: '/workspace/switch',
                  emoji: '⚡',
                  title: "I'm Both",
                  body: "Keep clinician and employer personas active. Switch workspaces without re-logging in.",
                  cta: 'Choose a workspace',
                  accent: 'border-claim-l2/30 hover:border-claim-l2/60',
                },
              ].map(({ href, emoji, title, body, cta, accent }) => (
                <a
                  key={href}
                  href={href}
                  className={`group block rounded-2xl border bg-card/60 p-6 transition-all hover:bg-card ${accent}`}
                >
                  <span className="text-3xl" aria-hidden="true">{emoji}</span>
                  <p className="mt-4 font-semibold text-card-foreground">{title}</p>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
                  <p className="mt-4 text-xs font-semibold text-primary group-hover:underline">{cta} →</p>
                </a>
              ))}
            </div>
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

      {/* Footer */}
      <div className="px-6">
        <Footer />
      </div>
    </BackgroundField>
  );
}
