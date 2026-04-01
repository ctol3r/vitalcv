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
 *   - "Verified" only appears when identityVerified=true from real claim
 *   - "Clear" on exclusion only when exclusionClear=true from real artifact
 *   - Gaps are surfaced directly from trustStateEngine output
 *   - Degraded fallback never substitutes a different clinician identity
 *   - Source names and checked timestamps shown where available
 */

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
import { formatCompactProofDate } from '@/lib/trust/proof-language';
import {
  getStatusDisplayLabel,
  getTrustStatusLabel,
} from '@/lib/trust/status-language';
import { TrustStatusBadge } from '@/components/ui/trust-status-badge';

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

type ReadinessTone = 'clear' | 'pending' | 'blocked';

export type DegradedPreviewReason = 'backendUnavailable' | 'partialCoverage';
export type DegradedPreviewSourceStatus = 'waiting' | 'loading' | 'ok' | 'skipped' | 'failed';

export interface DegradedPreviewSources {
  nppes: DegradedPreviewSourceStatus;
  oig: DegradedPreviewSourceStatus;
  readiness: DegradedPreviewSourceStatus;
}

const READINESS_TONE_STYLES: Record<ReadinessTone, { panel: string }> = {
  clear: {
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
  clear: 'Checked',
  pending: 'Pending',
  blocked: 'Blocked',
};

const CHIPS_CLASSNAME =
  'rounded-full border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/60';

function readinessBadgeStatus(tone: ReadinessTone): 'clear' | 'pending' | 'blocked' {
  switch (tone) {
    case 'clear':
      return 'clear';
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
    return 'clear';
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
      className="rounded-full border-white/8 bg-white/4 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/35"
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
      triggerRight: accordionMeta(licStatus === 'checked' ? checkedMeta : 'access required'),
      status: licStatus,
      content: (
        <ProofDetailsList
          rows={[
            {
              id: 'source',
              label: 'Source',
              value: licStatus === 'checked' ? 'State Board (Nursys / FSMB)' : 'State Board access required',
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
      id: 'board',
      trigger: 'Board Certification',
      triggerRight: accordionMeta('access required'),
      status: 'access_required',
      content: (
        <ProofDetailsList
          rows={[
            { id: 'source', label: 'Source', value: 'ABMS / specialty board access required', tone: 'strong' },
            { id: 'checked', label: 'Last checked', value: formatFullDate(undefined) },
            { id: 'freshness', label: 'Freshness', value: 'Not checked on this branch' },
            {
              id: 'trust-note',
              label: 'Trust note',
              value: 'Board certification coverage depends on institutional ABMS-style access that is not connected here.',
            },
            {
              id: 'status-note',
              label: 'Status note',
              value: 'Unsupported board checks must stay clearly marked as access required.',
              tone: 'muted',
            },
          ]}
        />
      ),
    },
    {
      id: 'dea',
      trigger: 'DEA / Controlled Substance',
      triggerRight: accordionMeta('access required'),
      status: 'access_required',
      content: (
        <ProofDetailsList
          rows={[
            { id: 'source', label: 'Source', value: 'DEA access required', tone: 'strong' },
            { id: 'checked', label: 'Last checked', value: formatFullDate(undefined) },
            { id: 'freshness', label: 'Freshness', value: 'Not checked on this branch' },
            {
              id: 'trust-note',
              label: 'Trust note',
              value: 'Controlled-substance authority is only decision-grade when a real DEA source is attached.',
            },
            {
              id: 'status-note',
              label: 'Status note',
              value: 'Do not rely on DEA coverage in this preview until source access is configured.',
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
                ? 'NPDB and SAM.gov remain separate institutional checks outside this preview.'
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
  const unavailableMeta = accordionMeta('temporarily unavailable');
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
            { id: 'source', label: 'Source', value: 'Nursys / state board access required', tone: 'strong' },
            { id: 'checked', label: 'Last checked', value: formatFullDate(undefined) },
            { id: 'freshness', label: 'Freshness', value: 'No checked source attached' },
            {
              id: 'trust-note',
              label: 'Trust note',
              value: 'Live licensure proof depends on a real Nursys or state-board source run with institutional coverage.',
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
      id: 'fsmb',
      trigger: 'FSMB Board History',
      triggerRight: accessRequiredMeta,
      status: 'access_required',
      content: (
        <ProofDetailsList
          rows={[
            { id: 'source', label: 'Source', value: 'FSMB access required', tone: 'strong' },
            { id: 'checked', label: 'Last checked', value: formatFullDate(undefined) },
            { id: 'freshness', label: 'Freshness', value: 'No checked source attached' },
            {
              id: 'trust-note',
              label: 'Trust note',
              value: 'Board-history coverage depends on institutional FSMB access that is not connected in this preview.',
            },
            {
              id: 'status-note',
              label: 'Status note',
              value: 'Example gaps stay explicitly labeled as access required or unavailable until a real board-history source is attached.',
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
}

export function ReadinessPreview({
  npi,
  realState,
  isDemo,
  visible,
  onContinue,
  fallbackReason = null,
  fallbackSources = null,
}: Props) {
  const checkedLabel = getTrustStatusLabel('checked');
  const clearLabel = getTrustStatusLabel('clear');
  const pendingLabel = getTrustStatusLabel('pending');
  const accessRequiredLabel = getTrustStatusLabel('access_required');
  const reviewRequiredLabel = getTrustStatusLabel('review_required');
  const unavailableLabel = getTrustStatusLabel('unavailable');
  const previewOnlyLabel = getStatusDisplayLabel('demo', 'Preview only');

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
        <Card className="overflow-hidden rounded-2xl border-white/8 bg-white/[0.04] py-0 shadow-none">
          <CardHeader className="border-b border-white/6 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                  {ts.identityVerified ? 'Identity checked' : 'Identity record found'}
                </p>
                <p className="text-lg font-bold leading-tight text-white">{displayName}</p>
                <p className="text-sm text-white/40">{displaySpec}</p>
              </div>
              <div className="space-y-2 text-right">
                <TrustStatusBadge
                  status={readinessBadgeStatus(readinessTone)}
                  label={READINESS_TONE_LABELS[readinessTone]}
                  size="sm"
                />
                <p className="text-[10px] font-mono text-white/20">Checked {checkedTime}</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 px-5 py-4">
            <div className={cn('rounded-xl border px-4 py-4', READINESS_TONE_STYLES[readinessTone].panel)}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Readiness</p>
                  <p className="mt-2 text-sm font-semibold text-white">{ts.readiness_status}</p>
                  <p className="mt-1 text-[11px] text-white/45">{ts.readiness_score}/100 · {ts.readiness_level}</p>
                </div>
                <p className="text-[11px] leading-relaxed text-white/42 sm:max-w-[220px] sm:text-right">
                  Source-backed checks strengthen this snapshot. Missing or gated lanes stay visibly incomplete.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
                {gaps.length === 0 ? 'Current blockers' : 'What still needs attention'}
              </p>
              <div className="space-y-2">
                {gaps.length === 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-white/55 text-sm leading-none shrink-0">✔</span>
                    <span className="text-xs text-white/45">No blockers surfaced in this run.</span>
                  </div>
                ) : gaps.slice(0, 3).map(gap => (
                  <div key={gap} className="flex items-start gap-2">
                    <span className="mt-px shrink-0 text-sm leading-none text-white/25">✖</span>
                    <span className="text-xs leading-tight text-white/55">{gap}</span>
                  </div>
                ))}
              </div>
              {confirmedItems.length > 0 ? (
                <div className="space-y-3 border-t border-white/6 pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">Checked in this run</p>
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
              className="rounded-xl border-white/6 bg-black/10"
              contentClassName="px-5 py-1"
            >
              <Accordion
                items={accordionItems}
                telemetryComponentId="homepage_readiness_proof"
              />
            </EvidenceDisclosureCard>
          </CardContent>

          <CardFooter className="border-t border-white/6 px-5 py-4">
            <div className="w-full rounded-2xl border border-white/6 bg-black/15 p-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/24">Next step</p>
                <p className="mt-1 text-sm font-medium text-white/72">Carry this snapshot into your passport.</p>
                <p className="mt-1 text-xs leading-relaxed text-white/38">
                  {checkedLabel} or {clearLabel} sections stay attached. {pendingLabel}, {accessRequiredLabel}, {reviewRequiredLabel}, and {unavailableLabel} sections remain visible.
                </p>
              </div>
              <Button
                type="button"
                variant="success"
                onClick={onContinue}
                className="mt-4 h-14 w-full rounded-xl px-5 text-sm font-semibold"
              >
                Continue to passport
              </Button>
              <p className="mt-2 text-center text-[10px] text-white/20">
                Source-backed preview · {ts.methodology_version}
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
      <Card className="overflow-hidden rounded-2xl border-white/8 bg-white/[0.04] py-0 shadow-none">
        <CardHeader className="border-b border-amber-500/20 bg-amber-500/10 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-100/80">Degraded state</p>
              <p className="text-lg font-bold leading-tight text-white">Preview unavailable — using your NPI only</p>
              <p className="text-sm text-white/45">NPI {npi}</p>
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
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Readiness</p>
                <p className="mt-2 text-sm font-semibold text-white">Full readiness snapshot unavailable</p>
                <p className="mt-1 text-[11px] text-white/45">Only completed checks stay visible in this degraded preview.</p>
              </div>
              <TrustStatusBadge status="unavailable" size="sm" />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
              What this degraded preview means
            </p>
            <div className="space-y-2">
              {attentionItems.length === 0 ? (
                <div className="flex items-center gap-2">
                  <span className="text-white/55 text-sm leading-none shrink-0">✔</span>
                  <span className="text-xs text-white/45">No additional degraded warnings.</span>
                </div>
              ) : attentionItems.slice(0, 3).map(item => (
                <div key={item} className="flex items-center gap-2">
                  <span className="text-white/25 text-sm leading-none shrink-0">✖</span>
                  <span className="text-xs text-white/55">{item}</span>
                </div>
              ))}
            </div>
            {checkedItems.length > 0 ? (
              <div className="space-y-3 border-t border-white/6 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">Completed in this lookup</p>
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
            className="rounded-xl border-white/6 bg-black/10"
            contentClassName="px-5 py-1"
          >
            <Accordion
              items={accordion}
              telemetryComponentId="homepage_readiness_proof"
            />
          </EvidenceDisclosureCard>
        </CardContent>

        <CardFooter className="border-t border-white/6 px-5 py-4">
          <div className="w-full rounded-2xl border border-white/6 bg-black/15 p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/24">Next step</p>
              <p className="mt-1 text-sm font-medium text-white/72">Continue to passport with this NPI.</p>
              <p className="mt-1 text-xs leading-relaxed text-white/38">
                Passport retries the live lookup. Completed checks stay visible, and unresolved lanes remain marked as {pendingLabel}, {accessRequiredLabel}, or {unavailableLabel}.
              </p>
            </div>
            <Button
              type="button"
              variant="success"
              onClick={onContinue}
              className="mt-4 h-14 w-full rounded-xl px-5 text-sm font-semibold"
            >
              Continue to passport
            </Button>
            <p className="mt-2 text-center text-[10px] text-white/20">
              NPI-only carryover until a live source run finishes
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
