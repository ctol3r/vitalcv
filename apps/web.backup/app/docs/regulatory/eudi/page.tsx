"use client";
import Link from 'next/link';

export default function EUDI() {
  return (
    <div className='prose max-w-3xl mx-auto py-8 px-4'>
      <h1>EUDI Wallet & eIDAS 2.0 Readiness</h1>
      <p>Overview of EU trust-service alignment: trusted lists (ETSI TS 119 612), qualified trust service providers, and selective disclosure (SD-JWT/BBS+). VitalCV's issuer profiles integrate OIDC4VCI with per-profile assurance levels and trust-list checks.</p>
      <h3>What VitalCV Implements</h3>
      <ul>
        <li>Trusted-list sync + validity checks (ETSI TS 119 612). <Link href='/api/digests/weekly'>Digest</Link>, <Link href='/public-docs'>Sources</Link></li>
        <li>Issuance profiles via <code>/api/eudi/issuer/profiles</code>, gated by trust-provider presence</li>
        <li>SD-JWT and BBS+ proof options (configurable per profile)</li>
      </ul>
      <h3>Operate</h3>
      <ul>
        <li><Link href='/public-docs'>Read: EUDI legal acts</Link></li>
        <li><Link href='/api/pecos/calendar.ics'>Download ICS (for revalidation timelines)</Link></li>
        <li><Link href='/api/oidc4vci/offer'>Test OIDC4VCI offer</Link></li>
        <li><Link href='/api/anchor/verify'>Verify anchor (post-cutover)</Link></li>
      </ul>
    </div>
  );
}

