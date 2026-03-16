'use client';

import { IntelligenceDetailError } from '@/components/intelligence-ops/detail-error';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <IntelligenceDetailError error={error} reset={reset} title="Provider detail" />;
}
