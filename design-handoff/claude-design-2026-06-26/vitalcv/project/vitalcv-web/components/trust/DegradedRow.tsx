// VitalCV · Trust Surfaces · DegradedRow
// Canon v1 · §07.04 — stale never recolors, never reduces opacity. Stale borders.
// Wrap any claim row that the source-fetch layer flagged degraded=true.

import * as React from "react";

export function DegradedRow({
  children,
  degraded = false,
  className,
}: {
  children: React.ReactNode;
  degraded?: boolean;
  className?: string;
}) {
  return (
    <div className={`t-row ${className ?? ""}`} data-degraded={degraded || undefined}>
      {children}
    </div>
  );
}
