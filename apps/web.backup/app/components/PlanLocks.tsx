"use client";
import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || '';

export default function PlanLocks() {
  const [warn, setWarn] = useState<string | null>(null);

  useEffect(() => {
    const _fetch = window.fetch;
    (window as any).fetch = async (...a: any) => {
      const r = await _fetch(...a);
      if (r.status === 402) {
        try {
          const j = await r.json();
          setWarn(`Feature not in plan: ${j.feature}`);
        } catch {}
      }
      return r;
    };
  }, []);

  if (!warn) return null;

  return (
    <div className='text-xs px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-900'>
      {warn}
    </div>
  );
}

