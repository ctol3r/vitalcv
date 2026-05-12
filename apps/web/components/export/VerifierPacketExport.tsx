'use client';

/**
 * VerifierPacketExport.tsx
 *
 * Export UI for verifier packets — download full JSON, receipt bundle, or print.
 * Does NOT auto-integrate into pages; imported explicitly where needed.
 */

import type { VerifierPacket } from '@/lib/export/buildVerifierPacket';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VerifierPacketExportProps {
  packet: VerifierPacket;
  /** If true, renders a preview summary above the action buttons */
  showPreview?: boolean;
}

// ─── Download helper ──────────────────────────────────────────────────────────

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Preview Panel ────────────────────────────────────────────────────────────

function PacketPreview({ packet }: { packet: VerifierPacket }) {
  const { packetId, exportedAt, issuerDid, receipts, replaySummary } = packet;

  return (
    <div className="border border-gray-200 rounded p-4 mb-4 space-y-2 bg-gray-50">
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
        Verifier Packet Preview
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <div>
          <span className="text-gray-400">Packet ID:</span>{' '}
          <span className="font-mono text-gray-800">{packetId}</span>
        </div>
        <div>
          <span className="text-gray-400">Exported:</span>{' '}
          <span className="text-gray-700">{exportedAt}</span>
        </div>
        <div>
          <span className="text-gray-400">Issuer DID:</span>{' '}
          <span className="font-mono text-gray-800">{issuerDid}</span>
        </div>
        <div>
          <span className="text-gray-400">Receipts:</span>{' '}
          <span className="text-gray-800 font-semibold">{receipts.length}</span>
        </div>
        <div>
          <span className="text-gray-400">Replay runs:</span>{' '}
          <span className="text-gray-800 font-semibold">{replaySummary.runCount}</span>
        </div>
        <div>
          <span className="text-gray-400">Survivability:</span>{' '}
          <span
            className={
              replaySummary.survivabilityScore >= 80
                ? 'text-green-700 font-semibold'
                : replaySummary.survivabilityScore >= 50
                  ? 'text-amber-700 font-semibold'
                  : 'text-red-700 font-semibold'
            }
          >
            {replaySummary.survivabilityScore}/100
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────────

function ExportButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'inline-flex items-center gap-2 rounded px-4 py-2',
        'text-sm font-semibold transition-colors',
        'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VerifierPacketExport({
  packet,
  showPreview = false,
}: VerifierPacketExportProps) {
  const handleDownloadFull = () => {
    downloadJson(packet, `vcv-verifier-packet-${packet.packetId}.json`);
  };

  const handleDownloadReceipts = () => {
    downloadJson(packet.receipts, `vcv-receipts-${packet.packetId}.json`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {showPreview && <PacketPreview packet={packet} />}

      <div className="flex flex-wrap gap-3">
        <ExportButton
          label="Download Replay Export (JSON)"
          onClick={handleDownloadFull}
        />
        <ExportButton
          label="Download Receipt Bundle (JSON)"
          onClick={handleDownloadReceipts}
        />
        <ExportButton
          label="Print Continuity Summary"
          onClick={handlePrint}
        />
      </div>
    </div>
  );
}

export default VerifierPacketExport;
