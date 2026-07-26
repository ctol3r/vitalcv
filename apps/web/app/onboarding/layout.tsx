import * as React from 'react';

// Session-sensitive tree (Wave 0.2): onboarding binds an NPI to the signed-in
// account, so it must render per-request. Production 18c9311 served this tree
// as a prerendered shell with s-maxage=31536000 — a year-long SHARED cache of
// a session-dependent page.
export const dynamic = 'force-dynamic';

// Light-only pass-through: the canonical onboarding surface (GetReadySurface)
// owns its own Calm Wave layout, so this wrapper just provides the paper
// background. (Was a hardcoded dark gradient — removed for the all-light site.)
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div className="mz mz-paper min-h-screen">{children}</div>;
}
