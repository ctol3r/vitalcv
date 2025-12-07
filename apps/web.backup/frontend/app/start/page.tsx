'use client';

import React from 'react';
import ClaimWizard from '../../components/ClaimWizard';

export default function StartPage() {
  const handleComplete = (claimId: string) => {
    console.log('Claim completed:', claimId);
    // Handle completion (e.g., redirect, show success message)
  };

  return (
    <div>
      <ClaimWizard onComplete={handleComplete} />
    </div>
  );
}
