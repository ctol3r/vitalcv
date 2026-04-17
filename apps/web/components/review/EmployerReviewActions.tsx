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
      {successMsg && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 shadow-sm">
          <p className="text-sm font-bold text-green-700 text-center">✓ {successMsg}</p>
        </div>
      )}
      {!successMsg && nbaPayload && (
        <EmployerNextBestAction
          nba={nbaPayload}
          onActionClick={loading ? undefined : handleNbaAction}
        />
      )}
    </>
  );
}