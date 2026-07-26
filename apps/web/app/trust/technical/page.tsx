import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileCode2 } from 'lucide-react';

import { getTrustRegisterSnapshot } from '@/lib/trust/register';
import { TrustStateRegister } from '@/components/trust/TrustStateRegister';
import { TrustRegistryFooter } from '@/components/trust/TrustRegistryFooter';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Trust Register (technical) — VitalCV',
  description:
    "VitalCV's evidence and signing architecture — proof tiers, issuer continuity, and the trust-state grammar. A developer reference, not a clinician record.",
  robots: { index: true, follow: true },
};

export default async function TrustTechnicalPage() {
  const snapshot = await getTrustRegisterSnapshot();
  return (
    <div>
      {/* Required technical-reference notice (audit item #3). */}
      <div className="border-b border-gray-800 bg-black/40 px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-start gap-3">
          <FileCode2 size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-gray-500" />
          <div className="space-y-1.5">
            <p className="text-[13px] leading-relaxed text-gray-300">
              This page explains VitalCV&rsquo;s evidence and signing architecture. It is not a clinician record and
              does not represent a completed credentialing decision.
            </p>
            <p className="text-[12px] leading-relaxed text-gray-500">
              The state rows below are an <strong className="font-semibold text-gray-400">architectural illustration</strong> of
              the trust-state grammar (example run ids and timestamps), not live source-check results. For a
              human-readable overview, see the{' '}
              <Link href="/trust" className="text-gray-300 underline underline-offset-2 hover:text-white">
                Trust Center
              </Link>
              . The machine-readable register is served at{' '}
              <code className="rounded bg-gray-900 px-1 py-0.5 font-mono text-[11px] text-gray-400">
                /.well-known/trust-register
              </code>
              .
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-4">
        <Link
          href="/trust"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-500 underline-offset-4 hover:text-gray-300 hover:underline"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          Back to the Trust Center
        </Link>
      </div>

      <TrustStateRegister snapshot={snapshot} />
      <TrustRegistryFooter />
    </div>
  );
}
