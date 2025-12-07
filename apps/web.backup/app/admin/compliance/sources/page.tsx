"use client";
import { useEffect, useState } from 'react';

const SRCS = ['license', 'board', 'dea', 'npdb', 'oig', 'caqh', 'pecos'];

export default function Sources() {
  const [tenant, setTenant] = useState('default');
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<Record<string, any>>({});

  async function load() {
    const r = await fetch('/api/compliance/source-config?tenant=' + tenant);
    const js = await r.json();
    setRows(js.rows || []);
    const m: any = {};
    (js.rows || []).forEach((x: any) => (m[x.source] = x));
    setForm(m);
  }

  useEffect(() => {
    load();
  }, [tenant]);

  async function save(k: string) {
    const b = {
      tenant_id: tenant,
      source: k,
      endpoint_url: form[k]?.endpoint_url || '',
      auth_header_json: form[k]?.auth_header_json || '',
      mode: form[k]?.mode || 'mock',
    };
    await fetch('/api/compliance/source-config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(b),
    });
    load();
  }

  function up(k: string, f: string, v: any) {
    setForm((s: any) => ({ ...s, [k]: { ...(s[k] || {}), [f]: v } }));
  }

  return (
    <div className="max-w-5xl mx-auto py-8">
      <h1 className="text-xl font-bold">PSV Sources (Tenant)</h1>
      <div className="flex gap-2 text-xs items-center mt-4">
        <input
          className="p-2 border rounded"
          placeholder="tenant id"
          value={tenant}
          onChange={(e) => setTenant(e.target.value)}
        />
        <button className="px-3 py-2 border rounded" onClick={load}>
          Load
        </button>
      </div>
      <div className="grid md:grid-cols-2 gap-3 mt-3">
        {SRCS.map((k) => (
          <div key={k} className="p-3 border rounded text-xs space-y-2">
            <div className="font-semibold">{k.toUpperCase()}</div>
            <div>
              Mode:{' '}
              <select
                className="p-1 border rounded"
                value={form[k]?.mode || 'mock'}
                onChange={(e) => up(k, 'mode', e.target.value)}
              >
                <option value="mock">mock</option>
                <option value="api">api</option>
              </select>
            </div>
            <div>
              Endpoint URL:{' '}
              <input
                className="p-1 border rounded w-full"
                value={form[k]?.endpoint_url || ''}
                onChange={(e) => up(k, 'endpoint_url', e.target.value)}
              />
            </div>
            <div>
              Auth JSON:{' '}
              <textarea
                className="p-1 border rounded w-full"
                rows={3}
                value={form[k]?.auth_header_json || ''}
                onChange={(e) => up(k, 'auth_header_json', e.target.value)}
              />
            </div>
            <button className="px-3 py-2 border rounded" onClick={() => save(k)}>
              Save
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

