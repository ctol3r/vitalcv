"use client";
import { useEffect, useState } from 'react';

export default function Providers() {
  const [d, setD] = useState<any>();

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/eudi/providers');
      setD(await r.json());
    })();
  }, []);

  const stale = d?.fetched_at
    ? ((Date.now() - Date.parse(d.fetched_at)) / 86400000) > 7
    : true;

  return (
    <div className='max-w-4xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>EUDI Providers</h1>

      {stale && (
        <div className='text-xs p-2 rounded bg-red-100 border mt-3'>
          Trusted list stale — issuance may be blocked.
        </div>
      )}

      <div className='mt-3 text-xs'>
        <div className='font-semibold'>Warnings</div>
        <ul className='list-disc ml-5'>
          {(d?.warnings || []).map((w: string, i: number) => (
            <li key={i}>{w}</li>
          ))}
        </ul>

        <div className='font-semibold mt-3'>Providers</div>
        <pre className='bg-gray-50 p-2 rounded overflow-auto'>
          {JSON.stringify(d?.rows || [], null, 2)}
        </pre>
      </div>
    </div>
  );
}


