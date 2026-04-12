'use client';

/**
 * JobsPreview — marketing section showing sample job cards with match scores.
 * Links to /jobs/[id] for full detail views.
 */

import { StatusIcon } from '@/components/ui/status-icon';
import { RoleCardHover } from '@/components/motion/RoleCardHover';
import { ScrollSection, ScrollItem } from '@/components/motion/ScrollSection';
import { ArrowRight, Briefcase, Building2, MapPin } from 'lucide-react';
import Link from 'next/link';

const PREVIEW_JOBS = [
  {
    id: 'hospitalist-tx-001',
    title: 'Hospitalist — Internal Medicine',
    facility: 'Memorial Hermann',
    location: 'Houston, TX',
    matchScore: 87,
    urgency: 'urgent' as const,
    tags: ['Board Cert', 'TX License', 'DEA'],
  },
  {
    id: 'er-physician-ca-002',
    title: 'Emergency Medicine Physician',
    facility: 'Cedars-Sinai',
    location: 'Los Angeles, CA',
    matchScore: 92,
    urgency: 'critical' as const,
    tags: ['ABEM', 'CA License', 'ATLS'],
  },
  {
    id: 'internist-ny-003',
    title: 'Internal Medicine — Outpatient',
    facility: 'NYU Langone',
    location: 'New York, NY',
    matchScore: 95,
    urgency: 'routine' as const,
    tags: ['Board Cert', 'NY License', 'Epic'],
  },
] as const;

const URGENCY_MAP = {
  routine: { label: 'Routine', status: 'verified' as const },
  urgent: { label: 'Urgent', status: 'warning' as const },
  critical: { label: 'Critical Need', status: 'missing' as const },
};

function scoreColor(score: number): string {
  if (score >= 90) return 'text-[var(--vt-status-resolved)]';
  if (score >= 75) return 'text-[var(--vt-severity-high)]';
  return 'text-[var(--vt-severity-critical)]';
}

export function JobsPreview() {
  return (
    <section className="border-t border-[var(--vt-border)] px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <ScrollSection className="space-y-10">
          {/* Header */}
          <ScrollItem>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-1.5 mb-5">
                <Briefcase className="h-3.5 w-3.5 text-[var(--vt-accent)]" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)]">
                  Open Roles
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--vt-text-primary)] leading-tight">
                See your readiness{' '}
                <span className="text-[var(--vt-accent)]">per role.</span>
              </h2>
              <p className="mt-4 text-[var(--vt-text-muted)] max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
                Each role checks your verified credentials against its specific
                requirements — so you know exactly where you stand before
                applying.
              </p>
            </div>
          </ScrollItem>

          {/* Job cards */}
          <ScrollItem>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PREVIEW_JOBS.map((job) => {
                const urgency = URGENCY_MAP[job.urgency];
                return (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <RoleCardHover className="h-full">
                      <div className="flex flex-col h-full">
                        {/* Urgency + score */}
                        <div className="flex items-center justify-between mb-3">
                          <StatusIcon
                            status={urgency.status}
                            showLabel
                            label={urgency.label}
                            size="sm"
                          />
                          <span
                            className={`text-lg font-bold tabular-nums ${scoreColor(job.matchScore)}`}
                          >
                            {job.matchScore}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-sm font-semibold text-[var(--vt-text-primary)] leading-snug">
                          {job.title}
                        </h3>

                        {/* Meta */}
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-1.5 text-[10px] text-[var(--vt-text-muted)]">
                            <Building2 className="h-3 w-3" />
                            {job.facility}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-[var(--vt-text-muted)]">
                            <MapPin className="h-3 w-3" />
                            {job.location}
                          </div>
                        </div>

                        {/* Tags */}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {job.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border border-[var(--vt-border)] text-[var(--vt-text-muted)] bg-[var(--vt-surface-dim)]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        {/* Link */}
                        <div className="mt-auto pt-4 flex items-center gap-1 text-[10px] font-medium text-[var(--vt-accent)]">
                          View details
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      </div>
                    </RoleCardHover>
                  </Link>
                );
              })}
            </div>
          </ScrollItem>
        </ScrollSection>
      </div>
    </section>
  );
}
