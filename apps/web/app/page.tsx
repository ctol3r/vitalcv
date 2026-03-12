'use client';

import { FilterableTrustGraph } from '@/components/graph/FilterableTrustGraph';
import { KnowledgePanel } from '@/components/graph/KnowledgePanel';
import type { GraphNode } from '@/components/graph/TrustGraphPrimary';
import Footer from '@/components/Footer';
import { LiveTrustConsole } from '@/components/hero/LiveTrustConsole';
import { BentoGrid } from '@/components/marketing/BentoGrid';
import { LedgerTicker } from '@/components/marketing/LedgerTicker';
import { HowItWorksSection, MoneballSection, PlatformVisionSection, ProblemSection, TractionSection, WhyNowSection } from '@/components/marketing/HomeSections';
import { GraphExpansion, SectionReveal } from '@/components/motion/ScrollMotion';
import { GlobalTrustMap } from '@/components/network/GlobalTrustMap';
import { useState } from 'react';

export default function HomePage() {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  void selectedNode; // consumed by KnowledgePanel below

  return (
    <div style={{ background: '#080e1a' }} className="min-h-screen">
      {/* Hero — Void black, floating credentials, massive type */}
      <LiveTrustConsole />

      {/* Ledger Ticker */}
      <SectionReveal>
        <LedgerTicker />
      </SectionReveal>

      {/* Narrative arc: Problem → Solution → Thesis → Platform → Why Now → Traction */}
      <ProblemSection />
      <HowItWorksSection />
      <MoneballSection />
      <PlatformVisionSection />
      <WhyNowSection />
      <TractionSection />

      {/* Trust Network Graph — filterable, interactive */}
      <section className="px-6 py-20" style={{ background: '#080e1a' }}>
        <div className="mx-auto max-w-5xl">
          <SectionReveal>
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-4 py-1.5 mb-5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
                  Trust Graph
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white">
                The credential web, made visible
              </h2>
              <p className="text-sm text-white/35 mt-2 max-w-lg mx-auto">
                Filter by clinicians, issuers, credentials, or decisions.
                Search any node. Click to inspect connections.
                Every relationship is real and traceable.
              </p>
            </div>
          </SectionReveal>
          <GraphExpansion>
            <FilterableTrustGraph height={500} />
          </GraphExpansion>
        </div>
      </section>

      {/* Global Trust Map */}
      <section className="px-6 py-20" style={{ background: '#07101e' }}>
        <div className="mx-auto max-w-5xl">
          <SectionReveal>
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-white">
                VitalCV Trust Network
              </h2>
              <p className="text-sm text-white/35 mt-2 max-w-lg mx-auto">
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

      {/* Entry paths — Who are you? */}
      <section className="px-6 py-20" style={{ background: '#080e1a' }}>
        <div className="mx-auto max-w-4xl">
          <SectionReveal>
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/30 mb-3">Where would you like to start?</p>
              <h2 className="text-2xl font-bold text-white">Your path into VitalCV</h2>
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
                  border: 'border-emerald-500/20 hover:border-emerald-500/40',
                },
                {
                  href: '/verifier/home',
                  emoji: '🏥',
                  title: "I'm an Employer",
                  body: "Find prequalified clinicians, publish opportunities, and hire with confidence.",
                  cta: 'Go to employer dashboard',
                  border: 'border-blue-500/20 hover:border-blue-500/40',
                },
                {
                  href: '/workspace/switch',
                  emoji: '⚡',
                  title: "I'm Both",
                  body: "Keep clinician and employer personas active. Switch workspaces without re-logging in.",
                  cta: 'Choose a workspace',
                  border: 'border-purple-500/20 hover:border-purple-500/40',
                },
              ].map(({ href, emoji, title, body, cta, border }) => (
                <a
                  key={href}
                  href={href}
                  className={`group block rounded-2xl border bg-white/3 p-6 transition-all hover:bg-white/5 ${border}`}
                >
                  <span className="text-3xl" aria-hidden="true">{emoji}</span>
                  <p className="mt-4 font-semibold text-white">{title}</p>
                  <p className="mt-2 text-sm text-white/40 leading-relaxed">{body}</p>
                  <p className="mt-4 text-xs font-semibold text-white/50 group-hover:text-white transition-colors">{cta} →</p>
                </a>
              ))}
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* Bento Grid */}
      <div style={{ background: '#080e1a' }}>
        <SectionReveal>
          <BentoGrid />
        </SectionReveal>
      </div>

      {/* Knowledge Panel */}
      <KnowledgePanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />

      {/* Footer */}
      <div className="px-6" style={{ background: '#080e1a' }}>
        <Footer />
      </div>
    </div>
  );
}
