'use client';

import React from 'react';

export interface NextBestActionPayload {
  action: 'PROCEED' | 'REQUEST_DATA' | 'REVERIFY' | 'ESCALATE' | 'HOLD';
  reason: string;
  confidence: number;
  derivedFromLearning: boolean;
}

export function EmployerNextBestAction({
  nba,
  onActionClick,
}: {
  nba: NextBestActionPayload | null;
  onActionClick?: (actionType: string) => void;
}) {
  if (!nba) return null;

  // Determine styling based on action
  let bgColor = 'bg-slate-100';
  let textColor = 'text-slate-800';
  let icon = 'ℹ️';

  let actionLabel = 'Execute Action';
  let btnClasses = 'bg-white text-slate-800 ring-slate-300 hover:bg-slate-50';

  switch (nba.action) {
    case 'PROCEED':
      bgColor = 'bg-green-100/50 border-green-200';
      textColor = 'text-green-800';
      icon = '✅';
      actionLabel = 'Approve Candidate';
      btnClasses = 'bg-green-600 text-white ring-green-600 hover:bg-green-700';
      break;
    case 'ESCALATE':
      bgColor = 'bg-red-100/50 border-red-200';
      textColor = 'text-red-800';
      icon = '🚨';
      actionLabel = 'Reject Candidate';
      btnClasses = 'bg-red-600 text-white ring-red-600 hover:bg-red-700';
      break;
    case 'REQUEST_DATA':
      bgColor = 'bg-amber-100/50 border-amber-200';
      textColor = 'text-amber-800';
      icon = '⚠️';
      actionLabel = 'Request More Data';
      break;
    case 'REVERIFY':
      bgColor = 'bg-amber-100/50 border-amber-200';
      textColor = 'text-amber-800';
      icon = '🔄';
      actionLabel = 'Run Fresh Sync';
      break;
    case 'HOLD':
      bgColor = 'bg-slate-100/50 border-slate-200';
      textColor = 'text-slate-800';
      icon = '⏳';
      actionLabel = 'Hold (Processing)';
      break;
  }

  return (
    <div
      className={`mb-6 rounded-lg border p-4 shadow-sm ${bgColor}`}
      role="alert"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className={`text-sm font-bold uppercase tracking-wider ${textColor}`}>
            {icon} System Recommendation
          </h3>
          <p className="mt-1 text-sm text-slate-700">{nba.reason}</p>

          <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
            <span
              className="flex items-center gap-1"
              title="System Confidence Score"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {Math.round(nba.confidence * 100)}% Certainty
            </span>
            {nba.derivedFromLearning && (
              <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Based on historic success rate
              </span>
            )}
          </div>
        </div>

        {onActionClick && (
          <button
            onClick={() => onActionClick(nba.action)}
            disabled={nba.action === 'HOLD'}
            className={`shrink-0 rounded-md px-5 py-2.5 text-sm font-semibold shadow-sm ring-1 ring-inset transition-colors disabled:opacity-50 ${btnClasses}`}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
