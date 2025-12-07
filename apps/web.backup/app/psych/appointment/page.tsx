"use client";import {useEffect,useState} from 'react'; export default function PsychAppt(){ const [mode,setMode]=useState('tele'); const [npi,setNpi]=useState(''); const [status,setStatus]=useState<any>(); async function check(){ const r=await fetch('/api/psych/psypact/status?npi='+encodeURIComponent(npi)); setStatus(await r.json()); }
  return (<div className='max-w-3xl mx-auto py-8'>
    <h1 className='text-xl font-bold'>Psych Appointment</h1>
    <div className='flex gap-2 mt-2'>
      <input className='p-2 border rounded' placeholder='NPI' value={npi} onChange={e=>setNpi(e.target.value)} />
      <select className='p-2 border rounded' value={mode} onChange={e=>setMode(e.target.value)}><option value='tele'>Telepsychology</option><option value='temp'>Temporary In-Person</option></select>
      <button className='px-3 py-2 bg-black text-white rounded' onClick={check}>Check PSYPACT</button>
    </div>
    {status && <div className='mt-3 text-xs'>APIT: <b>{String(status.apit)}</b> • TAP: <b>{String(status.tap)}</b> • E.Passport: <b>{status.epassport||'-'}</b> • Expires: {status.expires_at? new Date(status.expires_at).toLocaleDateString(): '-'}</div>}
  </div>);
}

