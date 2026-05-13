import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckedAtStamp } from './CheckedAtStamp';
import { RunIdentity } from './RunIdentity';
import { OwnershipState, type OwnershipStateValue } from './OwnershipState';
import { ReplayLineage, type ReplayLineagePriorCheck, type ReplayLineageGap } from './ReplayLineage';

/**
 * TrustHeader — canonical header composite for every trust surface.
 *
 * Enforces the mandatory render order:
 *   OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID
 *
 * This is the institutional grammar a hospital verifier should see
 * within the first ~30 seconds on any surface that displays trust data:
 *   1. WHAT they're looking at (object)
 *   2. WHO claims to own it (ownership)
 *   3. WHEN it was last checked (checked_at)
 *   4. WHICH channel produced the check (channel / source)
 *   5. WHETHER there is replay continuity from prior checks
 *   6. WHICH run produced this view (run_id)
 *
 * Variants:
 *   PREVIEW  — anonymous / pre-claim public view; muted treatment,
 *              explicit "preview" prefix on the object label
 *   SNAPSHOT — authenticated read of a stable assertion; default register
 *   SIGNED   — cryptographically signed; emerald accent and "signed"
 *              affix; should be the only variant that asserts T4 tier
 *
 * The variant intentionally does NOT change the field order — it only
 * changes the visual register. The order is doctrine.
 */
export type TrustHeaderVariant = 'PREVIEW' | 'SNAPSHOT' | 'SIGNED';

const VARIANT_CLASSES: Record<TrustHeaderVariant, string> = {
  PREVIEW:  'border-dashed border-zinc-400/40 bg-zinc-500/5',
  SNAPSHOT: 'border-zinc-300/40 bg-background',
  SIGNED:   'border-emerald-500/40 bg-emerald-500/5',
};

const VARIANT_LABEL: Record<TrustHeaderVariant, string> = {
  PREVIEW:  'preview',
  SNAPSHOT: 'snapshot',
  SIGNED:   'signed',
};

export interface TrustHeaderObject {
  /** Stable identifier of the object (e.g. NPI '1346053246'). */
  id: string;
  /** Human-readable label (e.g. 'Macie Miller, PA-C'). */
  label: string;
  /** Object kind (e.g. 'clinician', 'organization', 'receipt'). */
  kind: string;
}

export interface TrustHeaderOwnership {
  state: OwnershipStateValue;
  claimant?: string;
  claimedAt?: string | null;
}

export interface TrustHeaderReplay {
  lineageKey: string;
  priorChecks: readonly ReplayLineagePriorCheck[];
  gaps?: readonly ReplayLineageGap[];
  replayCount?: number;
}

export interface TrustHeaderProps {
  /** Display variant — does NOT alter render order, only register. */
  variant?: TrustHeaderVariant;
  /** 1. OBJECT — what this header is about. */
  object: TrustHeaderObject;
  /** 2. OWNERSHIP — who claims to own the object. */
  ownership: TrustHeaderOwnership;
  /** 3. CHECKED_AT — when the snapshot was produced. */
  checkedAt: string | null | undefined;
  /** 4. CHANNEL — which source produced the check (e.g. 'NPPES_API'). */
  channel: string;
  /** 5. REPLAY — lineage continuity (optional; omitted = no prior runs known). */
  replay?: TrustHeaderReplay;
  /** 6. RUN_ID — which run produced this view. */
  runId: string;
  className?: string;
}

export function TrustHeader({
  variant = 'SNAPSHOT',
  object,
  ownership,
  checkedAt,
  channel,
  replay,
  runId,
  className,
}: TrustHeaderProps): React.ReactElement {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 rounded-xl border px-4 py-3',
        VARIANT_CLASSES[variant],
        className,
      )}
      data-trust-header-variant={variant}
      data-trust-header-object-id={object.id}
      data-trust-header-channel={channel}
      data-trust-header-run-id={runId}
      aria-label="Trust header"
    >
      {/* 1. OBJECT — first because everything else attaches to it. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1" data-section="object">
        <span className="font-mono text-[10px] uppercase tracking-widest opacity-60">
          {VARIANT_LABEL[variant]} · {object.kind}
        </span>
        <span className="font-semibold text-base leading-tight">{object.label}</span>
        <span className="font-mono text-xs opacity-80" title={object.id}>
          {object.id}
        </span>
      </div>

      {/* 2. OWNERSHIP — second, before any temporal field. */}
      <div data-section="ownership">
        <OwnershipState
          state={ownership.state}
          claimant={ownership.claimant}
          claimedAt={ownership.claimedAt ?? null}
          showDetail={false}
        />
      </div>

      {/* 3. CHECKED_AT and 4. CHANNEL — paired temporal+source context. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1" data-section="checked-channel">
        <CheckedAtStamp checkedAt={checkedAt} label="checked" format="long" />
        <span className="inline-flex items-baseline gap-1.5 text-xs">
          <span className="font-mono uppercase tracking-wide text-muted-foreground">channel</span>
          <span className="font-mono text-foreground" data-channel={channel}>{channel}</span>
        </span>
      </div>

      {/* 5. REPLAY — lineage; only rendered when supplied. */}
      {replay && (
        <div data-section="replay">
          <ReplayLineage
            lineageKey={replay.lineageKey}
            priorChecks={replay.priorChecks}
            gaps={replay.gaps}
            replayCount={replay.replayCount}
          />
        </div>
      )}

      {/* 6. RUN_ID — last, the identifier needed to replay this exact view. */}
      <div data-section="run-id">
        <RunIdentity runId={runId} label="run_id" />
      </div>
    </header>
  );
}
