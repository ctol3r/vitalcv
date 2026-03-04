'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Briefcase,
  Shield,
  Scale,
  Activity,
  Search,
  Globe,
} from 'lucide-react';

import { RevealOnScroll } from '@/components/interaction/RevealOnScroll';
import { Block } from '@/components/ui/Block';
import { ExpandableCard } from '@/components/knowledge/ExpandableCard';
import { KnowledgePanel } from '@/components/knowledge/KnowledgePanel';

const VerifierPortal = dynamic(
  () => import('@/components/employer/VerifierPortal').then((m) => ({ default: m.VerifierPortal })),
  { ssr: false },
);

export default function VerifierPage() {
  const [showPanel, setShowPanel] = useState(false);

  return (
    <main className="min-h-screen bg-[var(--ag-bg)] text-[var(--ag-text)]">
      {/* Header */}
      <section className="px-6 pt-28 pb-12">
        <div className="mx-auto max-w-6xl">
          <RevealOnScroll>
            <div className="text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--ag-primary)]/15 bg-[var(--ag-primary)]/5 px-4 py-1.5">
                <Briefcase className="h-3.5 w-3.5 text-[var(--ag-primary)]" />
                <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--ag-primary)]">
                  Employer Portal
                </span>
              </div>
              <h1
                className="font-heading font-bold tracking-tight text-[var(--ag-text)]"
                style={{ fontSize: 'var(--ag-text-hero)' }}
              >
                Verification Hub
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--ag-text-muted)]">
                Verify clinician credentials instantly. Review trust scores, decision capsules,
                and monitoring status — all in one place.
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
                <Block title="Verifier Portal" icon={<Search className="h-5 w-5" />}>
                  <VerifierPortal />
                </Block>
              </RevealOnScroll>

              <RevealOnScroll delay={0.1}>
                <Block title="Decision Capsules" icon={<Scale className="h-5 w-5" />}>
                  <div className="space-y-3">
                    {[
                      {
                        id: 'A-7291',
                        clinician: 'Dr. Sarah Chen',
                        status: 'Active',
                        color: 'bg-emerald-100 text-emerald-700',
                        date: '2026-02-28',
                      },
                      {
                        id: 'A-7312',
                        clinician: 'Dr. James Park',
                        status: 'Pending Review',
                        color: 'bg-amber-100 text-amber-700',
                        date: '2026-03-01',
                      },
                      {
                        id: 'A-7298',
                        clinician: 'Dr. Maria Santos',
                        status: 'Active',
                        color: 'bg-emerald-100 text-emerald-700',
                        date: '2026-02-25',
                      },
                    ].map((capsule) => (
                      <div
                        key={capsule.id}
                        className="flex items-center justify-between rounded-xl border border-[var(--ag-glass-border)] bg-[var(--ag-bg-alt)]/50 px-4 py-3 transition-all duration-200 hover:bg-[var(--ag-glass)] hover:shadow-[var(--ag-shadow-sm)]"
                      >
                        <div>
                          <p className="text-sm font-medium text-[var(--ag-text)]">
                            {capsule.clinician}
                          </p>
                          <p className="text-xs text-[var(--ag-text-subtle)]">
                            #{capsule.id} · {capsule.date}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${capsule.color}`}>
                          {capsule.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </Block>
              </RevealOnScroll>
            </div>

            {/* Sidebar */}
            <div className="w-full space-y-4 lg:w-80">
              <RevealOnScroll delay={0.2}>
                <Block
                  title="Entity Explorer"
                  icon={<Globe className="h-5 w-5" />}
                >
                  <p className="mb-3 text-sm text-[var(--ag-text-muted)]">
                    View how employers connect to decisions and clinician credentials.
                  </p>
                  <button
                    onClick={() => setShowPanel(!showPanel)}
                    className="text-sm font-medium text-[var(--ag-primary)] transition-colors hover:text-[var(--ag-primary-light)]"
                  >
                    {showPanel ? 'Hide graph →' : 'Explore graph →'}
                  </button>

                  {showPanel && (
                    <div className="mt-4">
                      <KnowledgePanel entityId="employer-mercy" />
                    </div>
                  )}
                </Block>
              </RevealOnScroll>

              <RevealOnScroll delay={0.3}>
                <ExpandableCard
                  title="Compliance Guidance"
                  icon={<Shield className="h-5 w-5" />}
                  summary="Best practices for verification"
                >
                  <div className="space-y-3 text-sm text-[var(--ag-text-muted)]">
                    <p>
                      <strong className="text-[var(--ag-text)]">Review decision capsules weekly.</strong>{' '}
                      Active capsules confirm that all underlying credentials are still valid.
                    </p>
                    <p>
                      <strong className="text-[var(--ag-text)]">Monitor revocation alerts.</strong>{' '}
                      If a credential is revoked, associated capsules cascade automatically.
                    </p>
                    <p>
                      <strong className="text-[var(--ag-text)]">Use blast-radius analysis.</strong>{' '}
                      Before onboarding, check what would be affected if any single credential changed.
                    </p>
                  </div>
                </ExpandableCard>
              </RevealOnScroll>

              <RevealOnScroll delay={0.4}>
                <ExpandableCard
                  title="Monitoring Status"
                  icon={<Activity className="h-5 w-5" />}
                  summary="Active watchers and alert status"
                >
                  <div className="space-y-2">
                    {[
                      { label: 'License Monitor', status: 'Active', dot: 'bg-emerald-500' },
                      { label: 'Exclusion Watcher', status: 'Active', dot: 'bg-emerald-500' },
                      { label: 'Board Cert Monitor', status: 'Active', dot: 'bg-emerald-500' },
                      { label: 'NPDB Scan', status: 'Scheduled', dot: 'bg-amber-500' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-sm">
                        <span className="text-[var(--ag-text-muted)]">{item.label}</span>
                        <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--ag-text)]">
                          <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
                          {item.status}
                        </span>
                      </div>
                    ))}
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
