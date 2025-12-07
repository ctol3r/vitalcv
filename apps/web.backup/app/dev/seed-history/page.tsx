"use client";

import { useEffect, useState } from 'react';

export default function SeedHistory() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/dev/seed-history?limit=100');
        const json = await res.json();
        setRows(json.rows || []);
      } catch (error) {
        console.error('Failed to fetch seed history:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className='max-w-4xl mx-auto py-8'>
      <h1 className='text-xl font-bold mb-4'>Seed History Timeline</h1>

      {loading && (
        <div className='text-sm text-gray-500'>Loading seed history...</div>
      )}

      {!loading && rows.length === 0 && (
        <div className='text-sm text-gray-500'>No seed history entries found.</div>
      )}

      <div className='mt-3 space-y-2'>
        {rows.map((row: any, index: number) => {
          const selectedSeeds = Object.keys(row.seeds || {})
            .filter(k => row.seeds[k])
            .join(', ') || '—';

          return (
            <details key={index} className='p-3 border rounded text-xs hover:bg-gray-50'>
              <summary className='cursor-pointer'>
                <span className='font-bold'>{new Date(row.ts).toLocaleString()}</span>
                {' • '}
                <span className='text-gray-600'>{row.user_id || 'dev'}</span>
                {' — '}
                <span className='text-blue-600'>seeds: {selectedSeeds}</span>
              </summary>
              <pre className='bg-gray-50 p-3 rounded mt-3 overflow-auto text-[10px] leading-relaxed'>
                {JSON.stringify(row.result, null, 2)}
              </pre>
            </details>
          );
        })}
      </div>
    </div>
  );
}

