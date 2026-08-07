import { notFound } from 'next/navigation';

import { isDesignPreviewAllowed } from '@/lib/design/preview';

/**
 * Gate for every `/design/*` reference surface.
 *
 * Deliberately a LAYOUT rather than a per-page check. `/dev/*` guards each page
 * individually, which works until someone adds a page and forgets — and there
 * are already eight routes under here. A layout wraps the whole subtree, so a
 * ninth reference is gated the moment it exists, without anyone remembering to
 * do it.
 *
 * `notFound()` rather than a redirect: a 404 is the honest answer. In canonical
 * production this route genuinely does not exist.
 *
 * DYNAMIC on purpose. These routes are otherwise static, so Next evaluated the
 * gate ONCE at `next build` — with the BUILDER's environment, where
 * DESIGN_PREVIEW is unset — and baked a permanent 404 into the image
 * (`s-maxage=31536000`, observed on the z1-preview deploy). The env decision
 * this gate encodes is a property of the RUNTIME environment, so it must be
 * answered per request; the same image then serves a preview environment and
 * canonical production correctly.
 */
export const dynamic = 'force-dynamic';

export default function DesignPreviewLayout({ children }: { children: React.ReactNode }) {
  if (!isDesignPreviewAllowed(process.env)) notFound();
  return <>{children}</>;
}
