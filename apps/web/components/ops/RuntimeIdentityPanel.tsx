'use client';

/**
 * RuntimeIdentityPanel.tsx
 *
 * Grid of DID, environment, signing key, algorithm, and generated timestamp.
 * Identity facts only — no health/status signals.
 * Design: Bloomberg label/value grid, monospaced values throughout.
 */

export interface RuntimeIdentityPanelProps {
  did: string;
  environment: string;
  signingKeyId: string | null;
  algorithm: string;
  generatedAt: string;
}

interface RowProps {
  label: string;
  value: string | null;
}

function IdentityRow({ label, value }: RowProps) {
  return (
    <div className="flex items-center gap-3 px-3 min-h-[32px] border-b border-gray-100 last:border-b-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-400 w-[120px] shrink-0">
        {label}
      </span>
      <span className="text-xs font-mono text-gray-900 break-all min-w-0">
        {value ?? <span className="vcv-null-slot">─ ─ ─</span>}
      </span>
    </div>
  );
}

function formatGeneratedAt(iso: string): string {
  try {
    return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  } catch {
    return iso;
  }
}

export function RuntimeIdentityPanel({
  did,
  environment,
  signingKeyId,
  algorithm,
  generatedAt,
}: RuntimeIdentityPanelProps) {
  return (
    <div className="border border-gray-200 bg-white overflow-hidden rounded">
      {/* Header band */}
      <div className="vcv-anchor-band">
        <span className="vcv-label">Runtime Identity</span>
      </div>

      <div>
        <IdentityRow label="DID" value={did} />
        <IdentityRow label="Environment" value={environment} />
        <IdentityRow label="Key ID" value={signingKeyId} />
        <IdentityRow label="Algorithm" value={algorithm} />
        <IdentityRow label="Generated" value={formatGeneratedAt(generatedAt)} />
      </div>
    </div>
  );
}
