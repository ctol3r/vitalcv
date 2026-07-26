'use client';

import React, { useState, type ReactElement } from 'react';

import {
  explainWorklistStatus,
  type WorklistItem,
} from '@/lib/verifier/worklist';
import {
  explainReuseBasis,
  getReuseWarning,
  type ReuseDecisionBasis,
} from '@/lib/verifier/reuseDecisionFoundation';
import {
  getPolicyDecisionCopy,
  type PolicyDecisionOutcome,
} from '@/lib/verifier/policyDecisionFoundation';

interface DecisionPanelProps {
  item: WorklistItem;
  onDecision?: (outcome: PolicyDecisionOutcome) => void;
}

const DECISION_OUTCOMES: PolicyDecisionOutcome[] = [
  'acceptable_for_start',
  'pending_additional_info',
  'requires_committee_review',
  'unable_to_assess',
];

export function DecisionPanel({
  item,
  onDecision,
}: DecisionPanelProps): ReactElement {
  const [selectedOutcome, setSelectedOutcome] = useState<PolicyDecisionOutcome | null>(null);
  const reuseBasis = resolveReuseBasis(item);
  const reuseWarning = getReuseWarning(reuseBasis);

  function handleDecision(outcome: PolicyDecisionOutcome) {
    setSelectedOutcome(outcome);
    onDecision?.(outcome);
  }

  return (
    <section
      aria-label="Verifier decision foundation"
      className="mz mz-glass overflow-hidden"
    >
      <div className="flex flex-col gap-2 border-b border-[var(--rule)] p-5">
        <p className="mz-eyebrow">
          Internal assessment
        </p>
        <h2 className="mz-h2">
          Decision foundation
        </h2>
        <p className="text-sm text-[var(--ink-600)]">
          NPI <span className="mz-mono">{item.clinicianNpi}</span> ·{' '}
          {explainWorklistStatus(item.status)}
        </p>
      </div>

      <div className="grid gap-5 p-5">
        <div className="mz-inset p-4">
          <p className="mz-eyebrow">
            Reuse basis
          </p>
          <p className="mt-2 text-sm text-[var(--ink-700)]">
            {explainReuseBasis(reuseBasis)}
          </p>
          {reuseWarning ? (
            <p className="mt-3 rounded-[3px] border border-[var(--watch-rule)] bg-[var(--watch-bg)] px-3 py-2 text-sm text-[var(--watch)]">
              {reuseWarning}
            </p>
          ) : null}
        </div>

        <div>
          <p className="text-sm font-semibold text-[var(--ink-900)]">
            Record internal assessment outcome
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {DECISION_OUTCOMES.map((outcome) => {
              const copy = getPolicyDecisionCopy(outcome);
              const isSelected = selectedOutcome === outcome;

              return (
                <button
                  key={outcome}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleDecision(outcome)}
                  className="mz-opt text-left focus:outline-none focus:ring-2 focus:ring-[var(--ink-900)]"
                >
                  {copy.action}
                  <span className="mt-1 block text-xs font-normal">
                    {copy.detail}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mz-inset p-4">
          <p className="mz-eyebrow">
            Current shell state
          </p>
          <p className="mt-2 text-sm text-[var(--ink-700)]">
            {selectedOutcome
              ? getPolicyDecisionCopy(selectedOutcome).detail
              : 'No internal assessment outcome has been recorded in this shell.'}
          </p>
        </div>
      </div>

      <p className="border-t border-[var(--rule)] bg-[var(--paper-2)] px-5 py-3 text-xs text-[var(--ink-600)]">
        Decisions recorded here are internal assessment records. VitalCV does
        not guarantee employment eligibility.
      </p>
    </section>
  );
}

function resolveReuseBasis(item: WorklistItem): ReuseDecisionBasis {
  if (item.proofTier === 'self_attested') return 'self_attested_only';
  if (item.proofTier === 'psv_sourced') return 'prior_psv_receipt';
  return 'prior_assessment';
}
