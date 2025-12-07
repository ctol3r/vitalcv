"use client";
import { useEffect, useState } from 'react';

export default function RBAC() {
  const [perms, setPerms] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [role, setRole] = useState('viewer');
  const [perm, setPerm] = useState('view_invoices');

  async function load() {
    const p = await (await fetch('/rbac/perms')).json();
    setPerms(p.rows || []);
    const r = await (await fetch('/rbac/roleperms')).json();
    setRows(r.rows || []);
  }

  async function add() {
    await fetch('/rbac/roleperms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role, perm_key: perm })
    });
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>RBAC Matrix</h1>
      <div className='p-3 border rounded'>
        <div className='flex gap-2'>
          <select className='p-2 border rounded' value={role} onChange={e => setRole(e.target.value)}>
            <option>admin</option>
            <option>viewer</option>
            <option>member</option>
          </select>
          <select className='p-2 border rounded' value={perm} onChange={e => setPerm(e.target.value)}>
            {perms.map((p: any) => (
              <option key={p.key} value={p.key}>
                {p.key}
              </option>
            ))}
          </select>
          <button className='px-3 py-2 bg-black text-white rounded' onClick={add}>
            Grant
          </button>
        </div>
      </div>
      <div className='mt-4'>
        <pre className='text-xs bg-gray-50 p-3 rounded overflow-auto'>
          {JSON.stringify(rows, null, 2)}
        </pre>
      </div>
    </div>
  );
}

