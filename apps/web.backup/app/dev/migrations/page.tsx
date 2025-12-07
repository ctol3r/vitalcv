"use client";
import { useEffect, useState } from 'react';

export default function DevMigrations() {
  const [d, setD] = useState<any>({ applied: [], pending: [] });
  const [applying, setApplying] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  async function load() {
    const r = await fetch('/dev/migrations');
    setD(await r.json());
  }

  useEffect(() => {
    load();

    (async () => {
      try {
        const res = await fetch('/api/dev/me');
        const json = await res.json();
        setRole(json.role || 'viewer');
      } catch (error) {
        console.error('Failed to fetch user role:', error);
        setRole('viewer');
      } finally {
        setRoleLoading(false);
      }
    })();
  }, []);

  async function applyMigrations() {
    setApplying(true);
    try {
      const r = await fetch('/dev/migrations/apply', { method: 'POST' });
      const t = await r.text();
      alert(t);
      load();
    } catch (e) {
      alert('Error: ' + e);
    } finally {
      setApplying(false);
    }
  }

  const isAdmin = role === 'admin';

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Migrations</h1>

      {!roleLoading && !isAdmin && (
        <div className='mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs'>
          ⚠️ Admin privileges required to apply migrations.
          Current role: <code className='bg-yellow-100 px-1 py-0.5 rounded'>{role}</code>
        </div>
      )}

      <div className='mt-4'>
        <div className='font-semibold'>Applied</div>
        <ul className='text-xs list-disc ml-5'>
          {(d.applied || []).map((m: any, i: number) => (
            <li key={i}>
              <b>{m.migration_name}</b> — {m.applied_at || '-'}
            </li>
          ))}
        </ul>
      </div>

      <div className='mt-4'>
        <div className='font-semibold'>Pending</div>
        <ul className='text-xs list-disc ml-5'>
          {(d.pending || []).map((m: string, i: number) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      </div>

      <button
        className='mt-3 px-3 py-2 bg-black text-white rounded disabled:opacity-50'
        onClick={applyMigrations}
        disabled={applying || !d.pending || d.pending.length === 0 || !isAdmin}
        title={!isAdmin ? 'Admin only - contact an administrator' : ''}
      >
        {applying ? 'Applying...' : 'Apply Migrations'}
      </button>
      <p className='text-[11px] opacity-60 mt-1'>
        Requires server env DEV_ALLOW_MIGRATE=1 {!isAdmin && '(and admin role)'}
      </p>
    </div>
  );
}

