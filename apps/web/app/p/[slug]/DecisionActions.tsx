'use client';

import { useState } from 'react';

type ActionKind = 'accept' | 'request_data' | 'flag';
type ActionState = 'idle' | 'submitting' | 'done' | 'error';

const ACTION_LABELS: Record<ActionKind, { label: string; done: string; tone: string }> = {
  accept: {
    label: 'Proceed with this clinician',
    done: 'Proceeding',
    tone: 'border-green-600 bg-green-600 text-white hover:bg-green-700',
  },
  request_data: {
    label: 'Request more data',
    done: 'Request sent',
    tone: 'border-border bg-card text-foreground hover:bg-muted',
  },
  flag: {
    label: 'Mark as high risk',
    done: 'Marked',
    tone: 'border-red-500/40 bg-red-500/5 text-red-700 hover:bg-red-500/10',
  },
};

export function DecisionActions({ npi }: { npi: string }) {
  const [state, setState] = useState<ActionState>('idle');
  const [active, setActive] = useState<ActionKind | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (action: ActionKind) => {
    setState('submitting');
    setActive(action);
    setMessage(null);
    try {
      const res = await fetch('/api/employer-actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ npi, action }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error ?? `HTTP ${res.status}`);
      }
      setState('done');
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Action failed');
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(['accept', 'request_data', 'flag'] as const).map((action) => {
          const meta = ACTION_LABELS[action];
          const isActive = active === action;
          const isDoing = state === 'submitting' && isActive;
          const isDone = state === 'done' && isActive;
          const disabled = state === 'submitting' || state === 'done';
          return (
            <button
              key={action}
              type="button"
              onClick={() => submit(action)}
              disabled={disabled}
              className={`rounded-lg border-2 px-4 py-3 text-sm font-semibold transition disabled:opacity-60 ${meta.tone}`}
            >
              {isDoing ? 'Working…' : isDone ? meta.done : meta.label}
            </button>
          );
        })}
      </div>
      {state === 'error' && (
        <p className="text-center text-sm text-red-600">Couldn’t record action: {message}</p>
      )}
      {state === 'done' && (
        <p className="text-center text-xs text-muted-foreground">
          Action recorded. Reload to see it in the history below.
        </p>
      )}
    </div>
  );
}
