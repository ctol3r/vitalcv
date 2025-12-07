"use client";
import { useEffect, useState } from 'react';

export default function Billing() {
  const [org, setOrg] = useState('default');
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    const r = await fetch('/billing/invoices', { headers: { 'x-org-id': org } });
    const js = await r.json();
    setRows(js.rows || []);
  }

  async function gen() {
    await fetch('/billing/invoice/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ org_id: org })
    });
    await load();
  }

  async function pay(id: string) {
    await fetch('/billing/invoice/pay', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invoice_id: id })
    });
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Billing Center</h1>
      <div className='flex gap-2 mt-2'>
        <input
          className='p-2 border rounded'
          value={org}
          onChange={e => setOrg(e.target.value)}
        />
        <button className='px-3 py-2 bg-black text-white rounded' onClick={gen}>
          Generate Invoice
        </button>
      </div>
      <div className='mt-4 space-y-2'>
        {rows.map((r: any) => (
          <div key={r.id} className='p-3 border rounded text-sm'>
            <div>
              <b>{r.month}</b> — {r.currency} {r.total} • <span className='uppercase'>{r.status}</span>
            </div>
            <div className='mt-1 flex gap-2'>
              <a className='px-2 py-1 border rounded' href={'/billing/invoice/pdf'} target='_blank'>
                Open PDF
              </a>
              {r.status !== 'paid' && (
                <button className='px-2 py-1 bg-black text-white rounded' onClick={() => pay(r.id)}>
                  Mark Paid
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

