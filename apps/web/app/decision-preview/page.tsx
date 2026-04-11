/**
 * DecisionBlock preview page (verification only).
 * Renders the new decision-grade UI with a fixed CONDITIONAL_READY fixture
 * so the component can be inspected without depending on the api backend.
 *
 * Route: /decision-preview
 */
'use client';

import { DecisionBlock } from '@/components/review/DecisionBlock';
import type { PassportData } from '@/lib/trust/passport-contract';

const fixturePassport = {
  identity: {
    displayName: 'Dr. Maya Patel, MD',
    specialty: 'Internal Medicine',
  },
  authority: {
    credentials: [
      {
        domain: 'LICENSURE',
        status: 'ACTIVE',
      },
    ],
  },
  standing: {
    exclusionStatus: 'UNCHECKED',
    pecosEnrollmentStatus: 'NOT_FOUND',
  },
  // The component falls back to the dimension-derivation path when
  // decisionPosture is absent — that's the path we want to exercise.
  decisionPosture: undefined,
} as unknown as PassportData;

export default function DecisionPreviewPage() {
  return (
    <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center px-4 pt-10 pb-20">
      <div className="w-full max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground/50 text-xs tracking-widest uppercase">
            VitalCV
          </span>
          <span className="text-muted-foreground/50 text-xs">Decision preview</span>
        </div>
        <DecisionBlock
          passport={fixturePassport}
          canPersistActions={false}
          previewOnlyMessage="Preview only — no actions persisted."
          onAccept={() => {}}
          onRequestRefresh={() => {}}
          onRouteToReview={() => {}}
        />
      </div>
    </main>
  );
}
