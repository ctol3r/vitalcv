'use client';

import { useEffect, useRef, useState } from 'react';
import { pollClaimStatus } from '@/lib/apiClient';

export function ClaimStatusBadge({ npi, className = '' }: { npi: string; className?: string }) {
  const [level, setLevel] = useState<number>(0);
  const [label, setLabel] = useState<string>('Not Verified');
  const timer = useRef<any>(null);

  useEffect(() => {
    let abort = new AbortController();
    const tick = async () => {
      try {
        const s = await pollClaimStatus(npi, abort.signal);
        const lvl = Number(s?.level ?? 0);
        setLevel(lvl);
        setLabel(
          ['Not Verified', 'Email Verified', 'ID Verified', 'Issuer Attested'][lvl] || 'Unknown',
        );
      } catch {}
      timer.current = setTimeout(tick, 15000);
    };
    tick();
    return () => {
      abort.abort();
      clearTimeout(timer.current);
    };
  }, [npi]);

  const color =
    ['bg-gray-500', 'bg-blue-600', 'bg-purple-600', 'bg-green-600'][level] || 'bg-gray-500';
  return (
    <span className={`inline-block text-white text-xs px-2 py-1 rounded ${color} ${className}`}>
      {label}
    </span>
  );
}
