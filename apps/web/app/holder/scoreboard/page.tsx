import type { Metadata } from 'next';
import CareerScoreboardSurface from './CareerScoreboardSurface';

export const metadata: Metadata = {
  title: 'Career Scoreboard · VitalCV',
  description:
    'Your career at a glance — source-backed readiness, employer Recognition, live role matches, applications, and what to do next. Every tile traces to your own evidence.',
};

export default function HolderScoreboardPage() {
  return <CareerScoreboardSurface />;
}
