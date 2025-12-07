"use client";
import Link from 'next/link';

export default function PA2025() {
  return (
    <div className='prose max-w-3xl mx-auto py-8 px-4'>
      <h1>PA Credentialing — 2025 Update</h1>
      <p>Implements ARC-PA & NCCPA pathways; models PANRE-LA windows; enforces DEA MATE training; tracks CMS-855R/I consolidation for Medicare enrollment; and schedules NPDB queries.</p>
      <ul>
        <li><Link href='/compliance'>PA compliance cards</Link></li>
      </ul>
    </div>
  );
}

