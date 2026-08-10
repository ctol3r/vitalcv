import { notFound } from 'next/navigation';

import { isDevPreviewAllowed } from '@/lib/dev/preview';

/**
 * Gate for every `/dev/*` developer harness.
 *
 * The `/design/*` layout gate already names why this has to be a LAYOUT: a
 * per-page check "works until someone adds a page and forgets" — and it called
 * out `/dev/*` by name as the subtree still doing it the fragile way. This
 * closes that. A tenth harness is gated the moment it exists.
 *
 * Per-page flags stay. They answer "may THIS harness run here?"; the layout
 * answers "may harnesses run here at all?" — and canonical production says no,
 * so no single page-level variable can expose one on its own.
 *
 * `notFound()` rather than a redirect: in canonical production these routes
 * genuinely do not exist, and 404 is the honest answer.
 *
 * DYNAMIC on purpose — the same lesson the `/design` gate records. These routes
 * are otherwise static, so Next would evaluate the gate ONCE at `next build`,
 * with the BUILDER's environment, and bake the result into the image with
 * `s-maxage=31536000`. The env this gate reads is a property of the RUNTIME, so
 * it must be answered per request.
 */
export const dynamic = 'force-dynamic';

export default function DevHarnessLayout({ children }: { children: React.ReactNode }) {
  if (!isDevPreviewAllowed(process.env)) notFound();
  return <>{children}</>;
}
