/**
 * ReadinessLanePanel — Wave LIVE-102 builder slice.
 *
 * Renders an honest, lane-fidelity-preserving view of the four
 * source lanes returned by /api/ingest/[npi]. Uses lib/sources/lane-mapper
 * so the five lane states (source_backed | pending | unavailable |
 * access_required | stale) map to five distinct tones and labels.
 *
 * Honesty rules:
 *   - Per-lane disclaimer always rendered, regardless of state.
 *   - NPPES row labelled "Identity only — does not confirm licensure".
 *   - OIG/LEIE row labelled "Federal scope, not real-time".
 *   - PECOS row labelled "Public posture, not real-time".
 *   - State board row labelled "Institutional access required, not
 *     a clinician defect".
 *   - When the response is a fallback (`fallback: true`), render an
 *     explicit banner so `runId: null` is never silent.
 */

import * as React from 'react';
import {
  toLaneViewModels,
  type LaneTone,
  type LaneViewModel,
  type RawLane,
} from '@/lib/sources/lane-mapper';

export interface ReadinessLanePanelProps {
  lanes: readonly RawLane[];
  /** When true, the API marked this response as a fallback envelope. */
  fallback?: boolean;
  /** Backend-supplied message explaining the fallback (when applicable). */
  fallbackMessage?: string | null;
  /** Reason from the proxy (upstream_5xx | network | timeout | non_json | upstream_4xx). */
  fallbackReason?: string | null;
  /** When the proxy could not assign a runId — surfaced explicitly. */
  runId?: string | null;
  /** Reason text the proxy attaches when runId is null (LIVE-102 contract). */
  runIdReason?: string | null;
  className?: string;
}

const TONE_CHIP: Record<LaneTone, string> = {
  // Five distinct chip styles — never share a class between two tones.
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700',
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-700',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
  gated: 'border-violet-500/40 bg-violet-500/10 text-violet-700',
  neutral: 'border-slate-500/40 bg-slate-500/10 text-slate-600',
};

const TONE_DOT: Record<LaneTone, string> = {
  success: 'bg-emerald-500',
  info: 'bg-sky-500',
  warning: 'bg-amber-500',
  gated: 'bg-violet-500',
  neutral: 'bg-slate-400',
};

function ToneChip({ tone, children }: { tone: LaneTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${TONE_CHIP[tone]}`}
      data-testid={`lane-chip-${tone}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} aria-hidden />
      {children}
    </span>
  );
}

function FallbackBanner({
  reason,
  message,
}: {
  reason?: string | null;
  message?: string | null;
}) {
  if (!reason && !message) return null;
  return (
    <div
      className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-800"
      role="status"
      aria-live="polite"
      data-testid="readiness-fallback-banner"
    >
      <p className="font-semibold">
        Readiness pipeline degraded — showing source-backed identity only.
      </p>
      {message ? <p className="mt-1 text-amber-800/80">{message}</p> : null}
      {reason ? (
        <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-amber-700/70">
          Reason: {reason}
        </p>
      ) : null}
    </div>
  );
}

function NppesIdentityCard({ vm }: { vm: LaneViewModel }) {
  if (vm.source !== 'NPPES' || !vm.identity) return null;
  const id = vm.identity;
  return (
    <dl
      className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 text-xs text-foreground/70"
      data-testid="lane-identity-projection"
    >
      <div>
        <dt className="text-muted-foreground/60">Display name</dt>
        <dd className="font-medium text-foreground">{id.displayName || '—'}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground/60">NPPES status</dt>
        <dd className="font-medium text-foreground">{id.nppesStatus}</dd>
      </div>
      {id.taxonomy ? (
        <div>
          <dt className="text-muted-foreground/60">Primary taxonomy</dt>
          <dd className="font-medium text-foreground">{id.taxonomy}</dd>
        </div>
      ) : null}
      {id.practiceState ? (
        <div>
          <dt className="text-muted-foreground/60">Practice state</dt>
          <dd className="font-medium text-foreground">{id.practiceState}</dd>
        </div>
      ) : null}
      {id.enumerationDate ? (
        <div>
          <dt className="text-muted-foreground/60">Enumerated</dt>
          <dd className="font-medium text-foreground">{id.enumerationDate}</dd>
        </div>
      ) : null}
      {id.lastUpdated ? (
        <div>
          <dt className="text-muted-foreground/60">NPPES last updated</dt>
          <dd className="font-medium text-foreground">{id.lastUpdated}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function LaneRow({ vm }: { vm: LaneViewModel }) {
  return (
    <li
      className="rounded-2xl border border-border bg-card px-4 py-3"
      data-testid={`lane-row-${vm.source}`}
      data-lane-state={vm.state}
      data-lane-tone={vm.tone}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ToneChip tone={vm.tone}>{vm.state.replace('_', ' ')}</ToneChip>
        <span className="text-sm font-semibold text-foreground">{vm.label}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground" data-testid={`lane-detail-${vm.source}`}>
        {vm.detail}
      </p>
      <p
        className="mt-1 text-[11px] uppercase tracking-[0.1em] text-muted-foreground/70"
        data-testid={`lane-cadence-${vm.source}`}
      >
        {vm.cadenceNote}
      </p>
      <p
        className="mt-2 text-xs italic text-muted-foreground/80"
        data-testid={`lane-disclaimer-${vm.source}`}
      >
        {vm.disclaimer}
      </p>
      {vm.sourceUrl ? (
        <p
          className="mt-1 text-[11px] font-mono text-muted-foreground/60 break-all"
          data-testid={`lane-source-url-${vm.source}`}
        >
          Source: {vm.sourceUrl}
        </p>
      ) : null}
      {vm.readAt ? (
        <p
          className="text-[11px] font-mono text-muted-foreground/60"
          data-testid={`lane-read-at-${vm.source}`}
        >
          Read at: {vm.readAt}
        </p>
      ) : null}
      <NppesIdentityCard vm={vm} />
    </li>
  );
}

export function ReadinessLanePanel(props: ReadinessLanePanelProps): React.ReactElement {
  const vms = toLaneViewModels(props.lanes);
  const baseClass =
    'space-y-4 rounded-2xl border border-border bg-background/60 p-5 sm:p-6';
  const rootClass = props.className ? `${baseClass} ${props.className}` : baseClass;
  return (
    <section
      className={rootClass}
      aria-label="Readiness lane status"
      data-testid="readiness-lane-panel"
      data-fallback={props.fallback ? 'true' : 'false'}
      data-run-id={props.runId ?? 'null'}
    >
      <header className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          Source-backed readiness lanes
        </p>
        <h3 className="text-base font-semibold text-foreground">
          {vms.length} lane{vms.length === 1 ? '' : 's'} reporting
        </h3>
      </header>

      {props.fallback ? (
        <FallbackBanner reason={props.fallbackReason} message={props.fallbackMessage} />
      ) : null}

      <ul className="space-y-3">
        {vms.map((vm) => (
          <LaneRow key={vm.source} vm={vm} />
        ))}
      </ul>

      {props.fallback && !props.runId ? (
        <p
          className="text-[11px] text-muted-foreground/70"
          data-testid="readiness-run-id-explainer"
        >
          {props.runIdReason ??
            'No runId was assigned because the readiness pipeline returned a fallback envelope. The lanes above are sourced directly where possible (NPPES public registry) and flagged unavailable / access required where they are not.'}
        </p>
      ) : null}
    </section>
  );
}

export default ReadinessLanePanel;
