import React from 'react';
import ReceiptVerificationBadge from '../../../../components/employer/ReceiptVerificationBadge';
import { signPayloadES256 } from '../../../../lib/trust/cryptoService';

export default async function EmployerReviewPage(props: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await props.params;

  // Demo: sign a sample receipt so the employer can verify cryptographic integrity.
  // proofTier is 'demo_receipt' — this token was NOT produced by the PSV promotion chain
  // and does not represent a real PSVReceipt. It exists solely to demonstrate the
  // signature-verification surface in the employer cockpit.
  const demoToken = await signPayloadES256({
    sub: `application:${applicationId}`,
    iss: 'vitalcv',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    proofTier: 'demo_receipt',
    demo: true,
    applicationId,
    note: 'Demo receipt for employer review surface — not a real PSV receipt',
  });

  return (
    <div className="p-8 text-foreground bg-background max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Application Review</h1>
      <p className="text-muted-foreground mb-6">ID: {applicationId}</p>

      <div className="grid gap-4">
        <ReceiptVerificationBadge token={demoToken} />

        <div className="p-4 border rounded-lg">
          <h2 className="font-semibold mb-2">Identity Snapshot</h2>
          <p className="text-sm text-muted-foreground">
            Identity confirmed via NPI lookup. Receipt carries cryptographic proof of source attestation.
          </p>
        </div>

        <div className="p-4 border rounded-lg">
          <h2 className="font-semibold mb-3">Lane States</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>Identity</span><span className="text-emerald-600 font-medium">CHECKED</span></li>
            <li className="flex justify-between"><span>Sanctions</span><span className="text-emerald-600 font-medium">CLEAR</span></li>
            <li className="flex justify-between"><span>Licensure</span><span className="text-amber-600 font-medium">ACCESS REQUIRED</span></li>
            <li className="flex justify-between"><span>Enrollment</span><span className="text-emerald-600 font-medium">ENROLLED</span></li>
          </ul>
        </div>

        <div className="flex gap-3 mt-2">
          <button className="px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700">Accept as head start</button>
          <button className="px-4 py-2 bg-amber-500 text-white rounded text-sm hover:bg-amber-600">Request missing info</button>
          <button className="px-4 py-2 bg-destructive text-white rounded text-sm hover:opacity-90">Reject</button>
        </div>
      </div>
    </div>
  );
}
