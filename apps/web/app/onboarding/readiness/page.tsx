'use client';

import * as React from 'react';
import { ReadinessCard } from '@/components/onboarding/ReadinessCard';

export default function ReadinessPage() {
  return (
    <ReadinessCard
      state="ready"
      title="Your credentials are ready."
      summary="Dr. First Last, MD. Active NJ License. 0 Sanctions."
      passportId="dr-first-last"
    />
  );
}
