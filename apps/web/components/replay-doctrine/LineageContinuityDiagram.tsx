'use client';

/**
 * LineageContinuityDiagram.tsx
 *
 * Horizontal flow diagram: OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID
 * Pure CSS. No canvas. No chart libraries.
 * Shows how lineage slots connect across time.
 */

export interface LineageFlowProps {
  object: string;
  ownership: string | null;
  checkedAt: string | null;
  channel: string;
  replay: string | null;
  runId: string;
  tier: 'T1' | 'T2' | 'T3' | 'T4';
}

export interface LineageContinuityDiagramProps {
  current: LineageFlowProps;
  prior?: LineageFlowProps | null;
  showDoctrineLabels?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tierLabel(tier: LineageFlowProps['tier']): string {
  const labels: Record<string, string> = {
    T1: 'T1 · Primary Source',
    T2: 'T2 · Aggregator',
    T3: 'T3 · Source Checked',
    T4: 'T4 · Inferred',
  };
  return labels[tier] ?? tier;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SlotProps {
  label: string;
  value: string | null;
  isMono?: boolean;
  dashed?: boolean;
  highlight?: boolean;
  doctrineNote?: string;
}

function Slot({ label, value, isMono = false, dashed = false, highlight = false, doctrineNote }: SlotProps) {
  return (
    <div className="flex flex-col items-start">
      <div
        className={`border px-2 py-1 text-xs min-w-[80px] max-w-[140px] ${
          dashed ? 'border-dashed border-gray-200' : 'border-gray-200'
        } ${highlight ? 'bg-gray-900 text-white' : 'bg-white'}`}
      >
        <div className={`text-[9px] font-mono uppercase text-gray-300 mb-0.5`}>{label}</div>
        <div
          className={`leading-tight break-all ${
            isMono
              ? highlight
                ? 'font-mono text-xs text-white'
                : 'font-mono text-xs text-gray-900'
              : 'text-xs text-gray-600'
          } ${value === null ? 'text-gray-300 italic' : ''}`}
        >
          {value ?? '—'}
        </div>
      </div>
      {doctrineNote && (
        <div className="text-[9px] font-mono text-gray-300 mt-0.5 pl-0.5">{doctrineNote}</div>
      )}
    </div>
  );
}

function Arrow() {
  return <div className="text-gray-300 mx-1 text-xs self-center mt-3">→</div>;
}

interface FlowRowProps {
  flow: LineageFlowProps;
  dashed?: boolean;
  showDoctrineLabels?: boolean;
  replayMatchesRunId?: string | null;
}

function FlowRow({ flow, dashed = false, showDoctrineLabels = false, replayMatchesRunId }: FlowRowProps) {
  const replayHighlight = replayMatchesRunId !== undefined;

  return (
    <div className="flex flex-row items-start flex-wrap gap-y-1">
      <Slot label="Object" value={flow.object} dashed={dashed} />
      <Arrow />
      <Slot
        label="Ownership"
        value={flow.ownership}
        dashed={dashed}
        doctrineNote={showDoctrineLabels ? '← actor attribution' : undefined}
      />
      <Arrow />
      <Slot
        label="Checked At"
        value={flow.checkedAt}
        dashed={dashed}
        doctrineNote={showDoctrineLabels ? '← freshness' : undefined}
      />
      <Arrow />
      <Slot label="Channel" value={flow.channel} dashed={dashed} />
      <Arrow />
      <Slot
        label="Replay"
        value={flow.replay}
        isMono
        dashed={dashed}
        doctrineNote={showDoctrineLabels ? '← chain link' : undefined}
      />
      <Arrow />
      <Slot
        label="Run ID"
        value={flow.runId}
        isMono
        highlight={replayHighlight}
        dashed={dashed}
        doctrineNote={showDoctrineLabels ? '← deterministic hash' : undefined}
      />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LineageContinuityDiagram({
  current,
  prior = null,
  showDoctrineLabels = false,
}: LineageContinuityDiagramProps) {
  return (
    <div className="font-sans">
      {/* Header */}
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-2">
        Lineage Continuity
      </div>

      <div className="border border-gray-200 p-3">
        {/* Current run */}
        <div className="text-[9px] font-mono uppercase text-gray-300 mb-1.5">Current Run</div>
        <FlowRow
          flow={current}
          showDoctrineLabels={showDoctrineLabels}
          replayMatchesRunId={prior ? prior.runId : undefined}
        />

        {/* Tier badge */}
        <div className="mt-2">
          <span className="text-[9px] font-mono uppercase border border-gray-200 px-1.5 py-0.5 text-gray-500">
            {tierLabel(current.tier)}
          </span>
        </div>

        {/* Connecting dashed line to prior */}
        {prior && (
          <>
            <div className="mt-3 mb-2 border-t border-dashed border-gray-200" />

            {/* Chain link annotation */}
            <div className="text-[9px] font-mono text-gray-400 mb-1.5">
              ↑ REPLAY links to Prior Run: <span className="text-gray-600">{prior.runId}</span>
            </div>

            {/* Prior run */}
            <div className="text-[9px] font-mono uppercase text-gray-300 mb-1.5">Prior Run</div>
            <FlowRow flow={prior} dashed showDoctrineLabels={showDoctrineLabels} />

            <div className="mt-2">
              <span className="text-[9px] font-mono uppercase border border-dashed border-gray-200 px-1.5 py-0.5 text-gray-400">
                {tierLabel(prior.tier)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
