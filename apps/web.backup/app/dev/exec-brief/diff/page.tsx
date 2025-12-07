"use client";
import { useEffect, useState } from 'react';

export default function Diff() {
  const [d, setD] = useState<any>();

  async function snap() {
    await fetch('/api/dev/exec-brief/snapshot');
    await load();
  }

  async function load() {
    const r = await fetch('/api/dev/exec-brief/diff');
    setD(await r.json());
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className='max-w-4xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Executive Brief Diff</h1>
      <div className='flex gap-2 text-xs mb-2 mt-4'>
        <button className='px-3 py-2 border rounded' onClick={snap}>
          Snapshot Now
        </button>
        <a
          className='px-3 py-2 border rounded'
          href='/api/dev/exec-brief/diff.html'
          target='_blank'
        >
          View Diff (HTML)
        </a>
      </div>
      {d ? (
        <pre className='text-xs bg-gray-50 p-3 rounded overflow-auto'>
          {JSON.stringify(d, null, 2)}
        </pre>
      ) : (
        'Loading…'
      )}
    </div>
  );
}











