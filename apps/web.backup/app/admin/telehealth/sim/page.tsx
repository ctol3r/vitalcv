"use client";

import { useState } from 'react';

/**
 * Telehealth What-If Simulator
 * Test authorization across multiple profession types for a given patient state
 */

interface SimResult {
  profession: string;
  authorized: boolean;
  reasons: string;
}

export default function TelehealthSim() {
  const [st, setSt] = useState('CA');
  const [out, setOut] = useState<SimResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!st || st.length !== 2) {
      alert('Please enter a valid 2-letter state code');
      return;
    }

    setLoading(true);
    const profs = ['physician', 'nurse', 'aprn', 'psych', 'pt', 'ot', 'pharmacist'];
    const rows: SimResult[] = [];

    try {
      for (const p of profs) {
        const r = await fetch(`/api/telehealth/authz?patient=${st}&profession=${p}`);
        const js = await r.json();
        rows.push({
          profession: p,
          authorized: js.authorized || false,
          reasons: js.reasons?.join('; ') || js.error || 'Unknown'
        });
      }
      setOut(rows);
    } catch (error) {
      console.error('Simulation error:', error);
    } finally {
      setLoading(false);
    }
  }

  function csv() {
    const head = 'profession,authorized,reasons\n';
    const body = out.map(r => `${r.profession},${r.authorized},"${r.reasons}"`).join('\n');
    const blob = new Blob([head + body], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `authz_${st}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  return (
    <div className='max-w-4xl mx-auto py-8 px-4'>
      <h1 className='text-2xl font-bold mb-2'>Telehealth What-If Simulator</h1>
      <p className='text-gray-600 mb-6'>
        Simulate telehealth authorization across multiple profession types for a patient state
      </p>

      <div className='flex gap-2 mb-6'>
        <div className='flex-1'>
          <label className='block text-sm font-medium mb-1'>Patient State</label>
          <input
            className='p-2 border rounded w-24 uppercase font-mono'
            value={st}
            onChange={e => setSt(e.target.value.toUpperCase())}
            placeholder='CA'
            maxLength={2}
          />
        </div>

        <div className='flex items-end gap-2'>
          <button
            className='px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50'
            onClick={run}
            disabled={loading}
          >
            {loading ? 'Running...' : 'Run Simulation'}
          </button>
          <button
            className='px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50'
            onClick={csv}
            disabled={!out.length}
          >
            Export CSV
          </button>
        </div>
      </div>

      {!!out.length && (
        <>
          <div className='border rounded-lg overflow-hidden mb-4'>
            <table className='w-full'>
              <thead className='bg-gray-50 border-b'>
                <tr>
                  <th className='text-left p-3 font-semibold'>Profession</th>
                  <th className='text-left p-3 font-semibold'>Authorized</th>
                  <th className='text-left p-3 font-semibold'>Reasons</th>
                </tr>
              </thead>
              <tbody>
                {out.map((r, idx) => (
                  <tr key={idx} className='border-b last:border-b-0 hover:bg-gray-50'>
                    <td className='p-3 font-medium capitalize'>{r.profession}</td>
                    <td className='p-3'>
                      <span className={`px-2 py-1 rounded text-sm ${
                        r.authorized
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {r.authorized ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className='p-3 text-sm text-gray-600'>{r.reasons}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className='mt-4'>
            <summary className='cursor-pointer text-sm text-gray-600 hover:text-gray-900'>
              View Raw JSON
            </summary>
            <pre className='mt-2 text-xs bg-gray-50 p-3 rounded overflow-x-auto border'>
              {JSON.stringify(out, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}

