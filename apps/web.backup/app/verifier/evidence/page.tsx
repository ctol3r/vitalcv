"use client";
import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || '';

export default function Evidence() {
  const [ocr, setOcr] = useState<any>();
  const [anchors, setAnchors] = useState<any>();
  const [bit, setBit] = useState<any>();

  useEffect(() => {
    (async () => {
      const a = await (await fetch(BASE + '/evidence/anchors')).json();
      setAnchors(a);

      const b = await (await fetch('/status/1/bit?index=42')).json();
      setBit(b);

      const o = await (await fetch(BASE + '/evidence/ocr/file_demo')).json();
      setOcr(o);
    })();
  }, []);

  return (
    <div className='max-w-4xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Evidence</h1>

      <h3 className='mt-4 font-semibold'>Status Bit</h3>
      <pre className='text-[10px] bg-gray-50 p-2 rounded overflow-auto'>
        {JSON.stringify(bit, null, 2)}
      </pre>

      <h3 className='mt-4 font-semibold'>Anchors</h3>
      <pre className='text-[10px] bg-gray-50 p-2 rounded overflow-auto'>
        {JSON.stringify(anchors, null, 2)}
      </pre>

      <h3 className='mt-4 font-semibold'>OCR Text</h3>
      <pre className='text-[10px] bg-gray-50 p-2 rounded overflow-auto'>
        {JSON.stringify(ocr, null, 2)}
      </pre>
    </div>
  );
}

