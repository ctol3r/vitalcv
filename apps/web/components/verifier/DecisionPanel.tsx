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

const OUTCOME_CLASSES: Record<PolicyDecisionOutcome, string> = {
  acceptable_for_start: 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
  pending_additional_info: 'border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100',
  requires_committee_review: 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100',
  unable_to_assess: 'border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200',
};

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
      className="rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-200 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Internal assessment
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">
          Decision foundation
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          NPI <span className="font-mono">{item.clinicianNpi}</span> ·{' '}
          {explainWorklistStatus(item.status)}
        </p>
      </div>

      <div className="grid gap-5 p-5">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Reuse basis
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {explainReuseBasis(reuseBasis)}
          </p>
          {reuseWarning ? (
            <p className="mt-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
              {reuseWarning}
            </p>
          ) : null}
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-950">
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
                  className={`rounded-md border px-4 py-3 text-left text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-slate-700 ${OUTCOME_CLASSES[outcome]} ${
                    isSelected ? 'ring-2 ring-slate-700' : ''
                  }`}
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

        <div className="rounded-md border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current shell state
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {selectedOutcome
              ? getPolicyDecisionCopy(selectedOutcome).detail
              : 'No internal assessment outcome has been recorded in this shell.'}
          </p>
        </div>
      </div>

      <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-600">
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
