import * as React from 'react';
import { LineageHeader } from '@/components/trust/primitives';
import {
  composeLineage,
  type LineageTrustState,
} from '@/lib/trust/replay-grammar';

/**
 * Chronology block for any provenance pane.
 *
 * Reuses the canonical `LineageHeader` primitive so the six-cell
 * binding reading order
 * (OBJECT → OWNERSHIP → checked_at → CHANNEL → REPLAY → run_id)
 * renders identically on receipt, audit, lineage, and entity panes.
 *
 * Callers compose the six values from their pane's local data; this
 * component does not invent or fetch anything.
 */
export interface ProvenanceChronologyInput {
  object: { value: string; subLabel?: string };
  ownership: { value: string; subLabel?: string };
  checkedAt: { value: string; subLabel?: string };
  channel: { value: string; subLabel?: string };
  replay: { value: string; subLabel?: string };
  runId: { value: string; subLabel?: string };
}

export interface ProvenanceChronologyProps {
  state: LineageTrustState;
  chronology: ProvenanceChronologyInput;
  className?: string;
}

export function ProvenanceChronology({
  state,
  chronology,
  className,
}: ProvenanceChronologyProps) {
  return (
    <div data-slot="provenance-chronology" className={className}>
      <LineageHeader
        state={state}
        slots={composeLineage({
          object: { label: 'Object', value: chronology.object.value, subLabel: chronology.object.subLabel },
          ownership: { label: 'Ownership', value: chronology.ownership.value, subLabel: chronology.ownership.subLabel },
          checkedAt: { label: 'checked_at', value: chronology.checkedAt.value, subLabel: chronology.checkedAt.subLabel },
          channel: { label: 'Channel', value: chronology.channel.value, subLabel: chronology.channel.subLabel },
          replay: { label: 'Replay', value: chronology.replay.value, subLabel: chronology.replay.subLabel },
          runId: { label: 'run_id', value: chronology.runId.value, subLabel: chronology.runId.subLabel },
        })}
      />
    </div>
  );
}
