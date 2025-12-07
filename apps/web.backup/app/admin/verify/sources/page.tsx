'use client';
import { useEffect, useState } from 'react';

const SRCS = ['license', 'board', 'dea', 'npdb', 'oig', 'caqh', 'pecos'];

export default function Sources() {
  const [m, setM] = useState<any>({});

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/verify/sources/modes');
      setM(await r.json());
    })();
  }, []);

  async function save(k: string, val: string) {
    await fetch('/admin/flags', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: `source.${k}.mode`, value: val }),
    });
    const r = await fetch('/api/verify/sources/modes');
    setM(await r.json());
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-xl font-bold">PSV Sources</h1>
      <div className="grid md:grid-cols-2 gap-3 mt-3">
        {SRCS.map(k => (
          <div key={k} className="p-3 border rounded text-xs flex items-center justify-between">
            <div className="font-semibold">{k.toUpperCase()}</div>
            <select
              className="p-1 border rounded"
              value={m[k] || 'mock'}
              onChange={e => save(k, e.target.value)}
            >
              <option value="mock">mock</option>
              <option value="api">api</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

