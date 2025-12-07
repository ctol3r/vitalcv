"use client";

import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || '';

export default function Gates() {
  const [rc, setRC] = useState<any>();
  const [cg, setCG] = useState<any>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const rcRes = await fetch(BASE.replace('/agent', '') + '/rc/gate');
        const rcData = await rcRes.json();
        setRC(rcData);

        const cgRes = await fetch(BASE.replace('/agent', '') + '/chaos/gate');
        const cgData = await cgRes.json();
        setCG(cgData);
      } catch (error) {
        console.error('Error fetching gates:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className='max-w-3xl mx-auto py-8 px-4'>
      <h1 className='text-2xl font-bold mb-6'>Release Gates</h1>

      {loading && <p className='text-gray-500'>Loading gates...</p>}

      {!loading && (
        <>
          <div className='mb-8'>
            <h2 className='text-lg font-semibold mb-2'>RC Gate</h2>
            <div className={`p-4 rounded-lg border ${rc?.GREEN ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className='flex items-center justify-between mb-3'>
                <span className='font-medium'>Status:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${rc?.GREEN ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                  {rc?.GREEN ? 'GREEN' : 'RED'}
                </span>
              </div>
              <pre className='text-xs bg-white p-3 rounded border overflow-x-auto'>
                {JSON.stringify(rc, null, 2)}
              </pre>
            </div>
          </div>

          <div>
            <h2 className='text-lg font-semibold mb-2'>Chaos SLO Gate</h2>
            <div className={`p-4 rounded-lg border ${cg?.pass ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className='flex items-center justify-between mb-3'>
                <span className='font-medium'>Status:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${cg?.pass ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                  {cg?.pass ? 'PASS' : 'BLOCKED'}
                </span>
              </div>
              {cg?.p95_ms && (
                <div className='mb-2 text-sm'>
                  <span className='font-medium'>P95 Latency:</span> {cg.p95_ms}ms
                </div>
              )}
              {cg?.success_rate && (
                <div className='mb-3 text-sm'>
                  <span className='font-medium'>Success Rate:</span> {(cg.success_rate * 100).toFixed(2)}%
                </div>
              )}
              <pre className='text-xs bg-white p-3 rounded border overflow-x-auto'>
                {JSON.stringify(cg, null, 2)}
              </pre>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
