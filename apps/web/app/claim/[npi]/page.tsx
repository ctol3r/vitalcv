'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import ClaimWizardPane from '@/components/claim/ClaimWizardPane';
import ClaimWizard from '@/components/claim/ClaimWizard';

export default function ClaimPage() {
  const { npi } = useParams<{ npi: string }>();
  const router = useRouter();
  const [open, setOpen] = useState(true);

  return (
    <>
      <ClaimWizardPane
        open={open}
        onClose={() => {
          setOpen(false);
          router.push(`/npi/${npi}`);
        }}
      >
        <ClaimWizard
          npi={String(npi)}
          onClose={() => {
            setOpen(false);
            router.push(`/npi/${npi}`);
          }}
        />
      </ClaimWizardPane>
      <div className="p-6 text-center text-gray-500">Opening claim wizard…</div>
    </>
  );
}
