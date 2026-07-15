import * as React from 'react';

// Light-only pass-through: the canonical onboarding surface (GetReadySurface)
// owns its own Calm Wave layout, so this wrapper just provides the paper
// background. (Was a hardcoded dark gradient — removed for the all-light site.)
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div className="mz mz-paper min-h-screen">{children}</div>;
}
