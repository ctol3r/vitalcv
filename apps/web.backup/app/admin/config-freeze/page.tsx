"use client";
import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || '';

export default function Freeze() {
  const [j, setJ] = useState<any>();

  useEffect(() => {
    (async () => {
      const r = await fetch(BASE + '/config/freeze');
      setJ(await r.json());
    })();
  }, []);

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Config Freeze Snapshot</h1>
      {j ? (
        <pre className='text-xs bg-gray-50 p-3 rounded'>
          {JSON.stringify(j, null, 2)}
        </pre>
      ) : (
        <div>Loading…</div>
      )}
    </div>
  );
}

