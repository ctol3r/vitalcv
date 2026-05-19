/**
 * VitalCV · Trust Surfaces · FailureBanner v1
 *
 * Renders one of the five canonical failure modes (A–E) as a
 * documented refusal — never as a "system error" toast. The banner
 * has two halves: the failure copy (what happened) and the refusal
 * copy (what MUST NOT happen as a consequence). The refusal is the
 * operator-action contract; without it the banner is just noise.
 */

import * as React from 'react';

import type { FailureModeDescriptor } from '@/lib/trust/types';

export interface FailureBannerProps {
  descriptor: FailureModeDescriptor;
}

export function FailureBanner({ descriptor }: FailureBannerProps) {
  return (
    <aside
      className="t-failure"
      data-testid="trust-failure-banner"
      data-mode={descriptor.mode}
      role="status"
    >
      <header className="t-failure-head">
        <span className="t-failure-mode mono">
          mode {descriptor.mode}
        </span>
        <h3 className="t-failure-title">{descriptor.title}</h3>
      </header>
      <p className="t-failure-copy">{descriptor.copy}</p>
      <p className="t-failure-refusal">
        <span className="t-failure-refusal-label mono">refusal · </span>
        {descriptor.refusalCopy}
      </p>
    </aside>
  );
}
