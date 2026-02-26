'use client';

import { VerifierPortal } from '@/components/employer/VerifierPortal';
import ImpactPanel from '@/components/impact/ImpactPanel';

export default function VerifierPage() {
  return (
    <>
      <VerifierPortal />
      <ImpactPanel npi="1003000126" />
    </>
  );
}
