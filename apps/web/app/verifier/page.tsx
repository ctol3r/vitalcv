'use client';

import { VerifierPortal } from '@/components/employer/VerifierPortal';
import { AcceptancePanel } from '@/components/verifier/AcceptancePanel'; // Wave 99

export default function VerifierPage() {
  return (
    <>
      <VerifierPortal />
      {/* Wave 99: Credential Acceptance Flow */}
      <div className="px-6 py-10 max-w-2xl mx-auto">
        <AcceptancePanel />
      </div>
    </>
  );
}
