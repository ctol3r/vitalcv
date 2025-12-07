"use client";
import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || '';

export default function RcGate() {
  const [gate, setGate] = useState<any>();

  useEffect(() => {
    (async () => {
      try {
        const baseUrl = BASE.replace('/api/agent', '');
        const r = await fetch(baseUrl + '/api/rc/gate');
        setGate(await r.json());
      } catch (error) {
        console.error('RC Gate check failed:', error);
      }
    })();
  }, []);

  if (!gate) return null;

  return (
    <span
      className={
        'text-xs px-2 py-1 rounded ' +
        (gate.GREEN ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
      }
    >
      {gate.GREEN ? '✓ RC: GREEN' : '⚠ RC: BLOCKED'}
    </span>
  );
}

