"use client";
import { useEffect, useState } from 'react';

export default function PerfHud() {
  const [txt, setTxt] = useState('');

  useEffect(() => {
    (async () => {
      const r = await fetch('/metrics');
      setTxt(await r.text());
    })();
  }, []);

  return (
    <pre className='text-[10px] bg-gray-50 p-2 rounded overflow-auto max-h-60'>
      {txt}
    </pre>
  );
}

