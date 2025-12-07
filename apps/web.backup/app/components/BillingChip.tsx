"use client";
import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE?.replace('/api/agent', '') || 'http://localhost:4000';

export default function BillingChip() {
  const [t, setT] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BASE}/billing/invoices`, {
          headers: { 'x-org-id': 'default' },
        });
        const js = await r.json();
        const open = (js.rows || []).filter((x: any) => x.status !== 'paid');
        setT(open.length ? `${open.length} open invoice(s)` : 'billing: clear');
      } catch {
        setT('billing: —');
      }
    })();
  }, []);

  return (
    <span className='text-xs px-2 py-1 rounded bg-teal-50 border border-teal-200 dark:bg-teal-900 dark:border-teal-700'>
      {t}
    </span>
  );
}

