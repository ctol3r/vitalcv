import * as React from 'react';

// Session-sensitive tree (Wave 0.2): rendered per-request, never prerendered,
// never shared-cacheable. Production 18c9311 served session-dependent pages
// with public s-maxage — this layout pins the whole subtree dynamic.
export const dynamic = 'force-dynamic';

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
