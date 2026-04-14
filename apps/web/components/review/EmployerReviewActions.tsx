'use client';

import React from 'react';
import { EmployerNextBestAction, NextBestActionPayload } from './EmployerNextBestAction';

/** Shared handler for NBA and standard ActionHooks so actions execute identically */
async function triggerEmployerAction(
  npi: string,
  action: string,
  setLoading: (v: boolean) => void,
  setSuccessMsg: (msg: string) => void,
  successMsg: string
) {
  setLoading(true);
  try {
    await fetch('/api/pilot/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npi, actionTaken: action }),
    });
    setSuccessMsg(successMsg);
    setTimeout(() => {
      setSuccessMsg('');
      window.location.reload();
    }, 1500);
  } catch (e) {
    setLoading(false);
  }
}

export function EmployerReviewActions({
  npi,
  nbaPayload,
}: {
  npi: string;
  nbaPayload?: NextBestActionPayload | null;
}) {
  const [loading, setLoading] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState('');

  const handleAction = async (action: string, msg: string) => {
    await triggerEmployerAction(npi, action, setLoading, setSuccessMsg, msg);
  };

  // NBA maps directly to these standard actions
  const handleNbaAction = (actionType: string) => {
    if (actionType === 'PROCEED') handleAction('accept', 'Decision Recorded: Accept');
    else if (actionType === 'ESCALATE') handleAction('flag', 'Decision Recorded: Escalated');
    else if (actionType === 'REQUEST_DATA') handleAction('request_data', 'Decision Recorded: Info Requested');
    else if (actionType === 'REVERIFY') handleAction('request_data', 'Decision Recorded: Re-verify Requested');
    else handleAction('flag', 'Decision Recorded: Hold');
  };

  return (
    <>
      {nbaPayload && (
        <EmployerNextBestAction
          nba={nbaPayload}
          onActionClick={loading ? undefined : handleNbaAction}
        />
      )}

      {/* Legacy sticky CTA bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {successMsg || 'Ready to make a hiring decision?'}
            </p>
            <p className="text-xs text-muted-foreground">
              {successMsg
                ? 'Your decision has been securely recorded. Refreshing context...'
                : 'Select an action based on the verified trust posture above.'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              disabled={loading || !!successMsg}
              onClick={() => handleAction('flag', 'Decision Recorded: Escalated')}
              className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              Reject Candidate
            </button>
            <button
              disabled={loading || !!successMsg}
              onClick={() => handleAction('accept', 'Decision Recorded: Accept')}
              className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Hire Candidate
            </button>
          </div>
        </div>
      </div>
    </>
  );
}