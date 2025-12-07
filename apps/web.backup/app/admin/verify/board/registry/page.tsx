'use client';
import { useEffect, useState } from 'react';

const ALL = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'DC',
  'FL',
  'GA',
  'HI',
  'IA',
  'ID',
  'IL',
  'IN',
  'KS',
  'KY',
  'LA',
  'MA',
  'MD',
  'ME',
  'MI',
  'MN',
  'MO',
  'MS',
  'MT',
  'NC',
  'ND',
  'NE',
  'NH',
  'NJ',
  'NM',
  'NV',
  'NY',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VA',
  'VT',
  'WA',
  'WI',
  'WV',
  'WY',
];

export default function Registry() {
  const [rows, setRows] = useState<any[]>([]);
  const [sel, setSel] = useState('CA');
  const [url, setUrl] = useState('');
  const [auth, setAuth] = useState('');

  async function load() {
    const r = await fetch('/api/verify/board/registry');
    const js = await r.json();
    setRows(js.rows || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    await fetch('/api/verify/board/registry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: sel, endpoint_url: url, auth_header: auth || null }),
    });
    load();
  }

  const map = new Map(rows.map((r: any) => [r.state, r]));

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-xl font-bold">Board Endpoint Registry</h1>
      <div className="flex gap-2 text-xs items-center mt-2">
        <select
          className="p-2 border rounded"
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          aria-label="Select state"
        >
          {ALL.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <input
          className="p-2 border rounded flex-1"
          placeholder="https://api.board/{number}"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <input
          className="p-2 border rounded flex-1"
          placeholder='{"Authorization":"Bearer ..."}'
          value={auth}
          onChange={(e) => setAuth(e.target.value)}
        />
        <button className="px-3 py-2 bg-black text-white rounded" onClick={save}>
          Save
        </button>
      </div>
      <div className="mt-3 text-xs">
        <pre className="bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(rows, null, 2)}</pre>
      </div>
    </div>
  );
}
