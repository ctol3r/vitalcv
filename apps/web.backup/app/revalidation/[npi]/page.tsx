"use client";
import { useEffect, useState } from 'react';

export default function Rv({ params }: { params: { npi: string } }) {
  const [d, setD] = useState<any>();

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/pecos/detail?npi=' + params.npi);
      setD(await r.json());
    })();
  }, [params.npi]);

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>PECOS Revalidation</h1>
      {d ? (
        <div className='text-sm'>
          <div>
            Due: <b>{d.due_at}</b>
          </div>
          <div>Windows: 90/60/30/7 days</div>
          <a className='underline' href='/api/pecos/calendar.ics'>
            Add to Calendar
          </a>
        </div>
      ) : (
        'Loading…'
      )}
    </div>
  );
}

