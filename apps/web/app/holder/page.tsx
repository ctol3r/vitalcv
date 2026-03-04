'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  User,
  FileCheck2,
  Shield,
  Activity,
  TrendingUp,
  Globe,
} from 'lucide-react';

import { RevealOnScroll } from '@/components/interaction/RevealOnScroll';
import { Block } from '@/components/ui/Block';
import { ExpandableCard } from '@/components/knowledge/ExpandableCard';
import { KnowledgePanel } from '@/components/knowledge/KnowledgePanel';

const WalletDashboard = dynamic(
  () => import('@/components/clinician/WalletDashboard').then((m) => ({ default: m.WalletDashboard })),
  { ssr: false },
);
const ImpactPanel = dynamic(() => import('@/components/impact/ImpactPanel'), {
  ssr: false,
});

export default function HolderPage() {
  const [showPanel, setShowPanel] = useState(false);

  return (
    <main className="min-h-screen bg-[var(--ag-bg)] text-[var(--ag-text)]">
      {/* Header */}
      <section className="px-6 pt-28 pb-12">
        <div className="mx-auto max-w-6xl">
          <RevealOnScroll>
            <div className="text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--ag-primary)]/15 bg-[var(--ag-primary)]/5 px-4 py-1.5">
                <User className="h-3.5 w-3.5 text-[var(--ag-primary)]" />
                <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--ag-primary)]">
                  Clinician Portal
                </span>
              </div>
              <h1
                className="font-heading font-bold tracking-tight text-[var(--ag-text)]"
                style={{ fontSize: 'var(--ag-text-hero)' }}
              >
                Your Credential Wallet
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--ag-text-muted)]">
                One verified identity. Every employer accepts it. Real-time monitoring keeps it current.
              </p>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* Block sections */}
      <section className="px-6 pb-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Main content */}
            <div className="flex-1 space-y-6">
              <RevealOnScroll>
                <Block title="Wallet Dashboard" icon={<Shield className="h-5 w-5" />}>
                  <WalletDashboard />
                </Block>
              </RevealOnScroll>

              <RevealOnScroll delay={0.1}>
                <Block title="Impact & Trust Score" icon={<TrendingUp className="h-5 w-5" />}>
                  <ImpactPanel npi="1003000126" />
                </Block>
              </RevealOnScroll>
            </div>

            {/* Sidebar — Knowledge Panel + Guidance */}
            <div className="w-full space-y-4 lg:w-80">
              <RevealOnScroll delay={0.2}>
                <Block
                  title="Credential Graph"
                  icon={<Globe className="h-5 w-5" />}
                  className="cursor-pointer"
                >
                  <p className="mb-3 text-sm text-[var(--ag-text-muted)]">
                    View how your credentials connect to issuers and employers.
                  </p>
                  <button
                    onClick={() => setShowPanel(!showPanel)}
                    className="text-sm font-medium text-[var(--ag-primary)] transition-colors hover:text-[var(--ag-primary-light)]"
                  >
                    {showPanel ? 'Hide relationships →' : 'Explore relationships →'}
                  </button>

                  {showPanel && (
                    <div className="mt-4">
                      <KnowledgePanel entityId="clinician-001" />
                    </div>
                  )}
                </Block>
              </RevealOnScroll>

              <RevealOnScroll delay={0.3}>
                <ExpandableCard
                  title="Guidance"
                  icon={<Activity className="h-5 w-5" />}
                  summary="Tips for maintaining your trust score"
                >
                  <div className="space-y-3 text-sm text-[var(--ag-text-muted)]">
                    <p>
                      <strong className="text-[var(--ag-text)]">Keep licenses current.</strong>{' '}
                      Expiring credentials reduce your trust score and may trigger employer alerts.
                    </p>
                    <p>
                      <strong className="text-[var(--ag-text)]">Upload board certs early.</strong>{' '}
                      Board certification adds significant weight to your composite score.
                    </p>
                    <p>
                      <strong className="text-[var(--ag-text)]">Monitor alerts.</strong>{' '}
                      The daemon watches 24/7, but acting on alerts quickly shows employers you&apos;re proactive.
                    </p>
                  </div>
                </ExpandableCard>
              </RevealOnScroll>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
