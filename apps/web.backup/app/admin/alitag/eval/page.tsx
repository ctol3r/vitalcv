"use client";
import { useEffect, useState } from 'react';

export default function AlitagEval() {
  const [d, setD] = useState<any>({ last30d: [] });

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/alitag/eval');
      setD(await r.json());
    })();
  }, []);

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>ALITA-G Eval</h1>
      <ul className='mt-3 text-xs'>
        {d.last30d.map((x: any, i: number) => (
          <li key={i} className='flex gap-2'>
            <span className='w-32'>{x.domain}</span>
            <span
              className='bg-black h-2 inline-block'
              style={{ width: `${10 + x.c * 4}px` }}
            />
            {x.c}
          </li>
        ))}
      </ul>
    </div>
  );
}

