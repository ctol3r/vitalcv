"use client";import {useEffect,useState} from 'react'; export default function PB(){ const [prof,setProf]=useState('physician'); const [st,setSt]=useState('CA'); const [out,setOut]=useState<any>(); async function load(){ const r=await fetch(`/api/playbook?profession=${prof}&state=${st}`); setOut(await r.json()); } useEffect(()=>{ load(); },[prof,st]); async function csv(){ location.href=`/api/playbook/export.csv?profession=${prof}&state=${st}`; } async function bulk(){ const body={professions:['physician','aprn','psych'],states:['CA','FL','TX','NY']}; const r=await fetch('/api/playbook/export.bulk.csv',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); const t=await r.text(); const blob=new Blob([t],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='playbook_bulk.csv'; a.click(); }
  return (<div className='max-w-3xl mx-auto py-8'>
    <h1 className='text-xl font-bold'>Compliance Playbook</h1>
    <div className='flex gap-2 mt-2'>
      <select className='p-2 border rounded' value={prof} onChange={e=>setProf(e.target.value)}><option value='physician'>Physician</option><option value='aprn'>APRN/NP</option><option value='psych'>Psychology</option><option value='pt'>PT</option><option value='ot'>OT</option><option value='pharmacist'>Pharmacist</option></select>
      <input className='p-2 border rounded w-16' value={st} onChange={e=>setSt(e.target.value.toUpperCase())}/>
      <button className='px-3 py-2 border rounded' onClick={csv}>Export CSV</button>
      <button className='px-3 py-2 bg-black text-white rounded' onClick={bulk}>Bulk Export</button>
    </div>
    {out&&<ol className='mt-4 list-decimal ml-6 text-sm'>{out.steps.map((s:string,i:number)=>(<li key={i} className='py-1'>{s}</li>))}</ol>}
  </div>);
}
