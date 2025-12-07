"use client";
import { useEffect, useState } from 'react';

export default function PilotWrap() {
  const [txt, setTxt] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/pilot_wrap.md');
        setTxt(await r.text());
      } catch {
        setTxt('# Pilot Wrap\n(Generate with backend script)');
      }
    })();
  }, []);

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <div
        className='prose'
        dangerouslySetInnerHTML={{ __html: txt.replace(/\n/g, '<br/>') }}
      />
    </div>
  );
}

