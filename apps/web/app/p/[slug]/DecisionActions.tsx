'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type ActionKind = 'accept' | 'request_data' | 'flag';
type ActionState = 'idle' | 'submitting' | 'done' | 'error';

interface ActionMeta {
  label: string;
  done: string;
  pending: string;
  tone: string;
  successToast: string;
}

const ACTION_LABELS: Record<ActionKind, ActionMeta> = {
  accept: {
    label: 'Proceed with this clinician',
    done: 'Proceeding',
    pending: 'Recording…',
    tone: 'border-green-600 bg-green-600 text-white hover:bg-green-700',
    successToast: 'Action recorded',
  },
  request_data: {
    label: 'Request additional verification',
    done: 'Request sent',
    pending: 'Sending…',
    tone: 'border-border bg-card text-foreground hover:bg-muted',
    successToast: 'Request submitted',
  },
  flag: {
    label: 'Mark as high risk',
    done: 'Marked',
    pending: 'Marking…',
    tone: 'border-red-500/40 bg-red-500/5 text-red-700 hover:bg-red-500/10',
    successToast: 'Marked for review',
  },
};

const ORDER: ActionKind[] = ['accept', 'request_data', 'flag'];

export function DecisionActions({ npi }: { npi: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>('idle');
  const [active, setActive] = useState<ActionKind | null>(null);

  const submit = async (action: ActionKind) => {
    if (state === 'submitting' || state === 'done') return;

    // Optimistic — block other buttons immediately.
    setState('submitting');
    setActive(action);

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
      toast.success(ACTION_LABELS[action].successToast);
      // Re-fetch server component — refreshes RecentActionsList + reuse_signal.
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setState('error');
      setActive(null);
      toast.error(
        err instanceof Error ? `Couldn't record action: ${err.message}` : 'Action failed',
      );
      // Revert to idle so the user can retry.
      setTimeout(() => setState('idle'), 50);
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
              className={`relative rounded-lg border-2 px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${meta.tone}`}
            >
              {isDoing && (
                <span
                  aria-hidden
                  className="absolute left-3 top-1/2 -mt-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
              )}
              <span className={isDoing ? 'pl-5' : ''}>
                {isDoing ? meta.pending : isDone ? meta.done : meta.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Your action will be recorded and reflected immediately.
      </p>
    </div>
  );
}
