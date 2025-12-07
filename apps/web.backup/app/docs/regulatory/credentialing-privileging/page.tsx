"use client";
import Link from 'next/link';

export default function CP() {
  return (
    <div className='prose max-w-3xl mx-auto py-8 px-4'>
      <h1>Credentialing vs. Privileging</h1>
      <p>Clarifies the cut between verified qualifications (credentialing) and facility-specific permission to practice (privileging), including temporary privileges (≤120 days) and FPPE/OPPE touchpoints.</p>
      <ul>
        <li><Link href='/credentialing'>Credentialing dashboard</Link></li>
        <li><Link href='/privileging'>Privilege workflow</Link></li>
      </ul>
    </div>
  );
}

