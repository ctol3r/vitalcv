'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getEmployerActionLabel } from '@/lib/trust/decision-copy';
import { safeFetch, SafeFetchError } from '@/lib/safe-fetch';

function formatActionTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type ActionKind = 'accept' | 'request_data' | 'flag';
type ActionState = 'idle' | 'submitting' | 'done' | 'error';

interface ActionMeta {
  label: string;
  description: string;
  done: string;
  pending: string;
  tone: string;
  successToast: string;
}

const ACTION_LABELS: Record<ActionKind, ActionMeta> = {
  accept: {
    label: getEmployerActionLabel('accept'),
    description: 'Save that you are moving forward with the current proof as a head start.',
    done: 'Saved',
    pending: 'Saving...',
    tone: 'border-green-600 bg-green-600 text-white hover:bg-green-700',
    successToast: 'Head start saved',
  },
  request_data: {
    label: getEmployerActionLabel('refresh'),
    description: 'Ask for updated proof where information is missing, stale, or incomplete.',
    done: 'Saved',
    pending: 'Saving...',
    tone: 'border-border bg-card text-foreground hover:bg-muted',
    successToast: 'Update request saved',
  },
  flag: {
    label: getEmployerActionLabel('review'),
    description: 'Save that this profile needs review before anyone relies on it.',
    done: 'Saved',
    pending: 'Saving...',
    tone: 'border-red-500/40 bg-red-500/5 text-red-700 hover:bg-red-500/10',
    successToast: 'Review flag saved',
  },
};

const ORDER: ActionKind[] = ['accept', 'request_data', 'flag'];

export function DecisionActions({
  npi,
  refreshKey,
}: {
  npi: string;
  refreshKey?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>('idle');
  const [active, setActive] = useState<ActionKind | null>(null);
  const [lastRecordedAt, setLastRecordedAt] = useState<string | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const refreshKeyRef = useRef(refreshKey);

  function clearResetTimer() {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }

  function scheduleReset(delayMs: number) {
    clearResetTimer();
    resetTimerRef.current = window.setTimeout(() => {
      setState('idle');
      setActive(null);
      resetTimerRef.current = null;
    }, delayMs);
  }

  useEffect(() => {
    return () => {
      clearResetTimer();
    };
  }, []);

  useEffect(() => {
    if (refreshKeyRef.current !== refreshKey && state === 'done') {
      refreshKeyRef.current = refreshKey;
      clearResetTimer();
      setState('idle');
      setActive(null);
      return;
    }

    refreshKeyRef.current = refreshKey;
  }, [refreshKey, state]);

  const submit = async (action: ActionKind) => {
    if (state === 'submitting' || state === 'done') return;

    // Optimistic — block other buttons immediately.
    setState('submitting');
    setActive(action);
    clearResetTimer();

    try {
      // safeFetch enforces all three success conditions: HTTP ok,
      // application success, and server-confirmed persistence.
      await safeFetch('/api/employer-actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ npi, action }),
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      const recordedAt = new Date().toISOString();
      setState('done');
      setLastRecordedAt(recordedAt);
      toast.success(`${ACTION_LABELS[action].successToast} · ${formatActionTimestamp(recordedAt)}`);
      // Re-fetch server component — refreshes RecentActionsList + reuse_signal.
      startTransition(() => {
        router.refresh();
      });
      scheduleReset(2500);
    } catch (err) {
      const layer = err instanceof SafeFetchError ? err.layer : 'unknown';
      console.error('[DecisionActions] Failed to record employer action', {
        npi,
        action,
        layer,
        error: err instanceof Error ? err.message : String(err),
      });
      setState('error');
      setActive(null);
      toast.error(
        err instanceof Error ? `Couldn't record action: ${err.message}` : 'Action failed',
      );
      // Revert to idle so the user can retry.
      scheduleReset(1200);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ORDER.map((action) => {
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
              aria-busy={isDoing}
              title={meta.description}
              className={`relative min-h-[48px] w-full rounded-lg border-2 px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99] ${meta.tone}`}
            >
              {isDoing && (
                <span
                  aria-hidden
                  className="absolute left-3 top-4 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
              )}
              <span className={`block text-sm font-semibold ${isDoing ? 'pl-6' : ''}`}>
                {isDoing ? meta.pending : isDone ? meta.done : meta.label}
              </span>
              <span className="mt-1 block text-xs font-normal opacity-80">
                {meta.description}
              </span>
            </button>
          );
        })}
      </div>
      {state === 'done' && active && lastRecordedAt && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-800"
        >
          <p className="font-semibold">
            Action recorded · {ACTION_LABELS[active].label} · {formatActionTimestamp(lastRecordedAt)}
          </p>
          <p className="mt-1 text-xs text-green-900/80">
            This action has been recorded and will be reflected in future evaluations.
          </p>
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Your action will be recorded and reflected immediately.
      </p>
    </div>
  );
}
