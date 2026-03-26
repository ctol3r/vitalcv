'use client';

/**
 * ReadinessPreview — preview card shown after NPI ingestion.
 *
 * Data priority:
 *   1. realState (ClinicianTrustState from /api/trust-state/:npi)
 *      → name, specialty, exclusion status, gaps, readiness from real artifacts
 *   2. Demo fallback (when isDemo=true or backend unreachable)
 *      → hardcoded profiles keyed by NPI; clearly labelled as demo
 *
 * Non-negotiables:
 *   - "Verified" only appears when identityVerified=true from real claim
 *   - "Clear" on exclusion only when exclusionClear=true from real artifact
 *   - Gaps are surfaced directly from trustStateEngine output
 *   - Demo fallback is always labelled — never presented as verified truth
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
import { getDemoProfile, type DemoProfile } from '@/lib/demo/demoProfiles';
import { formatCompactProofDate } from '@/lib/trust/proof-language';
import {
  resolveTrustUiStatus,
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

// ── Demo fallback profiles ────────────────────────────────────

const DEMO_PROFILE_ALIASES: Record<string, string> = {
  '1234567890': '1003000126',
  '9876543210': '1942788324',
  '1111111111': '1841498016',
};

type ReadinessTone = 'clear' | 'pending' | 'blocked';

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
  clear: 'Clear',
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
    ts.identityVerified ? 'Identity verified' : null,
    ts.exclusionClear ? 'OIG clear' : null,
    ts.licensureStatus === 'verified' ? 'Licensure confirmed' : null,
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

function resolveDemoReadinessTone(demo: DemoProfile): ReadinessTone {
  switch (demo.readiness) {
    case 'READY':
      return 'clear';
    case 'BLOCKED':
      return 'blocked';
    default:
      return 'pending';
  }
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
  const npiStatus = resolveTrustUiStatus({ state: 'live', kind: 'verification', satisfied: ts.identityVerified });
  const licStatus = ts.licensureStatus === 'verified' ? 'verified' : 'access_required';
  const exclStatus = resolveTrustUiStatus({ state: 'live', kind: 'clearance', satisfied: ts.exclusionClear });

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
                : 'The current run found a registry record, but identity is not yet strong enough to render a positive verification state.',
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
      triggerRight: accordionMeta(licStatus === 'verified' ? checkedMeta : 'access required'),
      status: licStatus,
      content: (
        <ProofDetailsList
          rows={[
            {
              id: 'source',
              label: 'Source',
              value: licStatus === 'verified' ? 'State Board (Nursys / FSMB)' : 'State Board access required',
              tone: 'strong',
            },
            { id: 'checked', label: 'Last checked', value: formatFullDate(licStatus === 'verified' ? checkedAt : undefined) },
            {
              id: 'freshness',
              label: 'Freshness',
              value: licStatus === 'verified' ? 'Current run' : 'Institutional source required',
            },
            {
              id: 'trust-note',
              label: 'Trust note',
              value: licStatus === 'verified'
                ? 'Primary-source authority evidence is attached for this run.'
                : 'Licensure needs connected institutional source access before it can become decision-grade proof.',
            },
            {
              id: 'status-note',
              label: 'Status note',
              value: licStatus === 'verified'
                ? 'Authority coverage is present in this snapshot.'
                : 'Do not treat licensure as verified until a real board source has run.',
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
              value: 'Unsupported board checks must remain clearly non-verified.',
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
                : 'This run does not attach enough evidence to render a positive exclusion clearance.',
            },
            {
              id: 'status-note',
              label: 'Status note',
              value: ts.exclusionClear
                ? 'NPDB and SAM.gov remain separate institutional checks outside this preview.'
                : 'Absence of a clear state is not evidence of exclusion, but it does block a stronger trust claim.',
              tone: 'muted',
            },
          ]}
        />
      ),
    },
  ];
}

function buildDemoAccordion(demo: DemoProfile): AccordionItem[] {
  const previewMeta = accordionMeta('demo preview');
  const accessRequiredMeta = accordionMeta('access required');
  const pecosGap = [...demo.blockers, ...demo.missingItems]
    .some((item) => item.toLowerCase().includes('medicare enrollment'));
  const exclusionFlag = demo.blockers
    .some((item) => item.toLowerCase().includes('exclusion'));

  return [
    {
      id: 'identity',
      trigger: 'Identity Verification',
      triggerRight: previewMeta,
      status: 'demo',
      content: (
        <ProofDetailsList
          rows={[
            { id: 'source', label: 'Source', value: 'CMS NPPES · NPI Registry', tone: 'strong' },
            { id: 'checked', label: 'Last checked', value: 'Demo preview only' },
            { id: 'freshness', label: 'Freshness', value: 'Preview payload' },
            {
              id: 'trust-note',
              label: 'Trust note',
              value: 'This section shows how identity proof will appear after a real lookup.',
            },
            {
              id: 'status-note',
              label: 'Status note',
              value: 'Demo states never stand in for live evidence.',
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
            { id: 'freshness', label: 'Freshness', value: 'No live source attached' },
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
            { id: 'freshness', label: 'Freshness', value: 'No live source attached' },
            {
              id: 'trust-note',
              label: 'Trust note',
              value: 'Board-history coverage depends on institutional FSMB access that is not connected in this preview.',
            },
            {
              id: 'status-note',
              label: 'Status note',
              value: 'Example gaps stay explicitly non-verified until a real board-history source is attached.',
              tone: 'muted',
            },
          ]}
        />
      ),
    },
    {
      id: 'pecos',
      trigger: 'Medicare Enrollment',
      triggerRight: accordionMeta(pecosGap ? 'not found in example' : 'demo preview'),
      status: pecosGap ? 'pending' : 'demo',
      content: (
        <ProofDetailsList
          rows={[
            { id: 'source', label: 'Source', value: 'CMS PECOS', tone: 'strong' },
            { id: 'checked', label: 'Last checked', value: 'Preview payload' },
            { id: 'freshness', label: 'Freshness', value: demo.sources.pecos.status === 'live' ? 'Live source' : 'Quarterly dataset preview' },
            {
              id: 'trust-note',
              label: 'Trust note',
              value: pecosGap
                ? 'This example shows how a Medicare enrollment gap appears when PECOS does not show an active enrollment.'
                : 'This section shows how Medicare enrollment evidence will appear after a real PECOS-backed run.',
            },
            {
              id: 'status-note',
              label: 'Status note',
              value: pecosGap
                ? 'Preview gaps remain clearly labeled and never stand in for a positive enrollment result.'
                : 'Demo rows show structure only and never claim decision-grade proof.',
              tone: 'muted',
            },
          ]}
        />
      ),
    },
    {
      id: 'sanctions',
      trigger: 'Sanctions & Exclusions',
      triggerRight: accordionMeta(exclusionFlag ? 'flagged in example' : 'demo preview'),
      status: exclusionFlag ? 'review_required' : 'demo',
      content: (
        <ProofDetailsList
          rows={[
            { id: 'source', label: 'Source', value: 'OIG / LEIE', tone: 'strong' },
            { id: 'checked', label: 'Last checked', value: 'Preview payload' },
            { id: 'freshness', label: 'Freshness', value: 'Example only' },
            {
              id: 'trust-note',
              label: 'Trust note',
              value: exclusionFlag
                ? 'This example shows how an exclusion blocker will appear when the OIG result is not clear.'
                : 'A real exclusion result appears only after a live OIG run.',
            },
            {
              id: 'status-note',
              label: 'Status note',
              value: exclusionFlag
                ? 'Blocked examples remain clearly labeled and still require a live source run before anyone can rely on them.'
                : 'NPDB and SAM.gov remain separate institutional checks outside this preview.',
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
}

export function ReadinessPreview({ npi, realState, isDemo, visible, onContinue }: Props) {

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
                  {ts.identityVerified ? 'Identity verified' : 'Identity record found'}
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
                  Real source evidence upgrades trust posture. Missing or gated lanes stay visibly incomplete.
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
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">Confirmed in this run</p>
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
              title="Source verification"
              description="Expand each section to see where the snapshot is source-backed, gated, or still missing."
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
            <div className="w-full">
              <Button
                type="button"
                variant="success"
                onClick={onContinue}
                className="h-14 w-full rounded-xl px-5 text-sm font-semibold"
              >
                Share in your next interview
              </Button>
              <p className="mt-2 text-center text-[10px] text-white/20">
                Snapshot built from connected sources · {ts.methodology_version}
              </p>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // ── Demo fallback path ───────────────────────────────────
  const demo = getDemoProfile(DEMO_PROFILE_ALIASES[npi] ?? npi);
  const attentionItems = demo.blockers.length > 0 ? demo.blockers : demo.missingItems;
  const attentionHeading = demo.blockers.length > 0 ? 'Current blockers' : 'What this example is missing';
  const accordion = buildDemoAccordion(demo);
  const readinessTone = resolveDemoReadinessTone(demo);

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
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-100/80">Example preview</p>
              <p className="text-lg font-bold leading-tight text-white">{demo.name}</p>
              <p className="text-sm text-white/45">{demo.specialty}</p>
            </div>
            <TrustStatusBadge status="demo" label="Preview only" size="sm" />
          </div>
        </CardHeader>

        <CardContent className="space-y-5 px-5 py-4">
          <div className={cn('rounded-xl border px-4 py-4', READINESS_TONE_STYLES[readinessTone].panel)}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Readiness</p>
                <p className="mt-2 text-sm font-semibold text-white">Estimated start: {demo.estimatedStart}</p>
                <p className="mt-1 text-[11px] text-white/45">Example preview only</p>
              </div>
              <TrustStatusBadge
                status={readinessBadgeStatus(readinessTone)}
                label={READINESS_TONE_LABELS[readinessTone]}
                size="sm"
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
              {attentionItems.length === 0 ? 'Current blockers' : attentionHeading}
            </p>
            <div className="space-y-2">
              {attentionItems.length === 0 ? (
                <div className="flex items-center gap-2">
                  <span className="text-white/55 text-sm leading-none shrink-0">✔</span>
                  <span className="text-xs text-white/45">No blockers in this example.</span>
                </div>
              ) : attentionItems.slice(0, 3).map(item => (
                <div key={item} className="flex items-center gap-2">
                  <span className="text-white/25 text-sm leading-none shrink-0">✖</span>
                  <span className="text-xs text-white/55">{item}</span>
                </div>
              ))}
            </div>
            {demo.gatedItems.length > 0 ? (
              <div className="space-y-3 border-t border-white/6 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">Access required in this example</p>
                <div className="flex flex-wrap gap-2">
                  {demo.gatedItems.map(item => (
                    <Badge key={item} variant="outline" className={CHIPS_CLASSNAME}>
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="space-y-3 border-t border-white/6 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">Ready in this example</p>
              <div className="flex flex-wrap gap-2">
                {demo.verifiedItems.map(item => (
                  <Badge key={item} variant="outline" className={CHIPS_CLASSNAME}>
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <EvidenceDisclosureCard
            eyebrow="Proof"
            title="Source verification"
            description="Demo states stay clearly labeled so preview structure never stands in for live evidence."
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
          <div className="w-full">
            <Button
              type="button"
              variant="success"
              onClick={onContinue}
              className="h-14 w-full rounded-xl px-5 text-sm font-semibold"
            >
              Share in your next interview
            </Button>
            <p className="mt-2 text-center text-[10px] text-white/20">
              Demo preview only · live data appears after a real source run
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
