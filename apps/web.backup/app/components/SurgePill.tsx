"use client";
import { useState, useEffect } from 'react';

export default function SurgePill() {
  const [txt, setTxt] = useState<string | null>(null);

  useEffect(() => {
    const _fetch = window.fetch;
    (window as any).fetch = async (...a: any) => {
      const r = await _fetch(...a);
      if (r.status === 429) {
        setTxt('Surge: try again in a moment');
      }
      if (r.status === 503) {
        setTxt('Circuit open: system recovering');
      }
      return r;
    };
  }, []);

  if (!txt) return null;

  return (
    <span className='text-[10px] px-2 py-0.5 rounded bg-orange-100 border border-orange-300 text-orange-900'>
      {txt}
    </span>
  );
}

