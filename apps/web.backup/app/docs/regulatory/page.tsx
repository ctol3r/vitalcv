"use client";
import Link from 'next/link';

export default function RegIndex() {
  return (
    <div className='prose max-w-3xl mx-auto py-8 px-4'>
      <h1>Regulatory Knowledge Center</h1>
      <p>Curated, living summaries tied to VitalCV's implementation, with links to primary sources and in-product evidence.</p>
      <ul>
        <li><Link href='/docs/regulatory/eudi'>EUDI Wallet & eIDAS 2.0</Link></li>
        <li><Link href='/docs/regulatory/ncqa'>NCQA 2025 API-first PSP & Traceability</Link></li>
        <li><Link href='/docs/regulatory/psypact'>Behavioral Health Compacts (PSYPACT & Counseling)</Link></li>
        <li><Link href='/docs/regulatory/credentialing-privileging'>Credentialing vs. Privileging</Link></li>
        <li><Link href='/docs/regulatory/cross-licensure'>Cross-Licensure & Telehealth Patterns</Link></li>
        <li><Link href='/docs/regulatory/pa-2025'>PA Credentialing (2025)</Link></li>
      </ul>
      <p className='mt-6'>
        <Link className='inline-flex items-center px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors' href='/compliance/coverage'>Open Regulatory Coverage Dashboard →</Link>
      </p>
    </div>
  );
}

