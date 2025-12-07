"use client";
import { useState } from 'react';

export default function TelehealthBar() {
  const [st, setSt] = useState('CA');
  const [prof, setProf] = useState('physician');
  const [mode, setMode] = useState('tele');
  const [out, setOut] = useState<any>();

  async function run() {
    const r = await fetch(`/api/telehealth/authz?patient=${st}&profession=${prof}&mode=${mode}`);
    setOut(await r.json());
  }

  return (
    <div className='flex gap-2 items-center text-xs'>
      <select className='p-1 border rounded' value={prof} onChange={e => setProf(e.target.value)}>
        <option value='physician'>Physician</option>
        <option value='nurse'>Nurse</option>
        <option value='aprn'>APRN</option>
        <option value='psych'>Psych</option>
        <option value='pt'>PT</option>
        <option value='ot'>OT</option>
      </select>
      {prof === 'psych' && (
        <select className='p-1 border rounded' value={mode} onChange={e => setMode(e.target.value)}>
          <option value='tele'>Tele</option>
          <option value='temp'>Temp</option>
        </select>
      )}
      <input
        className='p-1 border rounded w-16'
        value={st}
        onChange={e => setSt(e.target.value.toUpperCase())}
      />
      <button className='px-2 py-1 border rounded' onClick={run}>
        AuthZ
      </button>
      <span>{out ? (out.authorized ? 'OK' : 'BLOCK') : ''}</span>
    </div>
  );
}
