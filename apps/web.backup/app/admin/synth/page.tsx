"use client";

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || '';

export default function Synth() {
  async function call(p: string) {
    const r = await fetch(p);
    alert(await r.text());
  }

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Synthetics</h1>
      <div className='flex gap-2 mt-2'>
        <button
          className='px-3 py-2 bg-black text-white rounded'
          onClick={() => call('/api/demo/run')}
        >
          Demo Flow
        </button>
        <a className='px-3 py-2 border rounded' href='/docs/bugbash'>
          Open Bug-Bash
        </a>
      </div>
    </div>
  );
}

