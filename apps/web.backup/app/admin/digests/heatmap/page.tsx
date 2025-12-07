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

export default function Heat() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/digests/heatmap');
      const js = await r.json();
      setRows(js.rows || []);
    })();
  }, []);

  const map = new Map(rows.map((r: any) => [r.state, r]));

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-xl font-bold">Weekly State Changes</h1>
      <div className="grid grid-cols-10 gap-2 mt-3">
        {ALL.map((s) => {
          const r = map.get(s);
          const ch = r?.changed;
          const tip = r
            ? `compacts:${r.buckets.compacts} rules:${r.buckets.state_rules} mpje:${r.buckets.mpje}`
            : '';
          return (
            <div
              key={s}
              className={
                'px-2 py-1 text-xs border rounded cursor-pointer hover:opacity-80 ' +
                (ch ? 'bg-red-100' : 'bg-green-100')
              }
              title={tip}
              onClick={() => (window.location.href = `/admin/digests/diff/${s}`)}
              onKeyDown={(e) =>
                e.key === 'Enter' && (window.location.href = `/admin/digests/diff/${s}`)
              }
              role="button"
              tabIndex={0}
            >
              {s}
            </div>
          );
        })}
      </div>
    </div>
  );
}
