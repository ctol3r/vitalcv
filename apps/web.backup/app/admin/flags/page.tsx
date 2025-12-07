"use client";
import { useEffect, useState } from 'react';

export default function Flags() {
  const [data, setData] = useState<any>({});
  const [k, setK] = useState('press_landing');
  const [v, setV] = useState('{"enabled":true}');

  async function load() {
    const r = await fetch('/admin/flags');
    setData(await r.json());
  }

  async function save() {
    await fetch('/admin/flags', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: k, value: JSON.parse(v) })
    });
    load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className='max-w-3xl mx-auto py-8 px-6'>
      <h1 className='text-3xl font-bold mb-6'>Runtime Flags</h1>

      <div className='bg-white p-6 rounded-lg border'>
        <div className='space-y-3'>
          <div>
            <label className='block text-sm font-medium mb-1'>Key</label>
            <input
              className='w-full p-2 border rounded'
              value={k}
              onChange={e => setK(e.target.value)}
            />
          </div>

          <div>
            <label className='block text-sm font-medium mb-1'>Value (JSON)</label>
            <input
              className='w-full p-2 border rounded font-mono text-sm'
              value={v}
              onChange={e => setV(e.target.value)}
            />
          </div>

          <button
            className='w-full px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors'
            onClick={save}
          >
            Save Flag
          </button>
        </div>
      </div>

      <div className='mt-6'>
        <h2 className='text-xl font-semibold mb-3'>Current Flags</h2>
        <pre className='text-xs bg-gray-50 p-4 rounded overflow-auto border'>
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}

