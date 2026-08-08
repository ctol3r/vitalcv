import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { PageStackHarness } from './PageStackHarness';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Page stack (dev)',
  robots: { index: false, follow: false },
};

/**
 * Developer-only harness for the PageStack shell. Never available in production
 * unless PAGE_STACK_PREVIEW=1 is set explicitly (used by the e2e web server,
 * which builds in production mode). Mirrors the /dev/matcha-deck gate.
 */
export default function PageStackDevPage() {
  const enabled = process.env.NODE_ENV !== 'production' || process.env.PAGE_STACK_PREVIEW === '1';
  if (!enabled) notFound();

  // usePaneStack reads useSearchParams, which requires a Suspense boundary.
  return (
    <Suspense fallback={<div style={{ padding: 24, opacity: 0.6 }}>Loading page stack…</div>}>
      <PageStackHarness />
    </Suspense>
  );
}
