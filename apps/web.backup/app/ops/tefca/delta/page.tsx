'use client';
import { useEffect, useState } from 'react';

export default function TD() {
  const [d, setD] = useState<any>({ added: [], updated: [] });

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/tefca/delta');
      setD(await r.json());
    })();
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-xl font-bold">TEFCA Delta</h1>
      <a
        className="px-3 py-2 border rounded text-xs"
        href="/api/tefca/delta.csv"
        target="_blank"
      >
        Export CSV
      </a>
      <div className="grid md:grid-cols-2 gap-3 mt-3">
        <div className="p-3 border rounded text-xs">
          <b>Added</b>
          <ul className="list-disc ml-5">
            {(d.added || []).map((x: string, i: number) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
        <div className="p-3 border rounded text-xs">
          <b>Updated</b>
          <ul className="list-disc ml-5">
            {(d.updated || []).map((x: string, i: number) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
