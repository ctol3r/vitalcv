'use client';

/**
 * JobDetailClient — full job detail page with match explanation,
 * missing requirements, and trust overview.
 *
 * Note: This uses demo data for marketing preview. In production,
 * job data would come from the API via server component props.
 */

import { StatusIcon } from '@/components/ui/status-icon';
import { TrustBar, type TrustSegment } from '@/components/ui/trust-bar';
import {
  MatchExplanation,
  DEMO_MATCH_CRITERIA,
} from '@/components/marketing/MatchExplanation';
import {
  MissingRequirements,
  DEMO_REQUIREMENT_GAPS,
} from '@/components/marketing/MissingRequirements';
import { ScrollSection, ScrollItem } from '@/components/motion/ScrollSection';
import { RoleCardHover } from '@/components/motion/RoleCardHover';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  MapPin,
  Shield,
} from 'lucide-react';
import Link from 'next/link';

/* ── Demo data ───────────────────────────────────────────────── */

interface DemoJob {
  title: string;
  facility: string;
  location: string;
  type: string;
  posted: string;
  salary: string;
  urgency: 'routine' | 'urgent' | 'critical';
  description: string;
  requirements: string[];
  matchScore: number;
  trustSegments: TrustSegment[];
}

const DEMO_JOBS: Record<string, DemoJob> = {
  'hospitalist-tx-001': {
    title: 'Hospitalist — Internal Medicine',
    facility: 'Memorial Hermann Health System',
    location: 'Houston, TX',
    type: 'Full-time',
    posted: '3 days ago',
    salary: '$280K–$340K',
    urgency: 'urgent',
    description:
      'Seeking a board-certified internist for our inpatient hospitalist program. 7-on/7-off schedule with competitive benefits. Must hold active Texas medical license and DEA registration.',
    requirements: [
      'Board certification in Internal Medicine (ABIM)',
      'Active, unrestricted Texas medical license',
      'DEA registration (Schedule II–V)',
      'No OIG/LEIE exclusions',
      'BLS/ACLS certification current',
      'Minimum 2 years hospitalist experience',
    ],
    matchScore: 87,
    trustSegments: [
      { label: 'Verified', value: 65, status: 'verified' },
      { label: 'Pending', value: 20, status: 'pending' },
      { label: 'Missing', value: 15, status: 'missing' },
    ],
  },
  'er-physician-ca-002': {
    title: 'Emergency Medicine Physician',
    facility: 'Cedars-Sinai Medical Center',
    location: 'Los Angeles, CA',
    type: 'Full-time',
    posted: '1 week ago',
    salary: '$320K–$400K',
    urgency: 'critical',
    description:
      'Level I trauma center seeking board-certified emergency medicine physician. High-acuity environment with teaching opportunities. California license required.',
    requirements: [
      'Board certification in Emergency Medicine (ABEM)',
      'Active California medical license',
      'ATLS, ACLS, PALS certifications',
      'DEA registration',
      'No malpractice history requiring disclosure',
    ],
    matchScore: 92,
    trustSegments: [
      { label: 'Verified', value: 80, status: 'verified' },
      { label: 'Pending', value: 12, status: 'pending' },
      { label: 'Missing', value: 8, status: 'missing' },
    ],
  },
  'internist-ny-003': {
    title: 'Internal Medicine — Outpatient',
    facility: 'NYU Langone Health',
    location: 'New York, NY',
    type: 'Full-time',
    posted: '5 days ago',
    salary: '$260K–$310K',
    urgency: 'routine',
    description:
      'Join our outpatient internal medicine practice in Midtown Manhattan. Panel of 1,800 patients with dedicated MA support. Academic appointment available.',
    requirements: [
      'Board certification in Internal Medicine',
      'Active New York medical license',
      'DEA registration',
      'No OIG/LEIE exclusions',
      'EMR proficiency (Epic preferred)',
    ],
    matchScore: 95,
    trustSegments: [
      { label: 'Verified', value: 85, status: 'verified' },
      { label: 'Pending', value: 10, status: 'pending' },
      { label: 'Missing', value: 5, status: 'missing' },
    ],
  },
};

const URGENCY_CONFIG = {
  routine: { label: 'Routine', status: 'verified' as const },
  urgent: { label: 'Urgent', status: 'warning' as const },
  critical: { label: 'Critical Need', status: 'missing' as const },
};

/* ── Component ───────────────────────────────────────────────── */

interface JobDetailClientProps {
  jobId: string;
}

export function JobDetailClient({ jobId }: JobDetailClientProps) {
  const job = DEMO_JOBS[jobId];

  if (!job) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-[var(--vt-text-primary)]">
          Job not found
        </h1>
        <p className="mt-2 text-[var(--vt-text-muted)]">
          The role you're looking for doesn't exist or has been filled.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--vt-accent)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </div>
    );
  }

  const urgency = URGENCY_CONFIG[job.urgency];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      {/* Back link */}
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--vt-text-muted)] hover:text-[var(--vt-text-secondary)] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All roles
      </Link>

      <ScrollSection className="space-y-8">
        {/* Job header */}
        <ScrollItem>
          <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <StatusIcon
                    status={urgency.status}
                    showLabel
                    label={urgency.label}
                    size="sm"
                  />
                  <span className="text-[10px] text-[var(--vt-text-muted)]">
                    &middot; Demo listing
                  </span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--vt-text-primary)] sm:text-3xl">
                  {job.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--vt-text-muted)]">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    {job.facility}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {job.location}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" />
                    {job.type}
                  </span>
                </div>
              </div>

              {/* Salary + posted */}
              <div className="flex flex-row gap-4 sm:flex-col sm:items-end sm:text-right">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--vt-text-primary)]">
                  <DollarSign className="h-4 w-4 text-[var(--vt-status-resolved)]" />
                  {job.salary}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--vt-text-muted)]">
                  <Calendar className="h-3 w-3" />
                  Posted {job.posted}
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="mt-5 text-sm leading-relaxed text-[var(--vt-text-secondary)] border-t border-[var(--vt-border)] pt-5">
              {job.description}
            </p>
          </div>
        </ScrollItem>

        {/* Two-column: requirements + trust bar */}
        <ScrollItem>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Requirements list */}
            <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-4 w-4 text-[var(--vt-accent)]" />
                <h2 className="text-sm font-semibold text-[var(--vt-text-primary)]">
                  Role Requirements
                </h2>
              </div>
              <ul className="space-y-2.5">
                {job.requirements.map((req) => (
                  <li
                    key={req}
                    className="flex items-start gap-2 text-xs text-[var(--vt-text-secondary)]"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--vt-text-muted)]" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>

            {/* Trust readiness */}
            <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[var(--vt-accent)]" />
                  <h2 className="text-sm font-semibold text-[var(--vt-text-primary)]">
                    Readiness Overview
                  </h2>
                </div>
                <span className="text-xl font-bold tabular-nums text-[var(--vt-text-primary)]">
                  {job.matchScore}%
                </span>
              </div>
              <TrustBar segments={job.trustSegments} className="mb-6" />

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3 border-t border-[var(--vt-border)] pt-4">
                {job.trustSegments.map((seg) => (
                  <div key={seg.label} className="text-center">
                    <span className="text-lg font-bold tabular-nums text-[var(--vt-text-primary)]">
                      {seg.value}%
                    </span>
                    <p className="text-[10px] text-[var(--vt-text-muted)]">
                      {seg.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollItem>

        {/* Match explanation */}
        <ScrollItem>
          <MatchExplanation
            criteria={DEMO_MATCH_CRITERIA}
            overallScore={job.matchScore}
          />
        </ScrollItem>

        {/* Missing requirements */}
        <ScrollItem>
          <MissingRequirements gaps={DEMO_REQUIREMENT_GAPS} />
        </ScrollItem>

        {/* CTA */}
        <ScrollItem>
          <RoleCardHover accentVar="--vt-status-resolved">
            <div className="text-center py-4">
              <h3 className="text-lg font-semibold text-[var(--vt-text-primary)]">
                Ready to apply?
              </h3>
              <p className="mt-2 text-sm text-[var(--vt-text-muted)] max-w-lg mx-auto">
                Enter your NPI to check your readiness against this role's
                requirements in seconds.
              </p>
              <Link
                href="/"
                className="mt-5 inline-flex items-center gap-2 border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-6 py-3 text-sm font-bold uppercase tracking-widest text-[var(--vt-text-primary)] hover:bg-[var(--vt-surface)] transition-colors"
              >
                Check my readiness
              </Link>
            </div>
          </RoleCardHover>
        </ScrollItem>
      </ScrollSection>
    </div>
  );
}
