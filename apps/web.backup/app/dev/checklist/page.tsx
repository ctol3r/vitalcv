"use client";
import { useEffect, useState } from 'react';

const API_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/+$/, '');
const base = API_BASE || '';

const LINKS: Record<string, string> = {
  compacts_api: '/api/compacts?compact=imlc',
  telehealth_authz: '/api/telehealth/authz?patient=CA',
  playbook: '/playbook',
  psypact: '/psych/appointment',
  exams: '/admin/exams/mpje',
  audit_proof: '/admin/anchors',
  anchor_canary: '/ops/anchor-canary',
  program_search: '/api/programs/search?q=surgery',
  ncqa_events: '/compliance',
  cred_priv: '/privileging',
  eudi_profiles: '/api/eudi/issuer/profiles'
};

export default function DevChecklist() {
  const [d, setD] = useState<any>({ items: [] });

  useEffect(() => {
    (async () => {
      const r = await fetch(`${base}/dev/checklist`);
      setD(await r.json());
    })();
  }, []);

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Dev Checklist</h1>
      <div className='mt-3 space-y-2'>
        {(d.items || []).map((x: any) => (
          <div key={x.key} className='p-2 border rounded flex items-center justify-between text-xs'>
            <span>{x.label}</span>
            <div className='flex items-center gap-2'>
              <a className='underline' href={LINKS[x.key] || '#'} target='_blank' rel='noreferrer'>
                Open
              </a>
              <span className={'px-2 py-0.5 rounded ' + (x.ok ? 'bg-green-100' : 'bg-red-100')}>
                {x.ok ? 'OK' : 'Missing'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

