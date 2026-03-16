import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CalibrationDashboard } from './CalibrationDashboard';

export const metadata: Metadata = {
  title: 'Investigator Calibration | VitalCV',
  description: 'Investigator accuracy, false positive rates, evidence quality, and learning loop metrics.',
};

export default function CalibrationPage() {
  return (
    <Suspense fallback={null}>
      <CalibrationDashboard />
    </Suspense>
  );
}
