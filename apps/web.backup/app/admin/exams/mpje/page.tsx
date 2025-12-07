"use client";
import { useEffect, useState } from 'react';

export default function MPJE() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const ALL = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
    'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA',
    'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE',
    'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI',
    'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY'
  ];

  async function load() {
    const r = await fetch('/api/exams/mpje/state/CA'); /* dummy check to ensure route exists */
    const list = await fetch('/admin/api/exams/mpje/adoption');
    const js = await list.json();
    setRows(js.rows || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function setState(st: string, uniform: boolean) {
    await fetch('/admin/api/exams/mpje/adoption', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: st, uniform })
    });
    load();
  }

  const adopted = new Map(rows.map((r: any) => [r.state, r.uniform]));
  const fil = ALL.filter(s => !q || s.includes(q.toUpperCase()));

  return (
    <div className='max-w-5xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Uniform MPJE Adoption</h1>
      <div className='flex gap-2 mt-3'>
        <input
          className='p-2 border rounded'
          placeholder='Filter by state'
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <button
          className='px-3 py-2 border rounded'
          onClick={() => ALL.forEach(s => setState(s, true))}
        >
          Adopt All
        </button>
        <button
          className='px-3 py-2 border rounded'
          onClick={() => ALL.forEach(s => setState(s, false))}
        >
          Clear All
        </button>
      </div>
      <div className='grid grid-cols-10 gap-2 mt-3'>
        {fil.map(s => (
          <label
            key={s}
            className={`text-xs flex items-center gap-1 border rounded px-2 py-1 ${
              adopted.get(s) ? 'bg-green-50' : ''
            }`}
          >
            <input
              type='checkbox'
              checked={!!adopted.get(s)}
              onChange={(e) => setState(s, e.target.checked)}
            />
            {s}
          </label>
        ))}
      </div>
    </div>
  );
}
