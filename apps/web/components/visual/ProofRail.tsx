import * as React from 'react';

export type RailStep = {
  k: React.ReactNode;
  v: React.ReactNode;
  t?: React.ReactNode;
  variant?: 'default' | 'current' | 'boundary';
};

/**
 * Proof Continuity Rail — one canonical component reused across surfaces
 * per role-auth-interoperability-ux.md §3.
 *
 * The "boundary" variant gets a "REVIEW BOUNDARY" pseudo-element to make
 * the institution-review hand-off visible without being alarming.
 */
export function ProofRail({ steps }: { steps: RailStep[] }) {
  return (
    <div className="vs-rail" role="list" aria-label="Proof continuity">
      {steps.map((step, index) => (
        <div
          key={index}
          className={`vs-step${
            step.variant === 'current'
              ? ' current'
              : step.variant === 'boundary'
                ? ' boundary'
                : ''
          }`}
          role="listitem"
        >
          <span className="vs-k">{step.k}</span>
          <span className="vs-v">{step.v}</span>
          {step.t ? <span className="vs-t">{step.t}</span> : null}
        </div>
      ))}
    </div>
  );
}
