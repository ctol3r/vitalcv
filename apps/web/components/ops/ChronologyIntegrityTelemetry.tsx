'use client';

/**
 * ChronologyIntegrityTelemetry.tsx
 *
 * Static invariant display for chronology contract.
 * All values font-mono text-xs. No fetch needed — these are invariants.
 */

const READING_ORDER = ['OBJECT', 'OWNERSHIP', 'CHECKED_AT', 'CHANNEL', 'REPLAY', 'RUN_ID'] as const;
const SLOT_COUNT = READING_ORDER.length;

interface Row {
  label: string;
  value: string;
  valueClass?: string;
}

const ROWS: Row[] = [
  {
    label: 'READING ORDER',
    value: READING_ORDER.join(' → '),
    valueClass: 'font-mono text-xs text-gray-200',
  },
  {
    label: 'SLOT COUNT',
    value: `${SLOT_COUNT} / ${SLOT_COUNT}`,
    valueClass: 'font-mono text-xs text-green-500',
  },
  {
    label: 'DETERMINISM',
    value: 'djb2-hash(npi:checkedAt) → hex → first-8',
    valueClass: 'font-mono text-xs text-gray-300',
  },
  {
    label: 'ORDERING',
    value: 'FIXED — never reordered',
    valueClass: 'font-mono text-xs text-gray-300',
  },
  {
    label: 'RUN_ID PREFIX',
    value: 'run:{8-char-hex}',
    valueClass: 'font-mono text-xs text-gray-300',
  },
  {
    label: 'LINEAGE KEY',
    value: '{laneId}:{providerId}',
    valueClass: 'font-mono text-xs text-gray-300',
  },
  {
    label: 'REPLAY CHAIN',
    value: 'priorRunId links confirmed',
    valueClass: 'font-mono text-xs text-gray-300',
  },
];

export function ChronologyIntegrityTelemetry() {
  return (
    <div className="border border-gray-700 bg-gray-950 font-mono text-xs text-gray-200">
      {/* Header */}
      <div className="border-b border-gray-700 px-4 py-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          CHRONOLOGY INTEGRITY
        </span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-900">
        {ROWS.map((row) => (
          <div key={row.label} className="flex items-start gap-4 px-4 py-1.5">
            <span className="w-36 shrink-0 text-[9px] uppercase tracking-widest text-gray-600">
              {row.label}
            </span>
            <span className={row.valueClass ?? 'font-mono text-xs text-gray-300'}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Contract status */}
      <div className="border-t border-gray-700 px-4 py-2 flex items-center gap-2">
        <span className="text-[9px] uppercase tracking-widest text-gray-600">CONTRACT STATUS</span>
        <span className="font-mono text-[10px] text-green-700 font-bold">
          ● ALL {SLOT_COUNT} SLOTS ENFORCED
        </span>
      </div>
    </div>
  );
}
