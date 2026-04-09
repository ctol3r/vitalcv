'use client';

/**
 * ReadinessPreview — preview card shown after NPI ingestion.
 *
 * Data priority:
 *   1. realState (ClinicianTrustState from /api/trust-state/:npi)
 *      → name, specialty, exclusion status, gaps, readiness from real artifacts
 *   2. Degraded fallback (when isDemo=true or backend unreachable)
 *      → preserve the entered NPI and show only limited preview structure
 *
 * Non-negotiables:
 *   - Identity claims render as checked only when backed by the live run
 *   - Exclusion claims render as checked only when backed by the live run
 *   - Gaps are surfaced directly from trustStateEngine output
 *   - Degraded fallback never substitutes a different clinician identity
 *   - Source names and checked timestamps shown where available
 */

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Accordion, type AccordionItem } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { ProofDetailsList } from '@/components/trust/ProofDetailsList';
import { EvidenceDisclosureCard } from '@/components/trust/EvidenceDisclosureCard';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCompactProofDate } from '@/lib/trust/proof-language';
import {
  getTrustStatusLabel,
} from '@/lib/trust/status-language';
import { TrustStatusBadge } from '@/components/ui/trust-status-badge';
import type { IngestStreamState } from '@/hooks/useIngestStream';

void React;

// ── Real trust-state shape (matches trustStateEngine output) ─

export interface CanonicalFact {
  factType:   string;
  source:     string;
  status:     string;
  verifiedAt?: string;
  expiresAt?:  string;
  details?:    string;
}

export interface ClinicianTrustState {
  npi:               string;
  identityVerified:  boolean;
  licensureStatus:   'verified' | 'pending' | 'expired' | 'unknown';
  exclusionClear:    boolean;
  exclusionStatus?:  'CLEAR' | 'EXCLUDED' | 'UNKNOWN';
  credentialCount:   number;
  readiness_level:   'L0' | 'L1' | 'L2' | 'L3';
  readiness_status:  string;
  readiness_score:   number;
  gap_summary:       string[];
  methodology_version: string;
  computed_at:       string;
  facts:             CanonicalFact[];
  gaps:              string[];
}

type ReadinessTone = 'checked' | 'pending' | 'blocked';

export type DegradedPreviewReason = 'backendUnavailable' | 'partialCoverage';
export type DegradedPreviewSourceStatus = 'waiting' | 'loading' | 'ok' | 'skipped' | 'failed';

export interface DegradedPreviewSources {
  nppes: DegradedPreviewSourceStatus;
  oig: DegradedPreviewSourceStatus;
  readiness: DegradedPreviewSourceStatus;
}

const READINESS_TONE_STYLES: Record<ReadinessTone, { panel: string }> = {
  checked: {
    panel: 'border-sky-500/15 bg-sky-500/[0.05]',
  },
  pending: {
    panel: 'border-amber-500/15 bg-amber-500/[0.05]',
  },
  blocked: {
    panel: 'border-rose-500/15 bg-rose-500/[0.06]',
  },
};

const READINESS_TONE_LABELS: Record<ReadinessTone, string> = {
  checked: 'Checked',
  pending: 'Pending',
  blocked: 'Blocked',
};

const READINESS_LEVEL_EXPLANATION: Record<string, string> = {
  'L0': 'Foundation — minimum evidence is missing. Not ready for credentialing decisions.',
  'L1': 'Provisional — some sources checked but gaps remain. Manual review required before proceeding.',
  'L2': 'Source-backed — key sources verified. Ready to proceed with noted caveats.',
  'L3': 'Trust-native — decision-grade evidence across all required sources.',
};

function resolveBlockerSeverity(blocker: string): 'critical' | 'high' | 'medium' {
  const lower = blocker.toLowerCase();
  if (lower.includes('excluded') || lower.includes('revoked') || lower.includes('blocked')) return 'critical';
  if (lower.includes('expired') || lower.includes('missing') || lower.includes('identity')) return 'high';
  return 'medium';
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'text-rose-300/80',
  high: 'text-amber-300/70',
  medium: 'text-foreground/50',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
};

const CHIPS_CLASSNAME =
  'rounded-full border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground';

function readinessBadgeStatus(tone: ReadinessTone): 'checked' | 'pending' | 'blocked' {
  switch (tone) {
    case 'checked':
      return 'checked';
    case 'blocked':
      return 'blocked';
    case 'pending':
    default:
      return 'pending';
  }
}

function buildConfirmedItems(ts: ClinicianTrustState): string[] {
  return [
    ts.identityVerified ? 'Identity checked' : null,
    ts.exclusionClear ? 'OIG / LEIE checked' : null,
    ts.licensureStatus === 'verified' ? 'Licensure checked' : null,
  ].filter((item): item is string => item !== null);
}

function resolveLiveReadinessTone(ts: ClinicianTrustState, gaps: string[]): ReadinessTone {
  if (
    ts.exclusionStatus === 'EXCLUDED'
    || ts.licensureStatus === 'expired'
    || /blocked/i.test(ts.readiness_status)
  ) {
    return 'blocked';
  }

  if (gaps.length === 0 && ts.identityVerified && ts.exclusionClear) {
    return 'checked';
  }

  return 'pending';
}

// ── Accordion builder — real facts ───────────────────────────

function formatFullDate(value?: string, fallback = 'Not checked in this run') {
  if (!value) return fallback;
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function accordionMeta(label: string) {
  return (
    <Badge
      variant="outline"
      className="rounded-full border-foreground/8 bg-card px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
    >
      {label}
    </Badge>
  );
}

function buildRealAccordion(ts: ClinicianTrustState): AccordionItem[] {
  const checkedAt = ts.computed_at;
  const checkedMeta = checkedAt ? `checked ${formatCompactProofDate(checkedAt)}` : 'not checked';
  const npiStatus: AccordionItem['status'] = ts.identityVerified ? 'checked' : 'pending';
  const licStatus: AccordionItem['status'] = ts.licensureStatus === 'verified' ? 'checked' : 'access_required';
  const exclStatus: AccordionItem['status'] = ts.exclusionClear
    ? 'checked'
    : ts.exclusionStatus === 'EXCLUDED'
      ? 'review_required'
      : 'pending';

  return [
    {
      id: 'identity',
      trigger: 'Identity Verification',
      triggerRight: accordionMeta(checkedMeta),
      status: npiStatus,
      content: (
        <ProofDetailsList
          rows={[
            { id: 'source', label: 'Source', value: 'CMS NPPES · NPI Registry', tone: 'strong' },
            { id: 'checked', label: 'Last checked', value: formatFullDate(checkedAt) },
            { id: 'freshness', label: 'Freshness', value: checkedAt ? 'Current run' : 'Not checked yet' },
            {
              id: 'trust-note',
              label: 'Trust note',
              value: ts.identityVerified
                ? 'Decision-grade identity evidence is attached from the public NPI registry.'
                : 'The current run found a registry record, but identity is not yet strong enough to anchor a stronger source-backed claim.',
            },
            {
              id: 'status-note',
              label: 'Status note',
              value: ts.identityVerified
                ? 'Identity can anchor the rest of this readiness snapshot.'
                : 'Identity must resolve cleanly before stronger trust claims can be relied on.',
              tone: 'muted',
            },
          ]}
        />
      ),
    },
    {
      id: 'licensure',
      trigger: 'State Licensure / Authority',
      triggerRight: accordionMeta(licStatus === 'checked' ? checkedMeta : 'access_required'),
      status: licStatus,
      content: (
        <ProofDetailsList
          rows={[
            {
              id: 'source',
              label: 'Source',
              value: licStatus === 'checked' ? 'Configured state board lane' : 'Configured state board lane required',
              tone: 'strong',
            },
            { id: 'checked', label: 'Last checked', value: formatFullDate(licStatus === 'checked' ? checkedAt : undefined) },
            {
              id: 'freshness',
              label: 'Freshness',
              value: licStatus === 'checked' ? 'Current run' : 'Institutional source required',
            },
            {
              id: 'trust-note',
              label: 'Trust note',
              value: licStatus === 'checked'
                ? 'Primary-source authority evidence is attached for this run.'
                : 'Licensure needs connected institutional source access before it can become decision-grade proof.',
            },
            {
              id: 'status-note',
              label: 'Status note',
              value: licStatus === 'checked'
                ? 'Authority coverage is present in this snapshot.'
                : 'Do not treat licensure as source-backed until a real board source has run.',
              tone: 'muted',
            },
          ]}
        />
      ),
    },
    {
      id: 'sanctions',
      trigger: 'Sanctions & Exclusions',
      triggerRight: accordionMeta(checkedMeta),
      status: exclStatus,
      content: (
        <ProofDetailsList
          rows={[
            { id: 'source', label: 'Source', value: 'OIG / LEIE', tone: 'strong' },
            { id: 'checked', label: 'Last checked', value: formatFullDate(checkedAt) },
            { id: 'freshness', label: 'Freshness', value: checkedAt ? 'Current run' : 'Not checked yet' },
            {
              id: 'trust-note',
              label: 'Trust note',
              value: ts.exclusionClear
                ? 'The current OIG LEIE check returned no exclusion finding.'
                : 'This run does not attach enough evidence to mark sanctions as checked.',
            },
            {
              id: 'status-note',
              label: 'Status note',
              value: ts.exclusionClear
                ? 'The current OIG / LEIE result is attached to this readiness snapshot.'
                : 'Without a checked result, sanctions still need more source coverage before stronger trust claims can be made.',
              tone: 'muted',
            },
          ]}
        />
      ),
    },
  ];
}

function buildDegradedAccordion(
  sources: DegradedPreviewSources,
  reason: DegradedPreviewReason,
): AccordionItem[] {
  const accessRequiredMeta = accordionMeta('access required');
  const unavailableMeta = accordionMeta('unavailable');
  const nppesChecked = sources.nppes === 'ok';
  const oigChecked = sources.oig === 'ok';
  const degradedReasonCopy =
    reason === 'backendUnavailable'
      ? 'The readiness service could not be reached during this lookup.'
      : 'The live lookup started, but the full readiness snapshot did not finish loading.';

  return [
    {
      id: 'identity',
      trigger: 'Identity Verification',
      triggerRight: nppesChecked ? accordionMeta('checked in this lookup') : unavailableMeta,
      status: nppesChecked ? 'checked' : 'unavailable',
      content: (
        <ProofDetailsList
          rows={[
            { id: 'source', label: 'Source', value: 'CMS NPPES · NPI Registry', tone: 'strong' },
            { id: 'checked', label: 'Last checked', value: nppesChecked ? 'Current homepage lookup' : 'Not available in this lookup' },
            { id: 'freshness', label: 'Freshness', value: nppesChecked ? 'Current run' : 'Retry required' },
            {
              id: 'trust-note',
              label: 'Trust note',
              value: nppesChecked
                ? 'NPPES responded for this NPI, but VitalCV did not finish loading a resolved clinician profile.'
                : degradedReasonCopy,
            },
            {
              id: 'status-note',
              label: 'Status note',
              value: nppesChecked
                ? 'The entered NPI is preserved, but clinician identity details stay hidden until a full live run completes.'
                : 'Do not treat identity as source-backed until a live retry completes.',
              tone: 'muted',
            },
          ]}
        />
      ),
    },
    {
      id: 'licensure',
      trigger: 'State Licensure / Authority',
      triggerRight: accessRequiredMeta,
      status: 'access_required',
      content: (
        <ProofDetailsList
          rows={[
            { id: 'source', label: 'Source', value: 'Configured state board lane required', tone: 'strong' },
            { id: 'checked', label: 'Last checked', value: formatFullDate(undefined) },
            { id: 'freshness', label: 'Freshness', value: 'No checked source attached' },
            {
              id: 'trust-note',
              label: 'Trust note',
              value: 'Live licensure proof depends on a connected state board lane with source-backed coverage.',
            },
            {
              id: 'status-note',
              label: 'Status note',
              value: 'This preview keeps licensure explicitly gated until a connected source is available.',
              tone: 'muted',
            },
          ]}
        />
      ),
    },
    {
      id: 'pecos',
      trigger: 'Medicare Enrollment',
      triggerRight: unavailableMeta,
      status: 'unavailable',
      content: (
        <ProofDetailsList
          rows={[
            { id: 'source', label: 'Source', value: 'CMS PECOS', tone: 'strong' },
            { id: 'checked', label: 'Last checked', value: 'Not available in this lookup' },
            { id: 'freshness', label: 'Freshness', value: 'Retry required' },
            {
              id: 'trust-note',
              label: 'Trust note',
              value: 'PECOS did not return a live enrollment result for this degraded lookup.',
            },
            {
              id: 'status-note',
              label: 'Status note',
              value: 'PECOS stays unavailable until passport can complete a live retry.',
              tone: 'muted',
            },
          ]}
        />
      ),
    },
    {
      id: 'sanctions',
      trigger: 'Sanctions & Exclusions',
      triggerRight: oigChecked ? accordionMeta('checked in this lookup') : unavailableMeta,
      status: oigChecked ? 'checked' : 'unavailable',
      content: (
        <ProofDetailsList
          rows={[
            { id: 'source', label: 'Source', value: 'OIG / LEIE', tone: 'strong' },
            { id: 'checked', label: 'Last checked', value: oigChecked ? 'Current homepage lookup' : 'Not available in this lookup' },
            { id: 'freshness', label: 'Freshness', value: oigChecked ? 'Current run' : 'Retry required' },
            {
              id: 'trust-note',
              label: 'Trust note',
              value: oigChecked
                ? 'OIG / LEIE responded in this lookup, but VitalCV could not finish the full readiness snapshot.'
                : degradedReasonCopy,
            },
            {
              id: 'status-note',
              label: 'Status note',
              value: oigChecked
                ? 'This preview does not attach a clinician-level exclusion conclusion until passport completes a live retry.'
                : 'Unavailable lanes stay unavailable instead of pending when the backend is degraded.',
              tone: 'muted',
            },
          ]}
        />
      ),
    },
  ];
}

// ── Component ─────────────────────────────────────────────────

interface Props {
  npi:        string;
  realState:  ClinicianTrustState | null;
  isDemo:     boolean;
  visible:    boolean;
  onContinue: () => void;
  fallbackReason?: DegradedPreviewReason | null;
  fallbackSources?: DegradedPreviewSources | null;
  streamState?: IngestStreamState | null;
  continueDisabled?: boolean;
  continueLabel?: string;
}

function resolveLiveLicenseStatus(streamState: IngestStreamState) {
  if (streamState.phase === 'error' && !streamState.isUsable) {
    return {
      badgeStatus: 'unavailable' as const,
      badgeLabel: 'Unavailable',
      accordionStatus: 'unavailable' as const,
      metaLabel: 'unavailable',
      freshness: 'Live retry required',
      note: 'A connected state board lane is still required before authority becomes decision-grade.',
    };
  }

  if (streamState.completedAt || streamState.readyAt || streamState.isUsable) {
    return {
      badgeStatus: 'access_required' as const,
      badgeLabel: 'Access required',
      accordionStatus: 'access_required' as const,
      metaLabel: 'access required',
      freshness: 'Institutional source required',
      note: 'This live run did not expose source-backed authority proof. Keep licensure incomplete until a connected state board lane runs.',
    };
  }

  return {
    badgeStatus: 'pending' as const,
    badgeLabel: 'Pending',
    accordionStatus: 'pending' as const,
    metaLabel: 'pending',
    freshness: 'Waiting for source coverage',
    note: 'VitalCV is still resolving whether a connected state board lane is available for this clinician.',
  };
}

function buildLiveAccordion(streamState: IngestStreamState): AccordionItem[] {
  const checkedAt = streamState.readiness.checkedAt ?? streamState.readyAt ?? streamState.completedAt ?? streamState.startedAt;
  const identityStatus: AccordionItem['status'] =
    streamState.sources.nppes === 'error'
      ? 'unavailable'
      : streamState.identity.authoritative
        ? 'checked'
        : streamState.sources.nppes === 'done'
          ? 'review_required'
          : 'pending';
  const sanctionsStatus: AccordionItem['status'] =
    streamState.sources.oig === 'error'
      ? 'unavailable'
      : streamState.standing.exclusionStatus === 'EXCLUDED' || streamState.standing.exclusionStatus === 'POSSIBLE_MATCH'
        ? 'review_required'
        : streamState.standing.exclusionChecked && streamState.standing.exclusionClear
          ? 'checked'
          : streamState.sources.oig === 'done'
            ? 'pending'
            : 'pending';
  const enrollmentStatus: AccordionItem['status'] =
    streamState.sources.pecos === 'error'
      ? 'unavailable'
      : streamState.standing.enrollmentStatus === 'NOT_FOUND' || streamState.standing.enrollmentStatus === 'OPTED_OUT'
        ? 'review_required'
        : streamState.standing.enrollmentChecked && streamState.standing.enrollmentStatus === 'ENROLLED'
          ? 'checked'
          : streamState.sources.pecos === 'done'
            ? 'pending'
            : 'pending';
  const license = resolveLiveLicenseStatus(streamState);

  return [
    {
      id: 'identity',
      trigger: 'Identity Verification',
      triggerRight: accordionMeta(
        identityStatus === 'checked'
          ? `checked ${formatCompactProofDate(checkedAt)}`
          : streamState.sources.nppes === 'error'
            ? 'unavailable'
            : 'pending',
      ),
      status: identityStatus,
      content: (
        <ProofDetailsList
          rows={[
            { id: 'source', label: 'Source', value: 'NPPES', tone: 'strong' },
            ...(streamState.identity.displayName ? [
              { id: 'name', label: 'Verified name', value: streamState.identity.displayName },
              { id: 'entity-type', label: 'Entity type', value: streamState.identity.npiType === 'TYPE_2' ? 'Organization (Type 2)' : 'Individual (Type 1)' },
            ] : []),
            ...(streamState.identity.credentials ? [
              { id: 'credentials', label: 'Credentials', value: streamState.identity.credentials },
            ] : []),
            ...(streamState.identity.specialty ? [
              { id: 'taxonomy', label: 'Primary taxonomy', value: streamState.identity.specialty },
            ] : []),
            ...(streamState.identity.status ? [
              { id: 'npi-status', label: 'NPI status', value: streamState.identity.status },
            ] : []),
            ...(streamState.identity.enumerationDate ? [
              { id: 'enumeration-date', label: 'Enumeration date', value: streamState.identity.enumerationDate },
            ] : []),
            ...(streamState.identity.address ? [
              { id: 'address', label: 'Practice location', value: `${streamState.identity.address.city}, ${streamState.identity.address.state}` },
            ] : []),
            { id: 'checked', label: 'Last checked', value: formatFullDate(checkedAt) },
            {
              id: 'freshness',
              label: 'Freshness',
              value: checkedAt ? 'Current live run' : 'Waiting for source response',
            },
            {
              id: 'trust-note',
              label: 'Trust note',
              value: streamState.identity.authoritative
                ? 'NPPES has returned a source-backed provider identity for this run.'
                : 'Identity remains provisional until the live NPPES response resolves cleanly.',
            },
          ]}
        />
      ),
    },
    {
      id: 'licensure',
      trigger: 'State Licensure / Authority',
      triggerRight: accordionMeta(license.metaLabel),
      status: license.accordionStatus,
      content: (
        <ProofDetailsList
          rows={[
            { id: 'source', label: 'Source', value: 'Configured state board lane', tone: 'strong' },
            { id: 'checked', label: 'Last checked', value: formatFullDate(undefined) },
            { id: 'freshness', label: 'Freshness', value: license.freshness },
            { id: 'trust-note', label: 'Trust note', value: license.note },
          ]}
        />
      ),
    },
    {
      id: 'sanctions',
      trigger: 'Sanctions & Exclusions',
      triggerRight: accordionMeta(
        sanctionsStatus === 'checked'
          ? `checked ${formatCompactProofDate(checkedAt)}`
          : streamState.sources.oig === 'error'
            ? 'unavailable'
            : 'pending',
      ),
      status: sanctionsStatus,
      content: (
        <ProofDetailsList
          rows={[
            { id: 'source', label: 'Source', value: 'OIG / LEIE', tone: 'strong' },
            { id: 'checked', label: 'Last checked', value: formatFullDate(checkedAt) },
            {
              id: 'freshness',
              label: 'Freshness',
              value: checkedAt ? 'Current live run' : 'Waiting for source response',
            },
            {
              id: 'trust-note',
              label: 'Trust note',
              value: streamState.standing.exclusionChecked
                ? streamState.standing.exclusionClear
                  ? 'The current OIG / LEIE check is clear in this live run.'
                  : `The current OIG / LEIE result needs attention: ${streamState.standing.exclusionStatus ?? 'review required'}.`
                : 'The current OIG / LEIE result is still loading.',
            },
          ]}
        />
      ),
    },
    {
      id: 'pecos',
      trigger: 'Medicare Enrollment',
      triggerRight: accordionMeta(
        enrollmentStatus === 'checked'
          ? `checked ${formatCompactProofDate(checkedAt)}`
          : streamState.sources.pecos === 'error'
            ? 'unavailable'
            : 'pending',
      ),
      status: enrollmentStatus,
      content: (
        <ProofDetailsList
          rows={[
            { id: 'source', label: 'Source', value: 'CMS PECOS', tone: 'strong' },
            { id: 'checked', label: 'Last checked', value: formatFullDate(checkedAt) },
            {
              id: 'freshness',
              label: 'Freshness',
              value: checkedAt ? 'Current live run' : 'Waiting for source response',
            },
            {
              id: 'trust-note',
              label: 'Trust note',
              value: streamState.standing.enrollmentChecked
                ? streamState.standing.enrollmentStatus === 'ENROLLED'
                  ? 'CMS PECOS has returned an enrolled record in this live run.'
                  : `CMS PECOS returned ${streamState.standing.enrollmentStatus ?? 'an unresolved status'} in this live run.`
                : 'CMS PECOS is still loading for this clinician.',
            },
          ]}
        />
      ),
    },
  ];
}

export function ReadinessPreview({
  npi,
  realState,
  isDemo,
  visible,
  onContinue,
  fallbackReason = null,
  fallbackSources = null,
  streamState = null,
  continueDisabled = false,
  continueLabel = 'Continue to passport',
}: Props) {
  useEffect(() => {
    if (visible && typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture('Readiness_Viewed', { npi, isDemo });
    }
  }, [visible, npi, isDemo]);

  const checkedLabel = getTrustStatusLabel('checked');
  const pendingLabel = getTrustStatusLabel('pending');
  const accessRequiredLabel = getTrustStatusLabel('access_required');
  const reviewRequiredLabel = getTrustStatusLabel('review_required');
  const unavailableLabel = getTrustStatusLabel('unavailable');
  // ── Real-data path ───────────────────────────────────────
  if (realState && !isDemo) {
    const ts            = realState;
    const accordionItems = buildRealAccordion(ts);
    const checkedTime   = new Date(ts.computed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    // Extract name from facts
    const identityFact = ts.facts.find(f => f.factType === 'PERSONAL_IDENTITY' || f.factType === 'NPI_IDENTITY');
    const displayName  = identityFact?.details ?? `NPI ${ts.npi}`;

    // Specialty from facts
    const specFact    = ts.facts.find(f => f.factType === 'SPECIALTY');
    const displaySpec = specFact?.details ?? 'Provider';

    // Readable gaps
    const gaps = ts.gap_summary.length > 0 ? ts.gap_summary : ts.gaps;
    const confirmedItems = buildConfirmedItems(ts);
    const readinessTone = resolveLiveReadinessTone(ts, gaps);

    return (
      <div
        className="mt-4 transition-[opacity,transform] duration-[180ms] ease-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(6px)' }}
        aria-live="polite"
      >
        <Card className="overflow-hidden rounded-2xl border-foreground/8 bg-foreground/[0.04] py-0 shadow-none">
          <CardHeader className="border-b border-foreground/6 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {ts.identityVerified ? 'Identity checked' : 'Identity record found'}
                </p>
                <p className="text-lg font-bold leading-tight text-foreground">{displayName}</p>
                <p className="text-sm text-muted-foreground">{displaySpec}</p>
              </div>
              <div className="space-y-2 text-right">
                <TrustStatusBadge
                  status={readinessBadgeStatus(readinessTone)}
                  label={READINESS_TONE_LABELS[readinessTone]}
                  size="sm"
                />
                <p className="text-[10px] font-mono text-muted-foreground/40">Checked {checkedTime}</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 px-5 py-4">
            <div className={cn('rounded-xl border px-4 py-4', READINESS_TONE_STYLES[readinessTone].panel)}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Readiness</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{ts.readiness_status}</p>
                  <p className="mt-1 text-[11px] text-foreground">{ts.readiness_score}/100 · {ts.readiness_level}</p>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground sm:max-w-[220px] sm:text-right">
                  Source-backed checks strengthen this snapshot. Missing or gated lanes stay visibly incomplete.
                </p>
              </div>
            </div>

            {/* Per-source status summary */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/25">Source coverage</p>
              {[
                { id: 'npi', label: 'NPI Registry (NPPES)', ok: ts.identityVerified },
                { id: 'oig', label: 'OIG / LEIE Exclusions', ok: ts.exclusionClear },
                { id: 'lic', label: 'State Licensure', ok: ts.licensureStatus === 'verified' },
                { id: 'pecos', label: 'CMS PECOS Enrollment', ok: false },
                { id: 'board', label: 'Board Certification (ABMS)', ok: false },
              ].map(src => (
                <div key={src.id} className="flex items-center justify-between rounded-lg border border-foreground/6 bg-foreground/10 px-3 py-2">
                  <span className="text-xs text-foreground/55">{src.label}</span>
                  <TrustStatusBadge
                    status={src.ok ? 'checked' : (src.id === 'pecos' || src.id === 'board') ? 'access_required' : 'pending'}
                    label={src.ok ? 'Checked' : (src.id === 'pecos' || src.id === 'board') ? 'Access required' : 'Pending'}
                    size="sm"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">
                {gaps.length === 0 ? 'Current blockers' : 'What still needs attention'}
              </p>
              <div className="space-y-2">
                {gaps.length === 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-sm leading-none shrink-0">✔</span>
                    <span className="text-xs text-foreground">No blockers surfaced in this run.</span>
                  </div>
                ) : gaps.slice(0, 3).map(gap => (
                  <div key={gap} className="flex items-start gap-2">
                    <span className="mt-px shrink-0 text-sm leading-none text-muted-foreground/50">✖</span>
                    <span className="text-xs leading-tight text-foreground">{gap}</span>
                  </div>
                ))}
              </div>
              {confirmedItems.length > 0 ? (
                <div className="space-y-3 border-t border-foreground/6 pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">Checked in this run</p>
                  <div className="flex flex-wrap gap-2">
                    {confirmedItems.map(item => (
                      <Badge key={item} variant="outline" className={CHIPS_CLASSNAME}>
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <EvidenceDisclosureCard
              eyebrow="Proof"
              title="Source checks"
              description="Expand each section to see where the snapshot is checked, access required, or still missing."
              className="rounded-xl border-foreground/6 bg-muted"
              contentClassName="px-5 py-1"
            >
              <Accordion
                items={accordionItems}
                telemetryComponentId="homepage_readiness_proof"
              />
            </EvidenceDisclosureCard>
          </CardContent>

          <CardFooter className="border-t border-foreground/6 px-5 py-4">
            <div className="w-full rounded-2xl border border-foreground/6 bg-foreground/15 p-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/30">Next step</p>
                <p className="mt-1 text-sm font-medium text-foreground/70">Carry this snapshot into your passport.</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground/70">
                  {checkedLabel} sections stay attached. {pendingLabel}, {accessRequiredLabel}, {reviewRequiredLabel}, and {unavailableLabel} sections remain visible.
                </p>
              </div>
              <Button
                type="button"
                variant="success"
                onClick={onContinue}
                disabled={continueDisabled}
                className="mt-4 h-14 w-full rounded-xl px-5 text-sm font-semibold"
              >
                {continueLabel}
              </Button>
              <p className="mt-2 text-center text-[10px] text-muted-foreground/40">
                Source-backed preview · {ts.methodology_version}
              </p>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (streamState && !isDemo) {
    const displayName = streamState.identity.displayName ?? `NPI ${npi}`;
    const displaySpec = streamState.identity.specialty ?? 'Resolving provider profile';
    const liveScoreKnown = typeof streamState.readiness.score === 'number'
      && (streamState.readiness.claimCount ?? 0) > 0;
    const liveTone: ReadinessTone =
      streamState.phase === 'error' && !streamState.isUsable
        ? 'blocked'
        : liveScoreKnown && (streamState.readiness.blockerCount ?? 0) === 0 && streamState.identity.authoritative
          ? 'checked'
          : 'pending';
    const liveAccordion = buildLiveAccordion(streamState);
    const checkedItems = [
      streamState.identity.authoritative ? 'Identity checked' : null,
      streamState.standing.exclusionChecked && streamState.standing.exclusionClear ? 'OIG / LEIE checked' : null,
      streamState.standing.enrollmentChecked && streamState.standing.enrollmentStatus === 'ENROLLED' ? 'CMS PECOS checked' : null,
    ].filter((item): item is string => item !== null);
    const blockerCount = streamState.readiness.blockerCount;
    const attentionItems =
      blockerCount && blockerCount > 0
        ? [`${blockerCount} blocker${blockerCount === 1 ? '' : 's'} still unresolved in this live run.`]
        : liveScoreKnown
          ? ['No blockers surfaced yet in this live run.']
          : ['Waiting for blocker and readiness detail from the live source run.'];

    return (
      <div
        className="mt-4 transition-[opacity,transform] duration-[180ms] ease-out"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(6px)' }}
        aria-live="polite"
      >
        <Card className="overflow-hidden rounded-2xl border-foreground/8 bg-foreground/[0.04] py-0 shadow-none">
          <CardHeader className="border-b border-foreground/6 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Live readiness
                </p>
                <p className="text-lg font-bold leading-tight text-foreground">{displayName}</p>
                <p className="text-sm text-muted-foreground">{displaySpec}</p>
              </div>
              <div className="space-y-2 text-right">
                <TrustStatusBadge
                  status={readinessBadgeStatus(liveTone)}
                  label={READINESS_TONE_LABELS[liveTone]}
                  size="sm"
                />
                <p className="text-[10px] font-mono text-muted-foreground/40">
                  {streamState.readiness.checkedAt
                    ? `Checked ${new Date(streamState.readiness.checkedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                    : 'Live run in progress'}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 px-5 py-4">
            <div className={cn('rounded-xl border px-4 py-4', READINESS_TONE_STYLES[liveTone].panel)}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Readiness</p>
                  {liveScoreKnown ? (
                    <>
                      <p className="mt-2 text-sm font-semibold text-foreground">
                        {streamState.readiness.status ?? 'Source-backed snapshot in progress'}
                      </p>
                      <p className="mt-1 text-[11px] text-foreground">
                        {streamState.readiness.score}/100 · {streamState.readiness.level ?? 'L0'}
                      </p>
                    </>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <Skeleton className="h-4 w-44 rounded-full" />
                      <Skeleton className="h-3 w-28 rounded-full" />
                    </div>
                  )}
                </div>
                <div className="sm:max-w-[220px] sm:text-right">
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Source-backed lanes update as the live ingest stream completes. Missing or gated lanes stay visibly incomplete.
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/50">
                    Claims: {streamState.readiness.claimCount ?? streamState.readiness.credentialCount ?? '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">
                What still needs attention
              </p>
              <div className="space-y-2">
                {attentionItems.map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="mt-px shrink-0 text-sm leading-none text-muted-foreground/50">
                      {item.startsWith('No blockers') ? '✔' : '✖'}
                    </span>
                    <span className="text-xs leading-tight text-foreground">{item}</span>
                  </div>
                ))}
              </div>
              {checkedItems.length > 0 ? (
                <div className="space-y-3 border-t border-foreground/6 pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">Checked in this run</p>
                  <div className="flex flex-wrap gap-2">
                    {checkedItems.map(item => (
                      <Badge key={item} variant="outline" className={CHIPS_CLASSNAME}>
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <EvidenceDisclosureCard
              eyebrow="Proof"
              title="Source checks"
              description="Expand each section to see what is checked, pending, access required, or unavailable in the live run."
              className="rounded-xl border-foreground/6 bg-muted"
              contentClassName="px-5 py-1"
            >
              <Accordion
                items={liveAccordion}
                telemetryComponentId="homepage_readiness_proof"
              />
            </EvidenceDisclosureCard>
          </CardContent>

          <CardFooter className="border-t border-foreground/6 px-5 py-4">
            <div className="w-full rounded-2xl border border-foreground/6 bg-foreground/15 p-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/30">Next step</p>
                <p className="mt-1 text-sm font-medium text-foreground/70">
                  {continueDisabled
                    ? 'Stay on this page while VitalCV completes the live source run.'
                    : streamState.isUsable
                      ? 'Passport is ready to open.'
                      : 'Continue to passport with the current live state.'}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground/70">
                  {checkedLabel} lanes stay attached. {pendingLabel}, {accessRequiredLabel}, {reviewRequiredLabel}, and {unavailableLabel} remain explicit until better source coverage exists.
                </p>
              </div>
              <Button
                type="button"
                variant="success"
                onClick={onContinue}
                disabled={continueDisabled}
                className="mt-4 h-14 w-full rounded-xl px-5 text-sm font-semibold"
              >
                {continueLabel}
              </Button>
              <p className="mt-2 text-center text-[10px] text-muted-foreground/40">
                Live stream · only source-backed claims are promoted automatically
              </p>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // ── Degraded fallback path ───────────────────────────────
  const degradedReason = fallbackReason ?? 'partialCoverage';
  const degradedSources: DegradedPreviewSources = fallbackSources ?? {
    nppes: 'skipped',
    oig: 'skipped',
    readiness: 'failed',
  };
  const attentionItems =
    degradedReason === 'backendUnavailable'
      ? [
          'VitalCV could not reach the readiness service for this lookup.',
          'No clinician identity is shown until a live retry resolves this NPI.',
        ]
      : [
          'VitalCV preserved the entered NPI, but the full readiness snapshot did not finish loading.',
          'Unavailable lanes will retry on passport instead of showing a placeholder clinician.',
        ];
  const checkedItems = [
    degradedSources.nppes === 'ok' ? 'NPPES checked in this lookup' : null,
    degradedSources.oig === 'ok' ? 'OIG / LEIE checked in this lookup' : null,
  ].filter((item): item is string => item !== null);
  const accordion = buildDegradedAccordion(degradedSources, degradedReason);

  return (
    <div
      className="mt-4 transition-[opacity,transform] duration-[180ms] ease-out"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(6px)' }}
      aria-live="polite"
    >
      <Card className="overflow-hidden rounded-2xl border-foreground/8 bg-foreground/[0.04] py-0 shadow-none">
        <CardHeader className="border-b border-amber-500/20 bg-amber-500/10 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-100/80">Degraded state</p>
              <p className="text-lg font-bold leading-tight text-foreground">Preview unavailable — using your NPI only</p>
              <p className="text-sm text-foreground">NPI {npi}</p>
              <p className="text-[9px] text-amber-200/50 leading-relaxed mt-1">
                VitalCV kept your entered NPI, but this card does not claim a resolved clinician identity until a live retry succeeds.
              </p>
            </div>
            <div className="space-y-2 text-right">
              <TrustStatusBadge status="unavailable" label={unavailableLabel} size="sm" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 px-5 py-4">
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.05] px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Readiness</p>
                <p className="mt-2 text-sm font-semibold text-foreground">Full readiness snapshot unavailable</p>
                <p className="mt-1 text-[11px] text-foreground">Only completed checks stay visible in this degraded preview.</p>
              </div>
              <TrustStatusBadge status="unavailable" size="sm" />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">
              What this degraded preview means
            </p>
            <div className="space-y-2">
              {attentionItems.length === 0 ? (
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-sm leading-none shrink-0">✔</span>
                  <span className="text-xs text-foreground">No additional degraded warnings.</span>
                </div>
              ) : attentionItems.slice(0, 3).map(item => (
                <div key={item} className="flex items-center gap-2">
                  <span className="text-muted-foreground/50 text-sm leading-none shrink-0">✖</span>
                  <span className="text-xs text-foreground">{item}</span>
                </div>
              ))}
            </div>
            {checkedItems.length > 0 ? (
              <div className="space-y-3 border-t border-foreground/6 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">Completed in this lookup</p>
                <div className="flex flex-wrap gap-2">
                  {checkedItems.map(item => (
                    <Badge key={item} variant="outline" className={CHIPS_CLASSNAME}>
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <EvidenceDisclosureCard
            eyebrow="Proof"
            title="Source checks"
            description="Completed checks stay marked as checked. Everything else remains pending, access required, or unavailable until a live retry finishes."
            className="rounded-xl border-foreground/6 bg-muted"
            contentClassName="px-5 py-1"
          >
            <Accordion
              items={accordion}
              telemetryComponentId="homepage_readiness_proof"
            />
          </EvidenceDisclosureCard>
        </CardContent>

        <CardFooter className="border-t border-foreground/6 px-5 py-4">
          <div className="w-full rounded-2xl border border-foreground/6 bg-foreground/15 p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/30">Next step</p>
              <p className="mt-1 text-sm font-medium text-foreground/70">Continue to passport with this NPI.</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground/70">
                Passport retries the live lookup. Completed checks stay visible, and unresolved lanes remain marked as {pendingLabel}, {accessRequiredLabel}, or {unavailableLabel}.
              </p>
            </div>
            <Button
              type="button"
              variant="success"
              onClick={onContinue}
              disabled={continueDisabled}
              className="mt-4 h-14 w-full rounded-xl px-5 text-sm font-semibold"
            >
              {continueLabel}
            </Button>
            <p className="mt-2 text-center text-[10px] text-muted-foreground/40">
              NPI-only carryover until a live source run finishes
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
