"use client";
import { useState } from 'react';

export default function B() {
  const [npi, setNpi] = useState('');
  const [d, setD] = useState<any>();

  async function load() {
    const r = await fetch('/api/behavioral/vc-preview?npi=' + encodeURIComponent(npi));
    setD(await r.json());
  }

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Behavioral Health VC Preview</h1>

      <div className='flex gap-2 text-xs mt-4'>
        <input
          className='p-2 border rounded'
          placeholder='NPI'
          value={npi}
          onChange={e => setNpi(e.target.value)}
        />
        <button
          className='px-3 py-2 border rounded'
          onClick={load}
        >
          Preview
        </button>
      </div>

      {d && (
        <pre className='bg-gray-50 p-3 rounded mt-3 text-xs'>
          {JSON.stringify(d, null, 2)}
        </pre>
      )}
    </div>
  );
}


