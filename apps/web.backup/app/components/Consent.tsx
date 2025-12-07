"use client";
import { useEffect, useState } from 'react';

const KEY = 'vitalcv_consent';
const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || '';

async function logConsent(action: string) {
  try {
    await fetch(`${BASE}/consent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        user_id: 'demo',
        action,
        meta: { timestamp: new Date().toISOString() }
      })
    });
  } catch (e) {
    console.warn('Failed to log consent:', e);
  }
}

export default function Consent() {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    setValue(localStorage.getItem(KEY));
  }, []);

  if (value) return null;

  return (
    <div className="fixed bottom-3 left-3 p-3 bg-white dark:bg-gray-800 border rounded text-xs shadow-lg max-w-sm z-50">
      <div className="font-medium mb-1">Privacy Notice</div>
      <div className="mb-2 text-gray-600 dark:text-gray-300">
        Allow anonymous telemetry for pilot metrics?
      </div>
      <div className="flex gap-2">
        <button
          className="px-3 py-1 bg-black text-white rounded hover:bg-gray-800 transition-colors"
          onClick={async () => {
            localStorage.setItem(KEY, 'yes');
            setValue('yes');
            await logConsent('telemetry_yes');
          }}
        >
          Accept
        </button>
        <button
          className="px-3 py-1 border rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          onClick={async () => {
            localStorage.setItem(KEY, 'no');
            setValue('no');
            await logConsent('telemetry_no');
          }}
        >
          Decline
        </button>
      </div>
    </div>
  );
}

