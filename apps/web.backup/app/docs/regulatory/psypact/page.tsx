"use client";
import Link from 'next/link';

export default function Psy() {
  return (
    <div className='prose max-w-3xl mx-auto py-8 px-4'>
      <h1>Behavioral Health Compacts (PSYPACT & Counseling)</h1>
      <p>PSYPACT enables cross-border telepsychology via APIT (tele) and TAP (temporary in-person) authorities, backed by E.Passport. Counseling Compact enables privilege-to-practice across participating states.</p>
      <h3>Operate</h3>
      <ul>
        <li><Link href='/psych/appointment'>Telepsych mode check (APIT/TAP)</Link></li>
        <li><Link href='/api/psych/psypact/status?npi=YOUR_NPI'>PSYPACT registry status API</Link></li>
        <li><Link href='/ops/tefca/delta'>Directory changes (TEFCA)</Link></li>
      </ul>
    </div>
  );
}

