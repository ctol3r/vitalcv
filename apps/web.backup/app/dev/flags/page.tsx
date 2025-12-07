"use client";
import { useEffect, useState } from 'react';

export default function Flags() {
  const [map, setMap] = useState<any>({});
  const [k, setK] = useState('press_landing');
  const [v, setV] = useState('{"enabled":true}');

  async function load() {
    const r = await fetch('/admin/flags');
    setMap(await r.json());
  }

  async function save() {
    try {
      await fetch('/admin/flags', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: k, value: JSON.parse(v) })
      });
      load();
    } catch (e) {
      alert('Invalid JSON: ' + e);
    }
  }

  async function del(key: string) {
    await fetch('/admin/flags', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key })
    });
    load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Runtime Flags</h1>

      <div className='flex gap-2 mt-3'>
        <input
          className='p-2 border rounded flex-1'
          placeholder='Key'
          value={k}
          onChange={e => setK(e.target.value)}
        />
        <input
          className='p-2 border rounded flex-1'
          placeholder='Value (JSON)'
          value={v}
          onChange={e => setV(e.target.value)}
        />
        <button
          className='px-3 py-2 bg-black text-white rounded'
          onClick={save}
        >
          Save
        </button>
      </div>

      <div className='mt-4 space-y-2'>
        {Object.keys(map).map((key) => (
          <div key={key} className='p-2 border rounded text-xs flex items-center justify-between'>
            <code className='opacity-80'>{key}</code>
            <div className='flex items-center gap-2'>
              <code className='opacity-60'>{JSON.stringify(map[key])}</code>
              <button
                className='px-2 py-1 border rounded'
                onClick={() => del(key)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

