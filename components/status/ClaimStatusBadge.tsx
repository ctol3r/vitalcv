'use client';
import { getJSON } from '@/components/api/http';
import { useEffect, useState } from 'react';

type ClaimStatus = {
  npi: string;
  level: 0 | 1 | 2 | 3;
  issuerAttestTx: string | null;
  lastVerifiedAt: string | null;
};

export default function ClaimStatusBadge({ npi }: { npi: string }) {
  const [status, setStatus] = useState<ClaimStatus | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await getJSON<ClaimStatus>(`/api/claim/status?npi=${npi}`);
        setStatus(data);
      } catch (e: any) {
        setErr(e.message || 'status error');
      }
    })();
  }, [npi]);

  if (err)
    return (
      <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
        Status error
      </span>
    );
  if (!status)
    return (
      <span className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
        Loading…
      </span>
    );

  const levels = ['L0 Lookup', 'L1 Basic', 'L2 Doc/Live', 'L3 Issuer Attested'];
  const palette = [
    'bg-neutral-100 text-neutral-700',
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-emerald-100 text-emerald-700',
  ];
  const tone = palette[status.level] || palette[0];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded px-2 py-1 text-xs ${tone} dark:opacity-90`}
    >
      <strong>{levels[status.level]}</strong>
      {status.issuerAttestTx && (
        <a
          className="underline"
          href={`#onchain:${status.issuerAttestTx}`}
          title="On-chain tx reference (demo link)"
        >
          tx
        </a>
      )}
    </span>
  );
}
