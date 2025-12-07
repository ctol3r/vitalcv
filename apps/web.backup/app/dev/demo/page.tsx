"use client";
import { useEffect, useState } from 'react';

export default function Demo() {
  const [rows, setRows] = useState<any[]>([]);
  const [log, setLog] = useState('');

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/dev/demo-scenarios');
      const js = await r.json();
      setRows(js.rows || []);
    })();
  }, []);

  async function run(id: string) {
    const r = await fetch('/api/dev/demo-scenarios/apply', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id })
    });
    setLog(await r.text());
  }

  return (
    <div className='max-w-4xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Demo Scenarios</h1>
      <div className='grid md:grid-cols-2 gap-3 mt-3'>
        {rows.map((s: any) => (
          <div key={s.id} className='p-3 border rounded text-sm'>
            <div className='font-semibold'>{s.label}</div>
            <div className='text-xs opacity-70'>id: {s.id}</div>
            <div className='mt-2 flex gap-2'>
              <button
                className='px-3 py-2 bg-black text-white rounded'
                onClick={() => run(s.id)}
              >
                Run
              </button>
              <a
                className='px-3 py-2 border rounded'
                href='/admin/verify/live'
                target='_blank'
              >
                Live Verifies
              </a>
              <a
                className='px-3 py-2 border rounded'
                href='/playbook'
                target='_blank'
              >
                Playbook
              </a>
              <a
                className='px-3 py-2 border rounded'
                href='/admin/digests/heatmap'
                target='_blank'
              >
                Heatmap
              </a>
            </div>
          </div>
        ))}
      </div>
      {log && (
        <pre className='text-xs bg-gray-50 p-3 rounded mt-3 overflow-auto'>
          {log}
        </pre>
      )}
    </div>
  );
}

