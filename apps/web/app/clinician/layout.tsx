import * as React from 'react';

// Session-sensitive tree (Wave 0.2): rendered per-request, never prerendered,
// never shared-cacheable. `/clinician/profile` already exported
// `dynamic = 'force-dynamic'` on the page itself, which is why nothing leaked
// while the tree sat outside SESSION_PATH_PREFIXES. Pinning it here instead
// makes the guarantee a property of the TREE rather than of one page that
// happened to remember — the next surface added under /clinician inherits it.
export const dynamic = 'force-dynamic';

export default function ClinicianLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
