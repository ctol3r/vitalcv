"use client";
import { useEffect, useState } from 'react';

export default function Revocation({ params }: { params: { did: string } }) {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/revocation/timeline/' + encodeURIComponent(params.did));
      const js = await r.json();
      setRows(js.rows || []);
    })();
  }, [params.did]);

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Revocation Timeline</h1>
      <div className='mt-4 space-y-2'>
        {rows.map((x: any) => (
          <div key={x.id} className='p-3 border rounded text-xs'>
            <b>{x.status.toUpperCase()}</b> • {x.cred_type} <code>{x.cred_id}</code> — {x.reason || '-'}
            <span className='opacity-60'> ({new Date(x.created_at).toLocaleString()})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

