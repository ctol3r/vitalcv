"use client";
import { useEffect, useState } from 'react';

export default function DevRoutes() {
  const [d, setD] = useState<any>({ routes: [] });
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const r = await fetch('/dev/routes');
      setD(await r.json());
    })();
  }, []);

  const rows = (d.routes || []).filter((r: any) => !q || r.path.includes(q));

  return (
    <div className='max-w-4xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>API Routes</h1>

      <input
        className='p-2 border rounded mt-2 mb-3 w-full'
        placeholder='Filter /api/...'
        value={q}
        onChange={e => setQ(e.target.value)}
      />

      <table className='w-full text-xs'>
        <thead>
          <tr>
            <th className='text-left p-2'>Method(s)</th>
            <th className='text-left p-2'>Path</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, i: number) => (
            <tr key={i} className='border-t'>
              <td className='p-2'>{(r.methods || []).join(', ').toUpperCase()}</td>
              <td className='p-2 font-mono'>{r.path}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

