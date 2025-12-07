"use client";
import { useEffect, useState } from 'react';

export default function Diff({ params }: { params: { state: string } }) {
  const [d, setD] = useState<any>();

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/digests/heatmap/diff/' + params.state);
      setD(await r.json());
    })();
  }, [params.state]);

  if (!d?.ok) return <div className='p-8'>No snapshot.</div>;

  return (
    <div className='max-w-4xl mx-auto py-8'>
      <h1 className='text-xl font-bold mb-4'>Diff — {d.state}</h1>

      <div className='grid md:grid-cols-2 gap-4'>
        {/* Compacts Section */}
        <div className='p-3 border rounded text-xs'>
          <b className='block mb-2'>Compacts</b>
          <div className='mb-1'>
            <span className='opacity-60'>Added:</span> {(d.compacts.added || []).join(', ') || '—'}
          </div>
          <div>
            <span className='opacity-60'>Removed:</span> {(d.compacts.removed || []).join(', ') || '—'}
          </div>
        </div>

        {/* State Rules Section */}
        <div className='p-3 border rounded text-xs col-span-2'>
          <b className='block mb-2'>State Rules</b>
          <div className='grid md:grid-cols-2 gap-2'>
            <div>
              <div className='opacity-60 mb-1'>Before</div>
              <pre className='bg-gray-50 p-2 rounded h-48 overflow-auto text-[10px]'>
                {JSON.stringify(d.state_rules.before, null, 2)}
              </pre>
            </div>
            <div>
              <div className='opacity-60 mb-1'>After</div>
              <pre className='bg-gray-50 p-2 rounded h-48 overflow-auto text-[10px]'>
                {JSON.stringify(d.state_rules.after, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        {/* MPJE Section */}
        <div className='p-3 border rounded text-xs'>
          <b className='block mb-2'>Uniform MPJE</b>
          <div className='mb-1'>
            <span className='opacity-60'>Before:</span> {String(d.mpje.before)}
          </div>
          <div>
            <span className='opacity-60'>After:</span> {String(d.mpje.after)}
          </div>
        </div>
      </div>

      <div className='mt-4'>
        <button
          onClick={() => window.history.back()}
          className='px-3 py-2 border rounded text-xs hover:bg-gray-50'
        >
          ← Back to Heatmap
        </button>
      </div>
    </div>
  );
}

