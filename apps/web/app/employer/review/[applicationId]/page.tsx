import React from 'react';
import ReceiptVerificationBadge from '../../../../components/employer/ReceiptVerificationBadge';
import { signPayloadES256 } from '../../../../lib/trust/cryptoService';
import {
  ReviewAcknowledgement,
  BoundedSimulationDisclosure,
  ContinuityBridge,
} from '@/components/continuity';

export default async function EmployerReviewPage(props: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await props.params;

  // Bounded simulation: sign a sample receipt so the reviewer can see
  // the signature-verification surface render. proofTier is
  // 'demo_receipt'; this token was NOT produced by the PSV promotion
  // chain and does not represent a real PSVReceipt. It exists only to
  // demonstrate the signature-verification surface in the employer
  // cockpit. The BoundedSimulationDisclosure below names this
  // explicitly.
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
    <div className="p-8 text-foreground bg-background max-w-3xl space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Application Review</h1>
        <p className="text-muted-foreground">ID: {applicationId}</p>
      </header>

      <BoundedSimulationDisclosure
        simulationLabel="Employer review surface"
        whatIsSimulated="A signed demo receipt is generated in-process so the receipt-verification surface renders. Lane states render from fixture data; no application has been read from a credentialing system."
        whatWouldHappenInProduction="The application would be read from the institution’s credentialing system, lanes would carry live operator notes, and acknowledgments would be recorded against the application record."
        whatRemainsInstitutionOwned="The credentialing committee, privileging decision, and final eligibility decisions remain on the institution’s own systems."
      />

      <ReceiptVerificationBadge token={demoToken} />

      <div className="p-4 border rounded-lg">
        <h2 className="font-semibold mb-2">Identity Snapshot</h2>
        <p className="text-sm text-muted-foreground">
          Identity confirmed via NPI lookup. Receipt carries a signed
          source-attestation envelope; final source confirmation
          remains the receiving institution’s read.
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

      <ReviewAcknowledgement
        applicationId={applicationId}
        postures={['accept_as_head_start', 'request_more_info', 'reject']}
      />

      <ContinuityBridge
        fromLabel={`/employer/review/${applicationId}`}
        toLabel="/employer/worklist"
        toHref="/employer/worklist"
        state="ready"
        whatTravels="The application returns to the worklist with the operator's local acknowledgment visible (UI-only). Real workflow state remains in the institution’s system."
        whatStaysBehind="Credentialing committee scheduling, privileging signoff, and the institution’s own credential-decision record all stay institution-owned."
      />
    </div>
  );
}
