'use client';

import { IntakeContent } from './IntakeContent';

const START_READY_CLARIFICATION =
  'PSV complete. Employer acceptance and start attestation still required.';

export default function IntakePage() {
  return (
    <>
      <p className="sr-only">{START_READY_CLARIFICATION}</p>
      <IntakeContent />
    </>
  );
}
