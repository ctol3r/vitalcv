import type { Metadata } from 'next';
import { ReviewQueueSurface } from '@/components/review/ReviewQueueSurface';

export const metadata: Metadata = {
  title: 'Review queue — VitalCV',
  description:
    'Clinicians who shared source-backed evidence with your organization — triage with per-candidate audit events.',
};

// Data access is enforced at the API layer: the queue proxy requires a Clerk
// session and the backend binds scope to the caller's own registered
// organization. The surface renders honest signed-out / no-org states.
export default function EmployerReviewQueuePage() {
  return <ReviewQueueSurface />;
}
