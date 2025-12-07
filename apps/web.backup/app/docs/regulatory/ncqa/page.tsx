"use client";
import Link from 'next/link';

export default function NCQA() {
  return (
    <div className='prose max-w-3xl mx-auto py-8 px-4'>
      <h1>NCQA 2025 & Joint Commission Traceability</h1>
      <p>VitalCV captures <em>VerificationEvents</em> with method, timestamp, source URL, and evidence hash (CR1–CR5). Monthly anchors ensure every verification is traceable, supporting Joint Commission Accreditation 360.</p>
      <h3>Key Capabilities</h3>
      <ul>
        <li>PSV via API (license, board, DEA, NPDB, OIG, CAQH)</li>
        <li>120-day (90-day for CVO) monitoring windows</li>
        <li>Immutable audit proofs (Merkle rooted on chain)</li>
      </ul>
      <h3>Inspect & Export</h3>
      <ul>
        <li><Link href='/compliance'>Compliance dashboard</Link> (events & windows)</li>
        <li><Link href='/api/anchor/verify'>Proof verifier</Link> · <Link href='/ops/anchor-canary'>Anchor canary</Link></li>
        <li><Link href='/api/playbook/export.csv?profession=physician&state=CA'>Playbook CSV</Link></li>
      </ul>
    </div>
  );
}

