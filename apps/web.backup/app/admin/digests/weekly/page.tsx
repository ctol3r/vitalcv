"use client";
import {useEffect,useState} from 'react';

export default function Weekly(){
  const [d,setD]=useState<any>();
  useEffect(()=>{(async()=>{
    const r=await fetch('/api/digests/weekly');
    setD(await r.json());
  })();},[]);

  return (
    <div className='max-w-3xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Weekly Digest</h1>
      {d?<pre className='text-xs bg-gray-50 p-3 rounded'>{JSON.stringify(d,null,2)}</pre>:'Generating…'}
    </div>
  );
}


