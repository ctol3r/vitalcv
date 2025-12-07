"use client";
import { useState } from 'react';

export default function Cache() {
  const [st, setSt] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[]>([]);

  async function search() {
    const r = await fetch(`/api/verify/license/cache/search?state=${encodeURIComponent(st)}&q=${encodeURIComponent(q)}`);
    const js = await r.json();
    setRows(js.rows || []);
  }

  async function purge(state: string, number: string) {
    await fetch(`/api/verify/license/cache?state=${state}&number=${number}`, { method: 'DELETE' });
    search();
  }

  async function refresh(state: string, number: string) {
    await fetch(`/api/verify/license/refresh?state=${state}&number=${number}`, { method: 'POST' });
    search();
  }

  return (
    <div className='max-w-4xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>License Cache</h1>
      <div className='flex gap-2 text-xs items-center mt-2'>
        <input
          className='p-2 border rounded w-16'
          placeholder='state'
          value={st}
          onChange={e => setSt(e.target.value.toUpperCase())}
        />
        <input
          className='p-2 border rounded flex-1'
          placeholder='license or name'
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <button className='px-3 py-2 border rounded' onClick={search}>
          Search
        </button>
      </div>
      <div className='mt-3 space-y-2'>
        {rows.map((r: any, i: number) => (
          <div key={i} className='p-2 border rounded text-xs flex items-center justify-between'>
            <div>{r.state} • {r.license_number} — {r.name || '-'} • {r.status || '-'}</div>
            <div className='flex gap-2'>
              <button className='px-2 py-1 border rounded' onClick={() => refresh(r.state, r.license_number)}>
                Refresh
              </button>
              <button className='px-2 py-1 border rounded' onClick={() => purge(r.state, r.license_number)}>
                Purge
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

