"use client";
import Link from 'next/link';

export default function Cross() {
  return (
    <div className='prose max-w-3xl mx-auto py-8 px-4'>
      <h1>Cross-Licensure & Telehealth Patterns (2025)</h1>
      <p>Telehealth follows the patient's location. Compacts (IMLC, NLC, APRN, PSYPACT) and state registrations accelerate cross-state coverage. VitalCV's Telehealth AuthZ stitches together license, compact privileges, and state regs.</p>
      <ul>
        <li><Link href='/'>Compact Map</Link></li>
        <li><Link href='/telehealth'>Patient-state AuthZ check</Link></li>
      </ul>
    </div>
  );
}

