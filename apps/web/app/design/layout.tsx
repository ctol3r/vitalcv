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
 */
export default function DesignPreviewLayout({ children }: { children: React.ReactNode }) {
  if (!isDesignPreviewAllowed(process.env)) notFound();
  return <>{children}</>;
}
